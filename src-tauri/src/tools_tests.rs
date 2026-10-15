use crate::{
    bootstrap::{create, CreateRepository},
    git::GitService,
    models::Request,
    process::git,
    tools::{execute, ToolRequest},
};
use serde_json::{json, Value};
use std::{fs, path::Path};
use tempfile::TempDir;
fn fixture() -> TempDir {
    let dir = TempDir::new().unwrap();
    let p = dir.path();
    git(p, &["init", "-b", "main"]).unwrap();
    for (k, v) in [
        ("user.name", "Fixture"),
        ("user.email", "fixture@example.invalid"),
        ("commit.gpgsign", "false"),
        ("core.autocrlf", "false"),
        ("core.hooksPath", ".git/no-hooks"),
    ] {
        git(p, &["config", k, v]).unwrap();
    }
    commit(p, "file.txt", "one\ntwo\nthree\n", "First\n\nComplete body");
    dir
}
fn commit(p: &Path, file: &str, contents: &str, message: &str) {
    fs::write(p.join(file), contents).unwrap();
    git(p, &["add", "--", file]).unwrap();
    git(p, &["commit", "-m", message]).unwrap();
}
fn call(p: &Path, action: &str, fields: Value) -> Result<Value, String> {
    let mut data = fields.as_object().unwrap().clone();
    data.insert("action".into(), json!(action));
    data.entry("confirmed").or_insert(json!(true));
    execute(
        p,
        serde_json::from_value::<ToolRequest>(Value::Object(data)).unwrap(),
    )
}
fn read(p: &Path, action: &str, fields: Value) -> String {
    call(p, action, fields).unwrap()["text"]
        .as_str()
        .unwrap()
        .into()
}
#[test]
fn inspection_preserves_full_messages_paths_and_file_contents() {
    let f = fixture();
    let p = f.path();
    assert!(read(p, "commitDetails", json!({"target":"HEAD"})).contains("Complete body"));
    assert!(read(p, "tree", json!({"target":"HEAD"})).contains("file.txt"));
    assert_eq!(
        read(
            p,
            "showFile",
            json!({"target":"HEAD","secondary":"file.txt"})
        ),
        "one\ntwo\nthree\n"
    );
    assert!(read(p, "blame", json!({"target":"file.txt"})).contains("Fixture"));
    assert!(read(p, "fileHistory", json!({"target":"file.txt"})).contains("Complete body"));
    assert!(read(p, "reflog", json!({})).contains("commit"));
    assert!(read(p, "statistics", json!({})).contains("fixture@example.invalid"));
    assert!(read(p, "largeFiles", json!({})).contains("file.txt"));
}
#[test]
fn bootstrap_initializes_clones_and_refuses_existing_destinations() {
    let f = fixture();
    let parent = TempDir::new().unwrap();
    for clone in [false, true] {
        let path = parent.path().join(if clone { "clone" } else { "init" });
        create(CreateRepository {
            destination: path.to_str().unwrap().into(),
            url: clone.then(|| f.path().to_str().unwrap().into()),
            branch: "main".into(),
            depth: 0,
            recursive: false,
            single_branch: false,
            bare: false,
        })
        .unwrap();
        assert_eq!(
            git(&path, &["symbolic-ref", "--short", "HEAD"])
                .unwrap()
                .trim(),
            "main"
        );
        assert!(create(CreateRepository {
            destination: path.to_str().unwrap().into(),
            url: None,
            branch: "main".into(),
            depth: 0,
            recursive: false,
            single_branch: false,
            bare: false
        })
        .is_err());
    }
}
#[test]
fn remotes_tags_tracking_and_network_modes() {
    let f = fixture();
    let p = f.path();
    let remote = TempDir::new().unwrap();
    git(remote.path(), &["init", "--bare"]).unwrap();
    call(
        p,
        "remoteAdd",
        json!({"target":"origin","secondary":remote.path()}),
    )
    .unwrap();
    call(
        p,
        "pushOptions",
        json!({"target":"origin","secondary":"main","mode":"normal","flag":true}),
    )
    .unwrap();
    call(p, "unsetUpstream", json!({"target":"main"})).unwrap();
    call(
        p,
        "setUpstream",
        json!({"target":"main","secondary":"origin/main"}),
    )
    .unwrap();
    call(
        p,
        "tagCreate",
        json!({"target":"v1","secondary":"HEAD","mode":"annotated","message":"Release"}),
    )
    .unwrap();
    assert!(read(p, "tags", json!({})).contains("Release"));
    call(p, "tagPush", json!({"target":"origin","secondary":"v1"})).unwrap();
    assert!(git(remote.path(), &["show-ref", "--verify", "refs/tags/v1"]).is_ok());
    call(
        p,
        "tagDeleteRemote",
        json!({"target":"origin","secondary":"v1"}),
    )
    .unwrap();
    call(p, "tagDelete", json!({"target":"v1"})).unwrap();
    call(p, "fetchOptions", json!({"flag":true,"extra":true})).unwrap();
    call(
        p,
        "remoteRename",
        json!({"target":"origin","secondary":"upstream"}),
    )
    .unwrap();
    call(
        p,
        "remoteEdit",
        json!({"target":"upstream","secondary":remote.path(),"flag":true}),
    )
    .unwrap();
    call(p, "remoteRemove", json!({"target":"upstream"})).unwrap();
    assert!(git(p, &["remote"]).unwrap().is_empty());
}
#[test]
fn reset_discard_clean_and_amend_require_review() {
    let f = fixture();
    let p = f.path();
    fs::write(p.join("file.txt"), "changed\n").unwrap();
    assert!(call(p, "discard", json!({"target":"file.txt","confirmed":false})).is_err());
    call(p, "discard", json!({"target":"file.txt"})).unwrap();
    assert!(fs::read_to_string(p.join("file.txt"))
        .unwrap()
        .contains("three"));
    fs::write(p.join("scratch.txt"), "scratch").unwrap();
    assert!(read(p, "cleanPreview", json!({})).contains("scratch.txt"));
    assert!(p.join("scratch.txt").exists());
    call(p, "clean", json!({"target":"scratch.txt"})).unwrap();
    assert!(!p.join("scratch.txt").exists());
    commit(p, "second.txt", "second", "Second");
    call(p, "reset", json!({"target":"HEAD~1","mode":"soft"})).unwrap();
    assert!(!git(p, &["diff", "--cached", "--name-only"])
        .unwrap()
        .is_empty());
    call(p, "amend", json!({"message":"Amended"})).unwrap();
    assert_eq!(
        git(p, &["log", "-1", "--format=%s"]).unwrap().trim(),
        "Amended"
    );
}
#[test]
fn editors_refuse_traversal_and_stale_writes_and_store_notes() {
    let f = fixture();
    let p = f.path();
    call(
        p,
        "editorSave",
        json!({"target":".gitignore","secondary":"","message":"cache/\n"}),
    )
    .unwrap();
    assert_eq!(
        read(p, "editorRead", json!({"target":".gitignore"})),
        "cache/\n"
    );
    assert!(call(
        p,
        "editorSave",
        json!({"target":".gitignore","secondary":"","message":"bad"})
    )
    .is_err());
    for path in ["../outside", ".git/config", "C:/outside"] {
        assert!(call(
            p,
            "conflictSave",
            json!({"target":path,"secondary":"","message":"bad"})
        )
        .is_err());
    }
    call(
        p,
        "notesSave",
        json!({"target":"HEAD","message":"Review note"}),
    )
    .unwrap();
    assert!(read(p, "notesShow", json!({"target":"HEAD"})).contains("Review note"));
    call(p, "notesRemove", json!({"target":"HEAD"})).unwrap();
    call(
        p,
        "configWrite",
        json!({"target":"rerere.enabled","message":"true","mode":"local"}),
    )
    .unwrap();
    assert_eq!(
        read(
            p,
            "configRead",
            json!({"target":"rerere.enabled","mode":"local"})
        )
        .trim(),
        "true"
    );
    assert!(call(
        p,
        "configWrite",
        json!({"target":"core.sshCommand","message":"evil","mode":"local"})
    )
    .is_err());
}
#[test]
fn worktree_sparse_and_bisect_round_trip() {
    let f = fixture();
    let p = f.path();
    let extra = TempDir::new().unwrap();
    let work = extra.path().join("linked");
    call(
        p,
        "worktreeAdd",
        json!({"target":work,"secondary":"linked","flag":true}),
    )
    .unwrap();
    assert!(read(p, "worktrees", json!({})).contains("linked"));
    call(p, "worktreeRemove", json!({"target":work})).unwrap();
    call(p, "worktreePrune", json!({})).unwrap();
    fs::create_dir(p.join("folder")).unwrap();
    commit(p, "folder/a.txt", "a", "Second");
    commit(p, "third.txt", "third", "Third");
    call(p, "sparseSet", json!({"message":"folder"})).unwrap();
    assert!(read(p, "sparseShow", json!({})).contains("folder"));
    call(p, "sparseDisable", json!({})).unwrap();
    call(
        p,
        "bisectStart",
        json!({"target":"HEAD","secondary":"HEAD~2"}),
    )
    .unwrap();
    assert!(read(p, "bisectStatus", json!({})).contains("bisect start"));
    call(p, "bisectGood", json!({})).unwrap();
    call(p, "bisectReset", json!({})).unwrap();
    assert_eq!(
        git(p, &["branch", "--show-current"]).unwrap().trim(),
        "main"
    );
}
#[test]
fn patch_export_apply_mail_recovery_and_archive() {
    let f = fixture();
    let p = f.path();
    commit(p, "new.txt", "hello\n", "Patch change");
    let patch = read(
        p,
        "compareDiff",
        json!({"target":"HEAD~1","secondary":"HEAD"}),
    );
    let mail = read(
        p,
        "patchExport",
        json!({"target":"HEAD~1","secondary":"HEAD","confirmed":false}),
    );
    call(p, "reset", json!({"target":"HEAD~1","mode":"hard"})).unwrap();
    assert!(read(p, "patchPreview", json!({"message":patch})).contains("new.txt"));
    call(p, "patchApply", json!({"message":patch})).unwrap();
    assert_eq!(fs::read_to_string(p.join("new.txt")).unwrap(), "hello\n");
    call(p, "reset", json!({"target":"HEAD","mode":"hard"})).unwrap();
    call(p, "mailApply", json!({"message":mail})).unwrap();
    assert_eq!(
        git(p, &["log", "-1", "--format=%s"]).unwrap().trim(),
        "Patch change"
    );
    let out = TempDir::new().unwrap();
    let archive = out.path().join("repo.zip");
    call(p, "archive", json!({"target":"HEAD","secondary":archive})).unwrap();
    assert!(fs::read(&archive).unwrap().starts_with(b"PK"));
    assert!(call(p, "archive", json!({"target":"HEAD","secondary":archive})).is_err());
}
#[test]
fn hunk_application_checks_staleness_and_keeps_other_changes() {
    let f = fixture();
    let p = f.path();
    fs::write(p.join("file.txt"), "ONE\ntwo\nTHREE\n").unwrap();
    let original = read(p, "hunkDiff", json!({"target":"file.txt"}));
    let partial="diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@ -1,3 +1,3 @@\n-one\n+ONE\n two\n three\n";
    assert!(call(
        p,
        "hunkApply",
        json!({"target":"file.txt","secondary":"stale","message":partial})
    )
    .is_err());
    call(
        p,
        "hunkApply",
        json!({"target":"file.txt","secondary":original,"message":partial}),
    )
    .unwrap();
    assert_eq!(git(p, &["show", ":file.txt"]).unwrap(), "ONE\ntwo\nthree\n");
    assert_eq!(
        fs::read_to_string(p.join("file.txt")).unwrap(),
        "ONE\ntwo\nTHREE\n"
    );
}
#[test]
fn conflict_editor_and_operation_gate() {
    let f = fixture();
    let p = f.path();
    git(p, &["switch", "-c", "other"]).unwrap();
    commit(p, "file.txt", "other\n", "Other");
    git(p, &["switch", "main"]).unwrap();
    commit(p, "file.txt", "main\n", "Main");
    assert!(call(p, "mergeOptions", json!({"target":"other","mode":"no-ff"})).is_err());
    let content = call(p, "conflictRead", json!({"target":"file.txt"})).unwrap();
    assert_eq!(content["ours"], "main\n");
    assert_eq!(content["theirs"], "other\n");
    call(
        p,
        "conflictSave",
        json!({"target":"file.txt","secondary":content["text"],"message":"resolved\n"}),
    )
    .unwrap();
    let service = GitService::default();
    let repo = service.open(p.to_str().unwrap()).unwrap();
    assert!(service
        .execute(
            &repo.path,
            Request::Tool {
                command: serde_json::from_value(
                    json!({"action":"reset","target":"HEAD","mode":"hard","confirmed":true})
                )
                .unwrap()
            }
        )
        .is_err());
    git(p, &["merge", "--abort"]).unwrap();
}

