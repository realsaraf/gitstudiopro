//! Creation is separate from commands on registered repositories.
use crate::process::git;
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::Path;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRepository {
    pub destination: String,
    pub url: Option<String>,
    pub branch: String,
    pub depth: u32,
    pub recursive: bool,
    pub single_branch: bool,
    pub bare: bool,
}
pub fn create(c: CreateRepository) -> Result<Value, String> {
    let destination = Path::new(&c.destination);
    if !destination.is_absolute() || destination.exists() {
        return Err(
            "Choose a new absolute destination path. Existing folders are not overwritten.".into(),
        );
    }
    let parent = destination
        .parent()
        .ok_or("Destination needs a parent directory")?;
    if !parent.is_dir() {
        return Err("Choose an existing parent directory".into());
    }
    let mut args: Vec<String> = Vec::new();
    if let Some(url) = c.url {
        if url.trim().is_empty() || url.starts_with('-') || url.contains(['\0', '\n', '\r']) {
            return Err("Invalid clone URL or source path".into());
        }
        args.push("clone".into());
        if c.bare {
            args.push("--bare".into());
        }
        if c.recursive {
            args.push("--recurse-submodules".into());
        }
        if c.single_branch {
            args.push("--single-branch".into());
        }
        if c.depth > 0 {
            args.extend(["--depth".into(), c.depth.to_string()]);
        }
        if !c.branch.is_empty() {
            if c.branch.starts_with('-') || c.branch.contains('\0') {
                return Err("Invalid branch".into());
            }
            args.extend(["--branch".into(), c.branch]);
        }
        args.extend(["--".into(), url, c.destination.clone()]);
    } else {
        args.push("init".into());
        if c.bare {
            args.push("--bare".into());
        }
        let branch = if c.branch.is_empty() {
            "main"
        } else {
            &c.branch
        };
        git(parent, &["check-ref-format", "--branch", branch])?;
        args.extend([
            "--initial-branch".into(),
            branch.into(),
            "--".into(),
            c.destination.clone(),
        ]);
    }
    let text = git(parent, &args.iter().map(String::as_str).collect::<Vec<_>>())?;
    Ok(json!({"path":c.destination,"bare":c.bare,"text":text}))
}
