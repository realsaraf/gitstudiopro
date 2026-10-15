//! Real Git integration: no network and no access to the user's repositories.
use crate::{
    git::GitService,
    models::{Operation, OperationAction, Request},
    process::git,
};
use std::path::Path;
use tempfile::TempDir;

fn init(path: &Path) {
    git(path, &["init", "-b", "main"]).unwrap();
    git(path, &["config", "user.name", "Fixture Author"]).unwrap();
    git(path, &["config", "user.email", "fixture@example.invalid"]).unwrap();
    git(path, &["config", "commit.gpgsign", "false"]).unwrap();
    git(path, &["config", "core.autocrlf", "false"]).unwrap();
    git(path, &["config", "core.hooksPath", ".git/no-hooks"]).unwrap();
}
fn commit(path: &Path, name: &str, contents: &str) {
    std::fs::write(path.join(name), contents).unwrap();
    git(path, &["add", "--", name]).unwrap();
    git(path, &["commit", "-m", contents]).unwrap();
}

fn history_request(operation: Operation, target: &str) -> Request {
    match operation {
        Operation::Merge => Request::Merge {
            revision: target.into(),
        },
        Operation::Rebase => Request::Rebase {
            revision: target.into(),
        },
        Operation::CherryPick => Request::CherryPick {
            revision: target.into(),
        },
        Operation::Revert => Request::Revert {
            revision: target.into(),
        },
    }
}

#[test]
fn history_workflows_preserve_changes_and_recover_from_conflicts() {
    for operation in [
        Operation::Merge,
        Operation::Rebase,
        Operation::CherryPick,
        Operation::Revert,
    ] {
        let dir = TempDir::new().unwrap();
        init(dir.path());
        commit(dir.path(), "conflict.txt", "base\n");
        git(dir.path(), &["switch", "-c", "target"]).unwrap();
        commit(dir.path(), "conflict.txt", "target\n");
        let target = git(dir.path(), &["rev-parse", "HEAD"])
            .unwrap()
            .trim()
            .to_owned();
        if operation == Operation::Revert {
            commit(dir.path(), "conflict.txt", "later\n");
        } else {
            git(dir.path(), &["switch", "main"]).unwrap();
            commit(dir.path(), "conflict.txt", "local\n");
        }
        let before = git(dir.path(), &["rev-parse", "HEAD"]).unwrap();
        let original = std::fs::read_to_string(dir.path().join("conflict.txt")).unwrap();
        let service = GitService::default();
        let path = service.open(dir.path().to_str().unwrap()).unwrap().path;
        assert!(service
            .execute(&path, history_request(operation, &target))
            .is_err());
        let state = service.execute(&path, Request::Snapshot).unwrap();
        assert_eq!(state["operation"], operation.command());
        assert!(service
            .execute(
                &path,
                Request::Checkout {
                    name: "target".into()
                }
            )
            .is_err());
        assert!(service
            .execute(
                &path,
                Request::Operation {
                    operation,
                    action: OperationAction::Continue
                }
            )
            .is_err());
        service
            .execute(
                &path,
                Request::Operation {
                    operation,
                    action: OperationAction::Abort,
                },
            )
            .unwrap();
        assert_eq!(before, git(dir.path(), &["rev-parse", "HEAD"]).unwrap());
        assert_eq!(
            original,
            std::fs::read_to_string(dir.path().join("conflict.txt")).unwrap()
        );
        assert!(service
            .execute(&path, history_request(operation, &target))
            .is_err());
        std::fs::write(dir.path().join("conflict.txt"), "resolved\n").unwrap();
        service
            .execute(
                &path,
                Request::Stage {
                    file: "conflict.txt".into(),
                },
            )
            .unwrap();
        service
            .execute(
                &path,
                Request::Operation {
                    operation,
                    action: OperationAction::Continue,
                },
            )
            .unwrap();
        assert!(service.execute(&path, Request::Snapshot).unwrap()["operation"].is_null());
        assert_eq!(
            "resolved\n",
            std::fs::read_to_string(dir.path().join("conflict.txt")).unwrap()
        );
        assert!(git(dir.path(), &["status", "--porcelain"])
            .unwrap()
            .is_empty());
    }
}

