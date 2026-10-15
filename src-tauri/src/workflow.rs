//! Recoverable history operations. Inputs are resolved before invoking Git;
//! every operation runs under GitService's repository lock.
use crate::{
    git::{revision, validate_branch},
    models::{Operation, OperationAction, Request},
    process::git,
};
use serde_json::{json, Value};
use std::path::Path;

pub fn operation(path: &Path) -> Result<Option<Operation>, String> {
    let admin = git(path, &["rev-parse", "--absolute-git-dir"])?;
    for (marker, state) in [
        ("rebase-merge", Operation::Rebase),
        ("rebase-apply", Operation::Rebase),
        ("MERGE_HEAD", Operation::Merge),
        ("CHERRY_PICK_HEAD", Operation::CherryPick),
        ("REVERT_HEAD", Operation::Revert),
    ] {
        // The per-worktree Git directory also handles linked worktrees.
        if Path::new(admin.trim()).join(marker).exists() {
            return Ok(Some(state));
        }
    }
    Ok(None)
}

pub fn check_allowed(path: &Path, request: &Request) -> Result<(), String> {
    if matches!(
        request,
        Request::Snapshot
            | Request::History { .. }
            | Request::CommitFiles { .. }
            | Request::Diff { .. }
            | Request::Compare { .. }
            | Request::Stage { .. }
            | Request::Unstage { .. }
            | Request::StageAll
            | Request::UnstageAll
            | Request::Operation { .. }
            | Request::Fetch { .. }
    ) {
        return Ok(());
    }
    if let Some(op) = operation(path)? {
        return Err(format!("A {} is in progress. Resolve and stage conflicts, then continue, skip, or abort it first.", op.command()));
    }
    Ok(())
}

fn clean(path: &Path) -> Result<(), String> {
    if !git(path, &["status", "--porcelain", "--untracked-files=all"])?.is_empty() {
        return Err("Commit or stash all working changes before this operation.".into());
    }
    Ok(())
}
fn local_branch(path: &Path, name: &str) -> Result<(), String> {
    validate_branch(path, name)?;
    git(
        path,
        &["show-ref", "--verify", &format!("refs/heads/{name}")],
    )?;
    Ok(())
}
fn current_branch(path: &Path) -> Result<String, String> {
    let name = git(path, &["symbolic-ref", "--quiet", "--short", "HEAD"])?;
    let name = name.trim();
    validate_branch(path, name)?;
    Ok(name.into())
}

