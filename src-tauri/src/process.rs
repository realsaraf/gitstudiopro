//! Bounded, shell-free Git execution. No arbitrary command reaches this boundary.
use std::{
    io::Read,
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
        Err("Git output exceeded 16 MiB. Select a smaller file or comparison.".into())
    } else {
        Ok(result)
    }
}

pub fn git(path: &Path, args: &[&str]) -> Result<String, String> {
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
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GCM_INTERACTIVE", "never")
        .env("GIT_EDITOR", "true")
        .env("GIT_SEQUENCE_EDITOR", "true")
        .env("LC_ALL", "C");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command.spawn().map_err(|e| {
        format!("Could not start Git. Install Git and make it available on PATH. {e}")
    })?;
    let stdout = child.stdout.take().ok_or("Missing Git stdout")?;
    let stderr = child.stderr.take().ok_or("Missing Git stderr")?;
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
    String::from_utf8(stdout).map_err(|_| {
        "This repository contains non-UTF-8 output, which this version cannot display safely."
            .into()
    })
}