#[test]
fn cherry_pick_and_rebase_skip_conflicting_commit() {
    for operation in [Operation::CherryPick, Operation::Rebase] {
        let dir = TempDir::new().unwrap();
        init(dir.path());
        commit(dir.path(), "file", "base");
        git(dir.path(), &["switch", "-c", "target"]).unwrap();
        commit(dir.path(), "file", "target");
        git(dir.path(), &["switch", "main"]).unwrap();
        commit(dir.path(), "file", "local");
        let service = GitService::default();
        let path = service.open(dir.path().to_str().unwrap()).unwrap().path;
        assert!(service
            .execute(&path, history_request(operation, "target"))
            .is_err());
        service
            .execute(
                &path,
                Request::Operation {
                    operation,
                    action: OperationAction::Skip,
                },
            )
            .unwrap();
        assert!(service.execute(&path, Request::Snapshot).unwrap()["operation"].is_null());
        assert_eq!(
            std::fs::read_to_string(dir.path().join("file")).unwrap(),
            if operation == Operation::Rebase {
                "target"
            } else {
                "local"
            }
        );
    }
}

#[test]
fn dirty_history_operations_and_stale_stashes_are_refused() {
    let dir = TempDir::new().unwrap();
    init(dir.path());
    commit(dir.path(), "file", "base");
    let service = GitService::default();
    let path = service.open(dir.path().to_str().unwrap()).unwrap().path;
    std::fs::write(dir.path().join("file"), "dirty").unwrap();
    for operation in [
        Operation::Merge,
        Operation::Rebase,
        Operation::CherryPick,
        Operation::Revert,
    ] {
        assert!(service
            .execute(&path, history_request(operation, "HEAD"))
            .unwrap_err()
            .contains("Commit or stash"));
    }
    service
        .execute(
            &path,
            Request::StashSave {
                message: "first".into(),
            },
        )
        .unwrap();
    let first = service.execute(&path, Request::Snapshot).unwrap()["stashes"][0]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    std::fs::write(dir.path().join("file"), "second").unwrap();
    service
        .execute(
            &path,
            Request::StashSave {
                message: "second".into(),
            },
        )
        .unwrap();
    assert!(service
        .execute(
            &path,
            Request::StashDrop {
                index: 0,
                expected: first.clone()
            }
        )
        .is_err());
    service
        .execute(
            &path,
            Request::StashDrop {
                index: 1,
                expected: first,
            },
        )
        .unwrap();
    let second = service.execute(&path, Request::Snapshot).unwrap()["stashes"][0]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    service
        .execute(
            &path,
            Request::StashPop {
                index: 0,
                expected: second,
            },
        )
        .unwrap();
    assert_eq!(
        std::fs::read_to_string(dir.path().join("file")).unwrap(),
        "second"
    );
    assert!(
        service.execute(&path, Request::Snapshot).unwrap()["stashes"]
            .as_array()
            .unwrap()
            .is_empty()
    );
}

