//! Git operations deliberately expose a small, typed command surface.
use crate::{models::*, process::git};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    path::{Component, Path, PathBuf},
    sync::{Arc, Mutex},
};

#[derive(Default)]
pub struct GitService {
    repositories: Mutex<HashMap<PathBuf, Arc<Mutex<()>>>>,
}

fn root(path: &str) -> Result<PathBuf, String> {
    let path = Path::new(path)
        .canonicalize()
        .map_err(|e| format!("Cannot open directory: {e}"))?;
    let root = git(&path, &["rev-parse", "--show-toplevel"])?;
    Path::new(root.trim())
        .canonicalize()
        .map_err(|e| e.to_string())
}
fn branch(path: &Path) -> Result<String, String> {
    Ok(git(path, &["symbolic-ref", "--quiet", "--short", "HEAD"])
        .unwrap_or_else(|_| "Detached HEAD".into())
        .trim()
        .to_owned())
}
pub(crate) fn revision(path: &Path, reference: &str) -> Result<String, String> {
    if reference.is_empty() || reference.len() > 1024 || reference.contains('\0') {
        return Err("Invalid revision".into());
    }
    Ok(git(
        path,
        &[
            "rev-parse",
            "--verify",
            "--end-of-options",
            &format!("{reference}^{{commit}}"),
        ],
    )?
    .trim()
    .into())
}
pub(crate) fn validate_file(file: &str) -> Result<(), String> {
    if file.is_empty()
        || file.contains('\0')
        || Path::new(file)
            .components()
            .any(|c| !matches!(c, Component::Normal(_)))
    {
        return Err("Expected a relative repository file path.".into());
    }
    Ok(())
}
pub(crate) fn validate_branch(path: &Path, name: &str) -> Result<(), String> {
    if name.starts_with('-') || name.contains('@') || name.len() > 1024 {
        return Err("Invalid branch name.".into());
    }
    git(path, &["check-ref-format", "--branch", name])?;
    Ok(())
}

pub fn parse_status(output: &str) -> Vec<FileChange> {
    let mut records = output.split('\0').filter(|r| !r.is_empty());
    let mut result = Vec::new();
    while let Some(record) = records.next() {
        if record.len() < 4 || !record.is_char_boundary(3) {
            continue;
        }
        let index = &record[0..1];
        let worktree = &record[1..2];
        result.push(FileChange {
            path: record[3..].into(),
            index: index.into(),
            worktree: worktree.into(),
        });
        if index == "R" || index == "C" || worktree == "R" || worktree == "C" {
            records.next();
        }
    }
    result
}

pub fn parse_history(output: &str) -> Vec<Commit> {
    let fields: Vec<_> = output.split('\0').collect();
    fields
        .as_chunks::<7>()
        .0
        .iter()
        .map(|f| Commit {
            id: f[0].into(),
            parents: f[1].split_whitespace().map(str::to_owned).collect(),
            author: f[2].into(),
            email: f[3].into(),
            timestamp: f[4].parse().unwrap_or(0),
            refs: f[5]
                .split(", ")
                .filter(|s| !s.is_empty())
                .map(str::to_owned)
                .collect(),
            subject: f[6].into(),
        })
        .collect()
}

impl GitService {
    pub fn open(&self, path: &str) -> Result<Repository, String> {
        let root = root(path)?;
        let result = Repository {
            path: root.to_string_lossy().into(),
            name: root
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into(),
            branch: branch(&root)?,
        };
        self.repositories
            .lock()
            .map_err(|_| "Repository registry unavailable")?
            .entry(root)
            .or_default();
        Ok(result)
    }