pub fn execute(path: &Path, request: Request) -> Result<Value, String> {
    match request {
        Request::Merge { revision: target } => {
            return history_operation(path, Operation::Merge, &target)
        }
        Request::Rebase { revision: target } => {
            return history_operation(path, Operation::Rebase, &target)
        }
        Request::CherryPick { revision: target } => {
            return history_operation(path, Operation::CherryPick, &target)
        }
        Request::Revert { revision: target } => {
            return history_operation(path, Operation::Revert, &target)
        }
        Request::RenameBranch { name, new_name } => {
            local_branch(path, &name)?;
            validate_branch(path, &new_name)?;
            git(path, &["branch", "-m", &name, &new_name])?;
        }
        Request::DeleteBranch { name } => {
            local_branch(path, &name)?;
            git(path, &["branch", "-d", &name])?;
        }
        Request::CreateBranchAt {
            name,
            revision: target,
        } => {
            validate_branch(path, &name)?;
            let id = revision(path, &target)?;
            git(path, &["branch", &name, &id])?;
        }
        Request::TrackBranch { name, reference } => {
            clean(path)?;
            validate_branch(path, &name)?;
            if reference.starts_with('-') || reference.contains('\0') {
                return Err("Invalid remote branch".into());
            }
            let reference = format!("refs/remotes/{reference}");
            git(path, &["show-ref", "--verify", &reference])?;
            git(path, &["switch", "--track", "-c", &name, &reference])?;
        }
        Request::Publish { remote } => {
            if remote.starts_with('-')
                || !git(path, &["remote"])?.lines().any(|name| name == remote)
            {
                return Err("Choose a configured remote.".into());
            }
            let name = current_branch(path)?;
            git(
                path,
                &[
                    "-c",
                    &format!("remote.{remote}.mirror=false"),
                    "-c",
                    "push.followTags=false",
                    "push",
                    "--set-upstream",
                    "--",
                    &remote,
                    &format!("HEAD:refs/heads/{name}"),
                ],
            )?;
        }
        Request::StashApply { index, expected } => stash(path, "apply", index, &expected)?,
        Request::StashPop { index, expected } => stash(path, "pop", index, &expected)?,
        Request::StashDrop { index, expected } => stash(path, "drop", index, &expected)?,
        Request::CreateTag {
            name,
            revision: target,
        } => {
            if name.starts_with('-') {
                return Err("Invalid tag name".into());
            }
            git(path, &["check-ref-format", &format!("refs/tags/{name}")])?;
            let id = revision(path, &target)?;
            git(path, &["tag", "--", &name, &id])?;
        }
        Request::StageAll => {
            git(path, &["add", "--all", "--", "."])?;
        }
        Request::UnstageAll => {
            if revision(path, "HEAD").is_ok() {
                git(path, &["reset", "-q", "HEAD", "--", "."])?;
            } else {
                git(path, &["rm", "-r", "--cached", "--", "."])?;
            }
        }
        Request::Operation {
            operation: expected,
            action,
        } => {
            if operation(path)? != Some(expected) {
                return Err("Repository operation changed. Refresh before continuing.".into());
            }
            if matches!(action, OperationAction::Skip) && expected == Operation::Merge {
                return Err("A merge cannot be skipped. Continue or abort it.".into());
            }
            if matches!(action, OperationAction::Continue)
                && !git(path, &["diff", "--name-only", "--diff-filter=U"])?
                    .trim()
                    .is_empty()
            {
                return Err("Resolve and stage every conflicted file before continuing.".into());
            }
            let flag = match action {
                OperationAction::Continue => "--continue",
                OperationAction::Abort => "--abort",
                OperationAction::Skip => "--skip",
            };
            git(path, &["-c", "core.editor=true", expected.command(), flag])?;
        }
        _ => return Err("Unsupported workflow operation".into()),
    }
    Ok(json!(null))
}

fn stash(path: &Path, command: &str, index: usize, expected: &str) -> Result<(), String> {
    let reference = format!("stash@{{{index}}}");
    if revision(path, &reference)? != expected {
        return Err("The stash list changed. Refresh and choose the stash again.".into());
    }
    if command != "drop" {
        clean(path)?;
    }
    git(path, &["stash", command, &reference])?;
    Ok(())
}

pub fn history_operation(path: &Path, operation: Operation, target: &str) -> Result<Value, String> {
    clean(path)?;
    current_branch(path)?;
    let id = revision(path, target)?;
    // Merge commits need a mainline choice for pick/revert; never guess it.
    if matches!(operation, Operation::CherryPick | Operation::Revert)
        && revision(path, &format!("{id}^2")).is_ok()
    {
        return Err(
            "Select a non-merge commit. Mainline selection for merge commits is not supported yet."
                .into(),
        );
    }
    match operation {
        Operation::Merge => {
            git(
                path,
                &[
                    "-c",
                    "merge.autoStash=false",
                    "merge",
                    "--no-edit",
                    "--ff",
                    &id,
                ],
            )?;
        }
        Operation::Rebase => {
            git(
                path,
                &[
                    "-c",
                    "rebase.autoStash=false",
                    "-c",
                    "rebase.updateRefs=false",
                    "rebase",
                    "--no-autostash",
                    &id,
                ],
            )?;
        }
        Operation::CherryPick => {
            git(path, &["cherry-pick", &id])?;
        }
        Operation::Revert => {
            git(path, &["revert", "--no-edit", &id])?;
        }
    }
    Ok(json!(null))
}