#[test]
fn branch_publish_tracking_rename_delete_and_tag() {
    let remote = TempDir::new().unwrap();
    git(remote.path(), &["init", "--bare", "-b", "main"]).unwrap();
    let dir = TempDir::new().unwrap();
    init(dir.path());
    commit(dir.path(), "file", "base");
    git(
        dir.path(),
        &["remote", "add", "origin", remote.path().to_str().unwrap()],
    )
    .unwrap();
    let service = GitService::default();
    let path = service.open(dir.path().to_str().unwrap()).unwrap().path;
    service
        .execute(
            &path,
            Request::Publish {
                remote: "origin".into(),
            },
        )
        .unwrap();
    assert_eq!(
        git(dir.path(), &["rev-parse", "--abbrev-ref", "@{upstream}"])
            .unwrap()
            .trim(),
        "origin/main"
    );
    service
        .execute(
            &path,
            Request::TrackBranch {
                name: "tracked".into(),
                reference: "origin/main".into(),
            },
        )
        .unwrap();
    service
        .execute(
            &path,
            Request::RenameBranch {
                name: "tracked".into(),
                new_name: "renamed".into(),
            },
        )
        .unwrap();
    assert!(service
        .execute(
            &path,
            Request::DeleteBranch {
                name: "renamed".into()
            }
        )
        .is_err());
    service
        .execute(
            &path,
            Request::Checkout {
                name: "main".into(),
            },
        )
        .unwrap();
    service
        .execute(
            &path,
            Request::DeleteBranch {
                name: "renamed".into(),
            },
        )
        .unwrap();
    service
        .execute(
            &path,
            Request::CreateTag {
                name: "v-test".into(),
                revision: "HEAD".into(),
            },
        )
        .unwrap();
    assert_eq!(
        git(dir.path(), &["rev-parse", "v-test"]).unwrap(),
        git(dir.path(), &["rev-parse", "HEAD"]).unwrap()
    );
}
#[test]
fn push_only_updates_current_upstream_and_pull_refuses_divergence() {
    let remote = TempDir::new().unwrap();
    git(remote.path(), &["init", "--bare", "-b", "main"]).unwrap();
    let first = TempDir::new().unwrap();
    init(first.path());
    commit(first.path(), "first.txt", "initial");
    git(
        first.path(),
        &["remote", "add", "origin", remote.path().to_str().unwrap()],
    )
    .unwrap();
    git(first.path(), &["push", "-u", "origin", "main"]).unwrap();
    let service = GitService::default();
    let path = service.open(first.path().to_str().unwrap()).unwrap().path;
    git(first.path(), &["branch", "not-for-publishing"]).unwrap();
    git(first.path(), &["config", "push.default", "matching"]).unwrap();
    commit(first.path(), "first.txt", "second");
    service.execute(&path, Request::Push).unwrap();
    assert_eq!(
        git(
            remote.path(),
            &["for-each-ref", "--format=%(refname)", "refs/heads"]
        )
        .unwrap()
        .trim(),
        "refs/heads/main"
    );
    let other = TempDir::new().unwrap();
    git(
        other.path(),
        &["clone", remote.path().to_str().unwrap(), "."],
    )
    .unwrap();
    git(other.path(), &["config", "user.name", "Other"]).unwrap();
    git(
        other.path(),
        &["config", "user.email", "other@example.invalid"],
    )
    .unwrap();
    git(other.path(), &["config", "commit.gpgsign", "false"]).unwrap();
    commit(other.path(), "other.txt", "upstream change");
    git(other.path(), &["push"]).unwrap();
    service
        .execute(
            &path,
            Request::Fetch {
                remote: "origin".into(),
            },
        )
        .unwrap();
    service.execute(&path, Request::Pull).unwrap();
    assert!(first.path().join("other.txt").exists());
    commit(first.path(), "local.txt", "local change");
    commit(other.path(), "remote.txt", "remote change");
    git(other.path(), &["push"]).unwrap();
    let before = git(first.path(), &["rev-parse", "HEAD"]).unwrap();
    assert!(service.execute(&path, Request::Pull).is_err());
    assert_eq!(before, git(first.path(), &["rev-parse", "HEAD"]).unwrap());
}
#[test]
fn merge_details_compare_against_first_parent() {
    let temp = TempDir::new().unwrap();
    init(temp.path());
    commit(temp.path(), "base", "base");
    git(temp.path(), &["switch", "-c", "feature"]).unwrap();
    commit(temp.path(), "feature", "feature");
    git(temp.path(), &["switch", "main"]).unwrap();
    commit(temp.path(), "main", "main");
    git(
        temp.path(),
        &["merge", "--no-ff", "feature", "-m", "merge feature"],
    )
    .unwrap();
    let service = GitService::default();
    let path = service.open(temp.path().to_str().unwrap()).unwrap().path;
    let files = service
        .execute(
            &path,
            Request::CommitFiles {
                revision: "HEAD".into(),
            },
        )
        .unwrap();
    assert_eq!(files.as_array().unwrap().len(), 1);
    assert_eq!(files[0]["path"], "feature");
    let patch = service
        .execute(
            &path,
            Request::Diff {
                revision: Some("HEAD".into()),
                file: "feature".into(),
                staged: false,
            },
        )
        .unwrap();
    assert!(patch.as_str().unwrap().contains("+feature"));
    let history = service
        .execute(
            &path,
            Request::History {
                skip: 0,
                reference: None,
            },
        )
        .unwrap();
    assert_eq!(history[0]["parents"].as_array().unwrap().len(), 2);
    assert_eq!(history.as_array().unwrap().len(), 4);
}
#[test]
fn empty_repository_deletion_and_bad_arguments() {
    let temp = TempDir::new().unwrap();
    init(temp.path());
    let service = GitService::default();
    let path = service.open(temp.path().to_str().unwrap()).unwrap().path;
    assert_eq!(
        service
            .execute(
                &path,
                Request::History {
                    skip: 0,
                    reference: None
                }
            )
            .unwrap(),
        serde_json::json!([])
    );
    assert!(service
        .execute(
            &path,
            Request::CreateBranch {
                name: "--help".into()
            }
        )
        .is_err());
    assert!(service
        .execute(
            &path,
            Request::Compare {
                base: "--help".into(),
                head: "HEAD".into()
            }
        )
        .is_err());
    assert!(service
        .execute(
            &path,
            Request::Stage {
                file: "../outside".into()
            }
        )
        .is_err());
    commit(temp.path(), "delete me.txt", "initial");
    std::fs::remove_file(temp.path().join("delete me.txt")).unwrap();
    service
        .execute(
            &path,
            Request::Stage {
                file: "delete me.txt".into(),
            },
        )
        .unwrap();
    let snapshot = service.execute(&path, Request::Snapshot).unwrap();
    assert_eq!(snapshot["files"][0]["index"], "D");
    service
        .execute(
            &path,
            Request::Unstage {
                file: "delete me.txt".into(),
            },
        )
        .unwrap();
    assert!(!temp.path().join("delete me.txt").exists());
}