    pub fn execute(&self, path: &str, request: Request) -> Result<Value, String> {
        let path = Path::new(path).canonicalize().map_err(|e| e.to_string())?;
        let lock = self
            .repositories
            .lock()
            .map_err(|_| "Repository registry unavailable")?
            .get(&path)
            .cloned()
            .ok_or("Open this repository before accessing it.")?;
        let _guard = lock
            .lock()
            .map_err(|_| "Repository operation unavailable")?;
        crate::workflow::check_allowed(&path, &request)?;
        match request {
            Request::Tool { command } => crate::tools::execute(&path, command),
            Request::Snapshot => {
                let files = parse_status(&git(
                    &path,
                    &[
                        "status",
                        "--porcelain=v1",
                        "-z",
                        "--untracked-files=all",
                        "--no-renames",
                    ],
                )?);
                let branches = git(
                    &path,
                    &[
                        "for-each-ref",
                        "--format=%(refname:short)%00%(HEAD)%00%(upstream:short)%00%(refname)",
                        "refs/heads",
                        "refs/remotes",
                    ],
                )?
                .lines()
                .filter_map(|line| {
                    let f: Vec<_> = line.split('\0').collect();
                    (f.len() == 4).then(|| Branch {
                        name: f[0].into(),
                        current: f[1] == "*",
                        upstream: f[2].into(),
                        remote: f[3].starts_with("refs/remotes/"),
                    })
                })
                .collect();
                let mut remotes = Vec::new();
                for name in git(&path, &["remote"])?.lines() {
                    let raw_url = git(&path, &["remote", "get-url", name])?;
                    let url = redact_url(raw_url.trim());
                    remotes.push(Remote {
                        name: name.into(),
                        url,
                    });
                }
                let stashes = git(&path, &["stash", "list", "--format=%H%x00%gs"])?
                    .lines()
                    .enumerate()
                    .filter_map(|(index, line)| {
                        line.split_once('\0').map(|(id, message)| Stash {
                            index,
                            id: id.into(),
                            message: message.into(),
                        })
                    })
                    .collect();
                Ok(json!(Snapshot {
                    branch: branch(&path)?,
                    files,
                    branches,
                    remotes,
                    stashes,
                    operation: crate::workflow::operation(&path)?,
                }))
            }
            Request::History { skip, reference } => {
                if skip > 1_000_000 {
                    return Err("History offset exceeds the supported range.".into());
                }
                if git(&path, &["rev-parse", "--verify", "HEAD"]).is_err() {
                    return Ok(json!([]));
                }
                let reference = reference.map(|r| revision(&path, &r)).transpose()?;
                let mut args = vec![
                    "log",
                    "--topo-order",
                    "-z",
                    "--format=%H%x00%P%x00%an%x00%ae%x00%at%x00%D%x00%s",
                    "--max-count=150",
                ];
                let skip_arg = format!("--skip={skip}");
                args.push(&skip_arg);
                if let Some(ref r) = reference {
                    args.push(r);
                } else {
                    args.push("--all");
                    args.push("HEAD");
                }
                args.push("--");
                Ok(json!(parse_history(&git(&path, &args)?)))
            }
            Request::CommitFiles {
                revision: reference,
            } => {
                let id = revision(&path, &reference)?;
                let output = git(
                    &path,
                    &[
                        "diff-tree",
                        "--root",
                        "--no-commit-id",
                        "--name-status",
                        "--no-renames",
                        "-r",
                        "-z",
                        &id,
                    ],
                )?;
                let fields: Vec<_> = output.split('\0').collect();
                let files: Vec<_> = fields
                    .as_chunks::<2>()
                    .0
                    .iter()
                    .map(|f| FileChange {
                        path: f[1].into(),
                        index: f[0].into(),
                        worktree: " ".into(),
                    })
                    .collect();
                // Merge changes are compared to the first parent, matching the diff viewer.
                if git(&path, &["rev-parse", "--verify", &format!("{id}^2")]).is_ok() {
                    return changed_between(&path, &format!("{id}^"), &id);
                }
                Ok(json!(files))
            }
            Request::Diff {
                revision: reference,
                file,
                staged,
            } => {
                validate_file(&file)?;
                let output = if let Some(reference) = reference {
                    let id = revision(&path, &reference)?;
                    if git(&path, &["rev-parse", "--verify", &format!("{id}^")]).is_ok() {
                        git(
                            &path,
                            &[
                                "diff",
                                "--no-ext-diff",
                                "--no-textconv",
                                "--no-renames",
                                &format!("{id}^"),
                                &id,
                                "--",
                                &file,
                            ],
                        )?
                    } else {
                        git(
                            &path,
                            &[
                                "show",
                                "--format=",
                                "--no-ext-diff",
                                "--no-textconv",
                                "--no-renames",
                                &id,
                                "--",
                                &file,
                            ],
                        )?
                    }
                } else if staged {
                    git(
                        &path,
                        &[
                            "diff",
                            "--cached",
                            "--no-ext-diff",
                            "--no-textconv",
                            "--no-renames",
                            "--",
                            &file,
                        ],
                    )?
                } else {
                    let tracked = git(&path, &["ls-files", "--error-unmatch", "--", &file]).is_ok();
                    if !tracked {
                        let target = path.join(&file).canonicalize().map_err(|e| e.to_string())?;
                        if !target.starts_with(&path) {
                            return Err("Cannot preview a file outside the repository.".into());
                        }
                        if std::fs::metadata(&target).map_err(|e| e.to_string())?.len() > 1_048_576
                        {
                            return Err("Untracked preview is limited to 1 MiB. Stage the file to inspect its Git diff.".into());
                        }
                        let data = std::fs::read(&target).map_err(|e| e.to_string())?;
                        if data.contains(&0) {
                            "Binary file — no text preview".into()
                        } else {
                            let content =
                                String::from_utf8(data).map_err(|_| "File is not UTF-8 text")?;
                            format!(
                                "--- /dev/null\n+++ b/{file}\n@@ -0,0 +1,{} @@\n{}",
                                content.lines().count(),
                                content
                                    .lines()
                                    .map(|l| format!("+{l}\n"))
                                    .collect::<String>()
                            )
                        }
                    } else {
                        git(
                            &path,
                            &[
                                "diff",
                                "--no-ext-diff",
                                "--no-textconv",
                                "--no-renames",
                                "--",
                                &file,
                            ],
                        )?
                    }
                };
                Ok(json!(output))
            }
            Request::Compare { base, head } => {
                let base = revision(&path, &base)?;
                let head = revision(&path, &head)?;
                Ok(json!(git(
                    &path,
                    &[
                        "diff",
                        "--no-ext-diff",
                        "--no-textconv",
                        "--stat",
                        &base,
                        &head,
                        "--"
                    ]
                )?))
            }
            Request::Stage { file } => {
                validate_file(&file)?;
                git(&path, &["add", "--", &file])?;
                Ok(json!(null))
            }
            Request::Unstage { file } => {
                validate_file(&file)?;
                if git(&path, &["rev-parse", "--verify", "HEAD"]).is_ok() {
                    git(&path, &["reset", "-q", "HEAD", "--", &file])?;
                } else {
                    git(&path, &["rm", "--cached", "--", &file])?;
                }
                Ok(json!(null))
            }
            Request::Commit { message } => {
                if message.trim().is_empty() || message.len() > 65536 {
                    return Err("Enter a commit message of 1–65536 bytes.".into());
                }
                git(&path, &["commit", "-m", &message])?;
                Ok(json!(null))
            }
            Request::CreateBranch { name } => {
                validate_branch(&path, &name)?;
                git(&path, &["branch", &name])?;
                Ok(json!(null))
            }
            Request::Checkout { name } => {
                validate_branch(&path, &name)?;
                git(
                    &path,
                    &["show-ref", "--verify", &format!("refs/heads/{name}")],
                )?;
                git(&path, &["switch", "--", &name])?;
                Ok(json!(null))
            }
            Request::StashSave { message } => {
                git(
                    &path,
                    &["stash", "push", "--include-untracked", "-m", &message],
                )?;
                Ok(json!(null))
            }
            Request::Fetch { remote } => {
                if !git(&path, &["remote"])?.lines().any(|r| r == remote) || remote.starts_with('-')
                {
                    return Err("Choose a configured remote.".into());
                }
                git(&path, &["fetch", &remote])?;
                Ok(json!(null))
            }
            Request::Pull => {
                let (remote, reference) = upstream(&path)?;
                git(
                    &path,
                    &[
                        "-c",
                        "merge.autoStash=false",
                        "-c",
                        "rebase.autoStash=false",
                        "pull",
                        "--no-rebase",
                        "--ff-only",
                        "--",
                        &remote,
                        &reference,
                    ],
                )?;
                Ok(json!(null))
            }
            Request::Push => {
                let (remote, reference) = upstream(&path)?;
                git(
                    &path,
                    &[
                        "-c",
                        &format!("remote.{remote}.mirror=false"),
                        "-c",
                        "push.followTags=false",
                        "push",
                        "--",
                        &remote,
                        &format!("HEAD:{reference}"),
                    ],
                )?;
                Ok(json!(null))
            }
            other => crate::workflow::execute(&path, other),
        }
    }
}