#[test]
fn advanced_commit_search_and_explicit_custom_program() {
    let f = fixture();
    let p = f.path();
    fs::write(p.join("author.txt"), "authored\n").unwrap();
    git(p, &["add", "author.txt"]).unwrap();
    call(p, "commitOptions", json!({"target":"Another Author <another@example.invalid>","secondary":"2025-01-02T03:04:05Z","message":"Searchable literal [change]","flag":true})).unwrap();
    // Verify the stored instant, independent of Git's ISO display spelling
    // (older Git emits +00:00; newer Git emits Z for UTC).
    let details = git(p, &["show", "--no-patch", "--format=%an%n%at%n%B", "HEAD"]).unwrap();
    assert!(details.contains("Another Author\n1735787045"), "{details}");
    assert!(details.contains("Signed-off-by: Fixture <fixture@example.invalid>"));
    assert!(read(
        p,
        "historySearch",
        json!({"target":"Another Author","secondary":"[change]","message":"author.txt"})
    )
    .contains("Searchable literal [change]"));
    assert!(read(p, "historySearch", json!({"target":"Unknown Author"}))
        .trim()
        .is_empty());
    let executable = std::env::current_exe().unwrap();
    assert!(call(
        p,
        "runScript",
        json!({"target":executable,"secondary":"--list","confirmed":false})
    )
    .is_err());
    assert!(read(
        p,
        "runScript",
        json!({"target":executable,"secondary":"--list"})
    )
    .contains("advanced_commit_search_and_explicit_custom_program"));
    #[cfg(windows)]
    {
        let batch = p.join("do-not-run.cmd");
        fs::write(&batch, "@echo off\necho unexpected>executed.txt\n").unwrap();
        assert!(call(p, "runScript", json!({"target":batch})).is_err());
        assert!(!p.join("executed.txt").exists());
    }
}
