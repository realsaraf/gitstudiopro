//! Bounded process execution. Git arguments are typed; custom tools require explicit selection.
use std::{
    io::{Read, Write},
    path::Path,
    process::{Command, Stdio},
    sync::mpsc,
    thread,
    time::{Duration, Instant},
};

const OUTPUT_LIMIT: usize = 16 * 1024 * 1024;

fn drain(mut pipe: impl Read) -> Result<Vec<u8>, String> {
    let mut result = Vec::new();
    let mut buffer = [0; 8192];
    let mut exceeded = false;
    loop {
        let size = pipe.read(&mut buffer).map_err(|e| e.to_string())?;
        if size == 0 {
            break;
        }
        if result.len() + size <= OUTPUT_LIMIT {
            result.extend_from_slice(&buffer[..size]);
        } else {
            exceeded = true;
        }
    }
    if exceeded {
        Err("Process output exceeded 16 MiB. Select a smaller input.".into())
    } else {
        Ok(result)
    }
}

pub fn git(path: &Path, args: &[&str]) -> Result<String, String> {
    git_input(path, args, None, &[])
}

pub fn git_input(
    path: &Path,
    args: &[&str],
    input: Option<&str>,
    env: &[(&str, &str)],
) -> Result<String, String> {
    if input.is_some_and(|value| value.len() > OUTPUT_LIMIT) {
        return Err("Input exceeds 16 MiB".into());
    }
    let mut command = Command::new("git");
    command.arg("--no-pager");
    // Stash invokes Git internally with its own magic pathspecs. A global
    // literal-pathspecs flag breaks its untracked-file cleanup.
    if args.first() != Some(&"stash") {
        command.arg("--literal-pathspecs");
    }
    command
        .args(["-c", "color.ui=false", "-c", "core.quotepath=false", "-C"])
        .arg(path)
        .args(args)
        .stdin(if input.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GCM_INTERACTIVE", "never")
        .env("GIT_EDITOR", "true")
        .env("GIT_SEQUENCE_EDITOR", "true")
        .env("LC_ALL", "C");
    for (key, value) in env {
        command.env(key, value);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    finish(command, input)
}

pub fn program(path: &Path, executable: &Path, args: &[String]) -> Result<String, String> {
    let mut command = Command::new(executable);
    command
        .current_dir(path)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    finish(command, None)
}

fn finish(mut command: Command, input: Option<&str>) -> Result<String, String> {
    let mut child = command.spawn().map_err(|e| {
        format!("Could not start the program. Check its installation and executable path. {e}")
    })?;
    let stdout = child.stdout.take().ok_or("Missing Git stdout")?;
    let stderr = child.stderr.take().ok_or("Missing Git stderr")?;
    let input_receive = if let Some(input) = input {
        let mut stdin = child.stdin.take().ok_or("Missing Git stdin")?;
        let bytes = input.as_bytes().to_vec();
        let (send, receive) = mpsc::channel();
        thread::spawn(move || {
            let _ = send.send(stdin.write_all(&bytes));
        });
        Some(receive)
    } else {
        None
    };
    let (out_send, out_receive) = mpsc::channel();
    let (err_send, err_receive) = mpsc::channel();
    thread::spawn(move || {
        let _ = out_send.send(drain(stdout));
    });
    thread::spawn(move || {
        let _ = err_send.send(drain(stderr));
    });
    let start = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            break status;
        }
        if start.elapsed() > Duration::from_secs(120) {
            let _ = child.kill();
            let _ = child.wait();
            // Do not block on pipe handles inherited by credential helpers.
            return Err(
                "Git timed out after 120 seconds. Check repository state before retrying a write."
                    .into(),
            );
        }
        thread::sleep(Duration::from_millis(10));
    };
    let remaining = || Duration::from_secs(120).saturating_sub(start.elapsed());
    let stdout = out_receive.recv_timeout(remaining()).map_err(|_| "Git output timed out. A hook or credential helper may still be running; inspect repository state before retrying.")??;
    let stderr = err_receive
        .recv_timeout(remaining())
        .map_err(|_| "Git error output timed out. Inspect repository state before retrying.")??;
    if !status.success() {
        let message = String::from_utf8_lossy(&stderr).trim().to_owned();
        return Err(if message.is_empty() {
            format!("Git exited with {status}")
        } else {
            message
        });
    }
    if let Some(receive) = input_receive {
        receive
            .recv_timeout(remaining())
            .map_err(|_| "Git input timed out")?
            .map_err(|e| e.to_string())?;
    }
    String::from_utf8(stdout).map_err(|_| {
        "This repository contains non-UTF-8 output, which this version cannot display safely."
            .into()
    })
}