fn upstream(path: &Path) -> Result<(String, String), String> {
    let name = git(path, &["symbolic-ref", "--quiet", "HEAD"])?;
    let output = git(
        path,
        &[
            "for-each-ref",
            "--format=%(upstream:remotename)%00%(upstream:remoteref)",
            name.trim(),
        ],
    )?;
    let (remote, reference) = output
        .trim()
        .split_once('\0')
        .ok_or("No upstream configured. Set an upstream with Git before syncing.")?;
    if remote.is_empty() || remote.starts_with('-') || !reference.starts_with("refs/heads/") {
        return Err("Configure a branch upstream before syncing.".into());
    }
    Ok((remote.into(), reference.into()))
}

fn changed_between(path: &Path, base: &str, head: &str) -> Result<Value, String> {
    let output = git(
        path,
        &[
            "diff",
            "--no-renames",
            "--name-status",
            "-z",
            base,
            head,
            "--",
        ],
    )?;
    let fields: Vec<_> = output.split('\0').collect();
    Ok(json!(fields
        .as_chunks::<2>()
        .0
        .iter()
        .map(|f| FileChange {
            path: f[1].into(),
            index: f[0].into(),
            worktree: " ".into()
        })
        .collect::<Vec<_>>()))
}

fn redact_url(url: &str) -> String {
    if let Some((scheme, tail)) = url.split_once("://") {
        let authority_end = tail.find('/').unwrap_or(tail.len());
        if let Some(at) = tail[..authority_end].rfind('@') {
            return format!("{scheme}://{}", &tail[at + 1..]);
        }
    }
    url.into()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    fn fixture() -> (TempDir, GitService, String) {
        let dir = TempDir::new().unwrap();
        git(dir.path(), &["init", "-b", "main"]).unwrap();
        git(dir.path(), &["config", "user.name", "Test Author"]).unwrap();
        git(
            dir.path(),
            &["config", "user.email", "test@example.invalid"],
        )
        .unwrap();
        git(dir.path(), &["config", "commit.gpgsign", "false"]).unwrap();
        let service = GitService::default();
        let path = service.open(dir.path().to_str().unwrap()).unwrap().path;
        (dir, service, path)
    }
    #[test]
    fn commit_stage_diff_and_unstage_roundtrip() {
        let (dir, service, path) = fixture();
        let file = "a space ü.txt";
        std::fs::write(dir.path().join(file), "hello\n").unwrap();
        assert!(service
            .execute(
                &path,
                Request::Diff {
                    revision: None,
                    file: file.into(),
                    staged: false
                }
            )
            .unwrap()
            .as_str()
            .unwrap()
            .contains("+hello"));
        service
            .execute(&path, Request::Stage { file: file.into() })
            .unwrap();
        service
            .execute(&path, Request::Unstage { file: file.into() })
            .unwrap();
        service
            .execute(&path, Request::Stage { file: file.into() })
            .unwrap();
        service
            .execute(
                &path,
                Request::Commit {
                    message: "first commit".into(),
                },
            )
            .unwrap();
        let history = service
            .execute(
                &path,
                Request::History {
                    skip: 0,
                    reference: None,
                },
            )
            .unwrap();
        assert_eq!(history[0]["subject"], "first commit");
        assert_eq!(history.as_array().unwrap().len(), 1);
        assert!(service
            .execute(
                &path,
                Request::Diff {
                    revision: Some("HEAD".into()),
                    file: file.into(),
                    staged: false
                }
            )
            .unwrap()
            .as_str()
            .unwrap()
            .contains("+hello"));
        std::fs::write(dir.path().join(file), "changed\n").unwrap();
        service
            .execute(&path, Request::Stage { file: file.into() })
            .unwrap();
        service
            .execute(&path, Request::Unstage { file: file.into() })
            .unwrap();
        assert_eq!(
            std::fs::read_to_string(dir.path().join(file)).unwrap(),
            "changed\n"
        );
        let snapshot = service.execute(&path, Request::Snapshot).unwrap();
        assert_eq!(snapshot["files"][0]["worktree"], "M");
    }
    #[test]
    fn branches_stashes_and_literal_paths() {
        let (dir, service, path) = fixture();
        std::fs::write(dir.path().join("[one].txt"), "one\n").unwrap();
        std::fs::write(dir.path().join("o.txt"), "two\n").unwrap();
        service
            .execute(
                &path,
                Request::Stage {
                    file: "[one].txt".into(),
                },
            )
            .unwrap();
        assert_eq!(
            git(dir.path(), &["diff", "--cached", "--name-only"])
                .unwrap()
                .trim(),
            "[one].txt"
        );
        service
            .execute(
                &path,
                Request::Commit {
                    message: "initial".into(),
                },
            )
            .unwrap();
        service
            .execute(
                &path,
                Request::CreateBranch {
                    name: "feature/test".into(),
                },
            )
            .unwrap();
        service
            .execute(
                &path,
                Request::Checkout {
                    name: "feature/test".into(),
                },
            )
            .unwrap();
        assert_eq!(branch(dir.path()).unwrap(), "feature/test");
        service
            .execute(
                &path,
                Request::StashSave {
                    message: "save untracked".into(),
                },
            )
            .unwrap();
        assert!(!dir.path().join("o.txt").exists());
        service
            .execute(
                &path,
                Request::StashApply {
                    index: 0,
                    expected: revision(dir.path(), "stash@{0}").unwrap(),
                },
            )
            .unwrap();
        assert!(dir.path().join("o.txt").exists());
    }
    #[test]
    fn rejects_unopened_repository_and_unsafe_paths() {
        let (_dir, _service, path) = fixture();
        assert!(GitService::default()
            .execute(&path, Request::Snapshot)
            .is_err());
        for path in ["../secret", "/absolute", "", "a/../b"] {
            assert!(validate_file(path).is_err());
        }
        assert!(validate_file("nested/a file.txt").is_ok());
    }
    #[test]
    fn porcelain_handles_renames_spaces_and_newlines() {
        let files = parse_status("R  new name\0old name\0?? new\nline\0");
        assert_eq!(files.len(), 2);
        assert_eq!(files[1].path, "new\nline");
    }
    #[test]
    fn remote_credentials_are_redacted() {
        assert_eq!(
            redact_url("https://user:secret@example.com/repo"),
            "https://example.com/repo"
        );
        assert_eq!(redact_url("git@example.com:repo"), "git@example.com:repo");
    }
}
