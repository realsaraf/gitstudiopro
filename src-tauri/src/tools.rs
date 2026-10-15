//! Extended Git commands. The action enum is an allowlist, never a shell command.
//! All repository calls share GitService's lock and validate their own inputs.
use crate::{
    git::{revision, validate_branch, validate_file},
    process::{git, git_input},
    workflow,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
};

#[derive(Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ToolAction {
    RunScript,
    BranchForceDelete,
    CommitOptions,
    HistorySearch,
    ExternalDiff,
    ExternalMerge,
    ConfigList,
    CommitDetails,
    Tree,
    ShowFile,
    FileHistory,
    Blame,
    Reflog,
    CompareDiff,
    RemoteAdd,
    RemoteEdit,
    RemoteRename,
    RemoteRemove,
    SetUpstream,
    UnsetUpstream,
    FetchOptions,
    PullOptions,
    PushOptions,
    DeleteRemoteBranch,
    Tags,
    TagCreate,
    TagDelete,
    TagPush,
    TagDeleteRemote,
    CheckoutRevision,
    Reset,
    Discard,
    CleanPreview,
    Clean,
    Amend,
    Fixup,
    MergeOptions,
    RebaseOptions,
    RebasePlan,
    InteractiveRebase,
    PickOptions,
    RevertOptions,
    StashOptions,
    StashShow,
    StashBranch,
    Worktrees,
    WorktreeAdd,
    WorktreeRemove,
    WorktreePrune,
    Submodules,
    SubmoduleAdd,
    SubmoduleUpdate,
    SubmoduleSync,
    SubmoduleDeinit,
    SparseShow,
    SparseSet,
    SparseDisable,
    BisectStatus,
    BisectStart,
    BisectGood,
    BisectBad,
    BisectSkip,
    BisectReset,
    NotesShow,
    NotesSave,
    NotesRemove,
    ConfigRead,
    ConfigWrite,
    EditorRead,
    EditorSave,
    ConflictRead,
    ConflictSave,
    ConflictChoose,
    PatchPreview,
    PatchApply,
    PatchExport,
    MailApply,
    MailContinue,
    MailAbort,
    Archive,
    Verify,
    GarbageCollect,
    RecoverObjects,
    Statistics,
    LargeFiles,
    HunkDiff,
    HunkApply,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ToolRequest {
    pub action: ToolAction,
    #[serde(default)]
    pub target: String,
    #[serde(default)]
    pub secondary: String,
    #[serde(default)]
    pub message: String,
    #[serde(default)]
    pub mode: String,
    #[serde(default)]
    pub flag: bool,
    #[serde(default)]
    pub extra: bool,
    #[serde(default)]
    pub confirmed: bool,
}
impl ToolRequest {
    pub fn read_only(&self) -> bool {
        use ToolAction::*;
        matches!(
            self.action,
            CommitDetails
                | Tree
                | ShowFile
                | FileHistory
                | Blame
                | Reflog
                | CompareDiff
                | Tags
                | CleanPreview
                | RebasePlan
                | StashShow
                | Worktrees
                | Submodules
                | SparseShow
                | BisectStatus
                | NotesShow
                | ConfigRead
                | EditorRead
                | ConflictRead
                | PatchPreview
                | PatchExport
                | Verify
                | RecoverObjects
                | Statistics
                | LargeFiles
                | HunkDiff
                | HistorySearch
                | ConfigList
        )
    }
    pub fn allowed_during_operation(&self) -> bool {
        self.read_only()
            || matches!(
                self.action,
                ToolAction::ConflictSave
                    | ToolAction::ExternalMerge
                    | ToolAction::ConflictChoose
                    | ToolAction::MailContinue
                    | ToolAction::MailAbort
            )
    }
}
fn text(value: &str, name: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > 4096
        || value.contains(['\0', '\n', '\r'])
        || value.starts_with('-')
    {
        return Err(format!("Invalid {name}"));
    }
    Ok(())
}
fn remote(path: &Path, name: &str) -> Result<(), String> {
    text(name, "remote")?;
    if !git(path, &["remote"])?.lines().any(|r| r == name) {
        return Err("Choose a configured remote".into());
    }
    Ok(())
}
fn tag(path: &Path, name: &str) -> Result<(), String> {
    text(name, "tag")?;
    git(path, &["check-ref-format", &format!("refs/tags/{name}")])?;
    Ok(())
}
fn file_path(path: &Path, file: &str) -> Result<PathBuf, String> {
    validate_file(file)?;
    if file
        .split(['/', '\\'])
        .any(|part| part.eq_ignore_ascii_case(".git"))
    {
        return Err("Git administrative files cannot be edited here".into());
    }
    let candidate = path.join(file);
    let check = if candidate.exists() {
        candidate.canonicalize()
    } else {
        candidate.parent().ok_or("Missing parent")?.canonicalize()
    }
    .map_err(|e| e.to_string())?;
    if !check.starts_with(path.canonicalize().map_err(|e| e.to_string())?) {
        return Err("File resolves outside this repository".into());
    }
    Ok(candidate)
}
fn read_text(path: &Path) -> Result<String, String> {
    if fs::metadata(path).map_err(|e| e.to_string())?.len() > 1024 * 1024 {
        return Err("Editor is limited to 1 MiB text files".into());
    }
    fs::read_to_string(path).map_err(|e| format!("Cannot read UTF-8 text: {e}"))
}
fn write_text(path: &Path, content: &str) -> Result<(), String> {
    if content.len() > 1024 * 1024 {
        return Err("Editor is limited to 1 MiB".into());
    }
    fs::write(path, content).map_err(|e| e.to_string())
}
fn run(path: &Path, args: Vec<String>) -> Result<String, String> {
    git(path, &args.iter().map(String::as_str).collect::<Vec<_>>())
}
fn args(values: &[&str]) -> Vec<String> {
    values.iter().map(|s| (*s).into()).collect()
}
fn output(text: String) -> Value {
    json!({ "text": text })
}
fn selected_stash(path: &Path, reference: &str, expected: &str) -> Result<String, String> {
    if !reference.starts_with("stash@{")
        || !reference.ends_with('}')
        || !reference[7..reference.len() - 1]
            .chars()
            .all(|c| c.is_ascii_digit())
    {
        return Err("Choose a stash reference such as stash@{0}".into());
    }
    let id = revision(path, reference)?;
    if id != expected {
        return Err("Stash changed. Reload its preview first.".into());
    }
    Ok(id)
}

pub fn execute(path: &Path, command: ToolRequest) -> Result<Value, String> {
    use ToolAction::*;
    let c = command;
    if !c.read_only() && !c.confirmed {
        return Err("Review and confirm this operation first.".into());
    }
    let result = match c.action {
        RunScript => {
            let executable = Path::new(&c.target);
            if !executable.is_absolute() || !executable.is_file() {
                return Err("Choose an existing absolute executable path".into());
            }
            #[cfg(windows)]
            if !executable
                .extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("exe"))
            {
                return Err("Choose an .exe program. To run a script, select its interpreter executable and supply the script path as an argument.".into());
            }
            let arguments = c.secondary.lines().map(str::to_string).collect::<Vec<_>>();
            if arguments.len() > 100 || arguments.iter().any(|a| a.contains('\0')) {
                return Err("Invalid arguments".into());
            }
            crate::process::program(path, executable, &arguments)?
        }
        BranchForceDelete => {
            validate_branch(path, &c.target)?;
            git(path, &["branch", "-D", "--", &c.target])?
        }
        CommitOptions => {
            if c.message.trim().is_empty() {
                return Err("Commit message required".into());
            }
            let mut a = args(&["commit", "-m", &c.message]);
            if !c.target.is_empty() {
                a.push(format!("--author={}", c.target));
            }
            if !c.secondary.is_empty() {
                a.push(format!("--date={}", c.secondary));
            }
            if c.flag {
                a.push("--signoff".into());
            }
            if c.extra {
                a.push("--gpg-sign".into());
            }
            run(path, a)?
        }
        HistorySearch => {
            let mut a = args(&[
                "log",
                "--all",
                "-n",
                "500",
                "--date=iso",
                "--format=%h %ad %an%n%B",
            ]);
            if !c.target.is_empty() {
                a.push(format!("--author={}", c.target));
            }
            if !c.secondary.is_empty() {
                a.push(format!("--grep={}", c.secondary));
                a.push("--fixed-strings".into());
            }
            if !c.message.is_empty() {
                validate_file(&c.message)?;
                a.extend(args(&["--", &c.message]));
            }
            run(path, a)?
        }
        ExternalDiff => {
            validate_file(&c.target)?;
            let mut a = args(&["difftool", "--no-prompt"]);
            if c.flag {
                a.push("--cached".into());
            }
            a.extend(args(&["--", &c.target]));
            run(path, a)?
        }
        ExternalMerge => {
            file_path(path, &c.target)?;
            git(path, &["mergetool", "--no-prompt", "--", &c.target])?
        }
        ConfigList => {
            let scope = match c.mode.as_str() {
                "local" => "--local",
                "global" => "--global",
                _ => return Err("Choose scope".into()),
            };
            git(path, &["config", scope, "--list", "--show-origin"])?
        }
        CommitDetails => git(
            path,
            &[
                "show",
                "--no-patch",
                "--format=fuller",
                &revision(path, &c.target)?,
            ],
        )?,
        Tree => git(
            path,
            &["ls-tree", "-r", "--long", &revision(path, &c.target)?],
        )?,
        ShowFile => {
            validate_file(&c.secondary)?;
            git(
                path,
                &[
                    "show",
                    &format!(
                        "{}:{}",
                        revision(path, &c.target)?,
                        c.secondary.replace('\\', "/")
                    ),
                ],
            )?
        }
        FileHistory => {
            validate_file(&c.target)?;
            git(
                path,
                &[
                    "log",
                    "--follow",
                    "-n",
                    "200",
                    "--format=%h %ad %an%n%B",
                    "--date=short",
                    "--",
                    &c.target,
                ],
            )?
        }
        Blame => {
            validate_file(&c.target)?;
            git(
                path,
                &[
                    "blame",
                    "-w",
                    "--date=short",
                    &revision(
                        path,
                        if c.secondary.is_empty() {
                            "HEAD"
                        } else {
                            &c.secondary
                        },
                    )?,
                    "--",
                    &c.target,
                ],
            )?
        }
        Reflog => git(
            path,
            &["reflog", "show", "--all", "-n", "300", "--date=iso"],
        )?,
        CompareDiff => {
            let a = revision(path, &c.target)?;
            let b = revision(path, &c.secondary)?;
            git(
                path,
                &[
                    "diff",
                    "--no-ext-diff",
                    "--no-textconv",
                    if c.flag {
                        "--ignore-all-space"
                    } else {
                        "--find-renames"
                    },
                    if c.extra {
                        "--word-diff=plain"
                    } else {
                        "--patch"
                    },
                    &a,
                    &b,
                    "--",
                ],
            )?
        }
        RemoteAdd => {
            text(&c.target, "remote name")?;
            text(&c.secondary, "remote URL")?;
            git(path, &["remote", "add", "--", &c.target, &c.secondary])?
        }
        RemoteEdit => {
            remote(path, &c.target)?;
            text(&c.secondary, "remote URL")?;
            let mut a = args(&["remote", "set-url"]);
            if c.flag {
                a.push("--push".into());
            }
            a.extend(args(&["--", &c.target, &c.secondary]));
            run(path, a)?
        }
        RemoteRename => {
            remote(path, &c.target)?;
            text(&c.secondary, "remote name")?;
            git(path, &["remote", "rename", &c.target, &c.secondary])?
        }
        RemoteRemove => {
            remote(path, &c.target)?;
            git(path, &["remote", "remove", &c.target])?
        }
        SetUpstream => {
            validate_branch(path, &c.target)?;
            text(&c.secondary, "upstream")?;
            git(
                path,
                &[
                    "branch",
                    &format!("--set-upstream-to={}", c.secondary),
                    "--",
                    &c.target,
                ],
            )?
        }
        UnsetUpstream => {
            validate_branch(path, &c.target)?;
            git(path, &["branch", "--unset-upstream", "--", &c.target])?
        }
        FetchOptions => {
            let mut a = args(&["fetch"]);
            if c.target.is_empty() {
                a.push("--all".into());
            } else {
                remote(path, &c.target)?;
            }
            if c.flag {
                a.push("--prune".into());
            }
            if c.extra {
                a.push("--tags".into());
            }
            if !c.target.is_empty() {
                a.extend(args(&["--", &c.target]));
            }
            run(path, a)?
        }
        PullOptions => {
            workflow::clean(path)?;
            remote(path, &c.target)?;
            validate_branch(path, &c.secondary)?;
            let mode = match c.mode.as_str() {
                "merge" => "--no-rebase",
                "rebase" => "--rebase",
                "ff" => "--ff-only",
                _ => return Err("Choose pull mode".into()),
            };
            git(
                path,
                &[
                    "-c",
                    "merge.autoStash=false",
                    "-c",
                    "rebase.autoStash=false",
                    "pull",
                    mode,
                    "--no-edit",
                    "--",
                    &c.target,
                    &c.secondary,
                ],
            )?
        }
        PushOptions => {
            remote(path, &c.target)?;
            validate_branch(path, &c.secondary)?;
            let current = git(path, &["symbolic-ref", "--quiet", "--short", "HEAD"])?;
            validate_branch(path, current.trim())?;
            let mut a = args(&[
                "-c",
                &format!("remote.{}.mirror=false", c.target),
                "-c",
                "push.followTags=false",
                "push",
            ]);
            match c.mode.as_str() {
                "normal" => {}
                "lease" => {
                    let tracking = format!("refs/remotes/{}/{}", c.target, c.secondary);
                    let expected = revision(path, &tracking)?;
                    a.push(format!(
                        "--force-with-lease=refs/heads/{}:{}",
                        c.secondary, expected
                    ));
                }
                "force" => a.push("--force".into()),
                _ => return Err("Choose push mode".into()),
            };
            if c.flag {
                a.push("--set-upstream".into());
            }
            a.extend(args(&[
                "--",
                &c.target,
                &format!("HEAD:refs/heads/{}", c.secondary),
            ]));
            run(path, a)?
        }
        DeleteRemoteBranch => {
            remote(path, &c.target)?;
            validate_branch(path, &c.secondary)?;
            git(path, &["push", "--delete", "--", &c.target, &c.secondary])?
        }
        Tags => git(
            path,
            &[
                "for-each-ref",
                "--format=%(refname:short)  %(objectname:short)  %(subject)",
                "refs/tags",
            ],
        )?,
        TagCreate => {
            tag(path, &c.target)?;
            let id = revision(path, &c.secondary)?;
            let mut a = args(&["tag"]);
            match c.mode.as_str() {
                "lightweight" => a.push("--no-sign".into()),
                "annotated" | "signed" => {
                    if c.message.trim().is_empty() {
                        return Err("Tag message required".into());
                    }
                    a.extend(args(&[
                        if c.mode == "signed" { "-s" } else { "-a" },
                        "-m",
                        &c.message,
                    ]));
                }
                _ => return Err("Choose tag type".into()),
            };
            a.extend(args(&["--", &c.target, &id]));
            run(path, a)?
        }
        TagDelete => {
            tag(path, &c.target)?;
            git(path, &["tag", "-d", "--", &c.target])?
        }
        TagPush | TagDeleteRemote => {
            remote(path, &c.target)?;
            tag(path, &c.secondary)?;
            let reference = format!("refs/tags/{}", c.secondary);
            let spec = if c.action == TagDeleteRemote {
                format!(":{reference}")
            } else {
                format!("{reference}:{reference}")
            };
            git(
                path,
                &[
                    "-c",
                    &format!("remote.{}.mirror=false", c.target),
                    "push",
                    "--",
                    &c.target,
                    &spec,
                ],
            )?
        }
        CheckoutRevision => {
            workflow::clean(path)?;
            git(path, &["switch", "--detach", &revision(path, &c.target)?])?
        }
        Reset => {
            let mode = match c.mode.as_str() {
                "soft" => "--soft",
                "mixed" => "--mixed",
                "hard" => "--hard",
                _ => return Err("Choose reset mode".into()),
            };
            git(path, &["reset", mode, &revision(path, &c.target)?])?
        }
        Discard => {
            file_path(path, &c.target)?;
            git(path, &["restore", "--worktree", "--", &c.target])?
        }
        CleanPreview | Clean => {
            let mut a = args(&[
                "clean",
                if c.action == CleanPreview { "-n" } else { "-f" },
                "-d",
            ]);
            if c.flag {
                a.push("-x".into());
            }
            if !c.target.is_empty() {
                file_path(path, &c.target)?;
                a.extend(args(&["--", &c.target]));
            }
            run(path, a)?
        }
        Amend => {
            if c.message.trim().is_empty() {
                return Err("Commit message required".into());
            }
            let mut a = args(&["commit", "--amend", "-m", &c.message]);
            if c.flag {
                a.push("--reset-author".into());
            }
            run(path, a)?
        }
        Fixup => {
            let id = revision(path, &c.target)?;
            git(
                path,
                &["commit", if c.flag { "--squash" } else { "--fixup" }, &id],
            )?
        }
        MergeOptions => {
            workflow::clean(path)?;
            let id = revision(path, &c.target)?;
            let mut a = args(&["-c", "merge.autoStash=false", "merge", "--no-edit"]);
            a.push(
                match c.mode.as_str() {
                    "ff" => "--ff",
                    "no-ff" => "--no-ff",
                    "ff-only" => "--ff-only",
                    "squash" => "--squash",
                    _ => return Err("Choose merge mode".into()),
                }
                .into(),
            );
            if c.flag {
                a.push("--no-commit".into());
            }
            a.push(id);
            run(path, a)?
        }
        RebaseOptions => {
            workflow::clean(path)?;
            let target = revision(path, &c.target)?;
            let mut a = args(&[
                "-c",
                "rebase.autoStash=false",
                "-c",
                "rebase.updateRefs=false",
                "rebase",
                "--no-autostash",
            ]);
            if !c.secondary.is_empty() {
                a.extend(args(&["--onto", &revision(path, &c.secondary)?]));
            }
            if c.flag {
                a.push("--rebase-merges".into());
            }
            a.push(target);
            run(path, a)?
        }
        RebasePlan => {
            let id = revision(path, &c.target)?;
            if !git(path, &["rev-list", "--merges", &format!("{id}..HEAD")])?
                .trim()
                .is_empty()
            {
                return Err("This editor supports linear ranges. Use preserve-merges rebase for merge history.".into());
            }
            git(
                path,
                &[
                    "log",
                    "--reverse",
                    "--format=pick %H %s",
                    &format!("{id}..HEAD"),
                ],
            )?
        }
        InteractiveRebase => interactive_rebase(path, &c.target, &c.message)?,
        PickOptions | RevertOptions => {
            workflow::clean(path)?;
            let mut ids = Vec::new();
            for item in c.target.split_whitespace() {
                ids.push(revision(path, item)?);
            }
            if ids.is_empty() || ids.len() > 200 {
                return Err("Select 1–200 commit IDs".into());
            }
            let mut a = args(&[
                if c.action == PickOptions {
                    "cherry-pick"
                } else {
                    "revert"
                },
                "--no-edit",
            ]);
            if c.flag {
                a.push("--no-commit".into());
            }
            if c.extra && c.action == PickOptions {
                a.push("-x".into());
            }
            if !c.secondary.is_empty() {
                let parent = c
                    .secondary
                    .parse::<u32>()
                    .map_err(|_| "Mainline must be a parent number")?;
                if parent == 0 {
                    return Err("Mainline starts at 1".into());
                }
                a.extend(args(&["-m", &parent.to_string()]));
            }
            a.extend(ids);
            run(path, a)?
        }
        StashOptions => {
            let mut a = args(&["stash", "push", "-m", &c.message]);
            if c.flag {
                a.push("--include-untracked".into());
            }
            if c.extra {
                a.push("--keep-index".into());
            }
            if !c.target.is_empty() {
                file_path(path, &c.target)?;
                a.extend(args(&["--", &c.target]));
            }
            run(path, a)?
        }
        StashShow => {
            text(&c.target, "stash")?;
            let id = revision(path, &c.target)?;
            return Ok(
                json!({"text":git(path,&["stash","show","--include-untracked","-p",&id])?,"id":id}),
            );
        }
        StashBranch => {
            workflow::clean(path)?;
            validate_branch(path, &c.secondary)?;
            selected_stash(path, &c.target, &c.message)?;
            git(path, &["stash", "branch", &c.secondary, &c.target])?
        }
        Worktrees => git(path, &["worktree", "list", "--porcelain"])?,
        WorktreeAdd => {
            text(&c.target, "destination")?;
            text(&c.secondary, "branch")?;
            let mut a = args(&["worktree", "add"]);
            if c.flag {
                validate_branch(path, &c.secondary)?;
                a.extend(args(&["-b", &c.secondary, "--", &c.target]));
            } else {
                a.extend(args(&["--", &c.target, &c.secondary]));
            }
            run(path, a)?
        }
        WorktreeRemove => {
            text(&c.target, "worktree path")?;
            git(path, &["worktree", "remove", "--", &c.target])?
        }
        WorktreePrune => git(path, &["worktree", "prune", "--verbose"])?,
        Submodules => git(path, &["submodule", "status", "--recursive"])?,
        SubmoduleAdd => {
            text(&c.target, "URL")?;
            validate_file(&c.secondary)?;
            git(path, &["submodule", "add", "--", &c.target, &c.secondary])?
        }
        SubmoduleUpdate | SubmoduleSync => {
            let mut a = args(&[
                "submodule",
                if c.action == SubmoduleUpdate {
                    "update"
                } else {
                    "sync"
                },
                "--recursive",
            ]);
            if c.action == SubmoduleUpdate {
                a.push("--init".into());
                if c.flag {
                    a.push("--remote".into());
                }
            }
            if !c.target.is_empty() {
                file_path(path, &c.target)?;
                a.extend(args(&["--", &c.target]));
            }
            run(path, a)?
        }
        SubmoduleDeinit => {
            file_path(path, &c.target)?;
            git(path, &["submodule", "deinit", "--", &c.target])?
        }
        SparseShow => git(path, &["sparse-checkout", "list"])?,
        SparseSet => {
            workflow::clean(path)?;
            let mut a = args(&["sparse-checkout", "set", "--cone", "--"]);
            for line in c.message.lines().filter(|l| !l.trim().is_empty()) {
                validate_file(line)?;
                a.push(line.into());
            }
            if a.len() == 4 {
                return Err("Enter at least one directory".into());
            }
            run(path, a)?
        }
        SparseDisable => {
            workflow::clean(path)?;
            git(path, &["sparse-checkout", "disable"])?
        }
        BisectStatus => git(path, &["bisect", "log"])?,
        BisectStart => {
            workflow::clean(path)?;
            git(
                path,
                &[
                    "bisect",
                    "start",
                    &revision(path, &c.target)?,
                    &revision(path, &c.secondary)?,
                ],
            )?
        }
        BisectGood | BisectBad | BisectSkip | BisectReset => {
            workflow::clean(path)?;
            git(
                path,
                &[
                    "bisect",
                    match c.action {
                        BisectGood => "good",
                        BisectBad => "bad",
                        BisectSkip => "skip",
                        _ => "reset",
                    },
                ],
            )?
        }
        NotesShow => git(path, &["notes", "show", &revision(path, &c.target)?])?,
        NotesSave => git(
            path,
            &[
                "notes",
                "add",
                "-f",
                "-m",
                &c.message,
                &revision(path, &c.target)?,
            ],
        )?,
        NotesRemove => git(path, &["notes", "remove", &revision(path, &c.target)?])?,
        ConfigRead | ConfigWrite => {
            let keys = [
                "user.name",
                "user.email",
                "user.signingkey",
                "commit.gpgsign",
                "core.autocrlf",
                "core.ignorecase",
                "pull.rebase",
                "fetch.prune",
                "push.default",
                "merge.conflictstyle",
                "rerere.enabled",
            ];
            if !keys.contains(&c.target.as_str()) {
                return Err("Choose a supported configuration key".into());
            }
            let scope = match c.mode.as_str() {
                "local" => "--local",
                "global" => "--global",
                _ => return Err("Choose local or global scope".into()),
            };
            if c.action == ConfigRead {
                git(path, &["config", scope, "--get", &c.target])?
            } else {
                git(path, &["config", scope, &c.target, &c.message])?
            }
        }
        EditorRead | EditorSave => {
            if ![".gitignore", ".gitattributes", ".mailmap"].contains(&c.target.as_str()) {
                return Err("Choose .gitignore, .gitattributes, or .mailmap".into());
            }
            let file = file_path(path, &c.target)?;
            if c.action == EditorRead {
                if file.exists() {
                    read_text(&file)?
                } else {
                    String::new()
                }
            } else {
                let old = if file.exists() {
                    read_text(&file)?
                } else {
                    String::new()
                };
                if old != c.secondary {
                    return Err("File changed outside the editor. Reload before saving.".into());
                }
                write_text(&file, &c.message)?;
                "File saved; review and stage it in Working changes.".into()
            }
        }
        ConflictRead => {
            let file = file_path(path, &c.target)?;
            let content = read_text(&file)?;
            let stage = |n| {
                git(
                    path,
                    &["show", &format!(":{n}:{}", c.target.replace('\\', "/"))],
                )
                .unwrap_or_default()
            };
            return Ok(json!({"text":content,"base":stage(1),"ours":stage(2),"theirs":stage(3)}));
        }
        ConflictSave => {
            let file = file_path(path, &c.target)?;
            if read_text(&file)? != c.secondary {
                return Err("File changed. Reload the conflict before saving.".into());
            }
            write_text(&file, &c.message)?;
            "Resolution saved. Review it, then stage the file.".into()
        }
        ConflictChoose => {
            file_path(path, &c.target)?;
            let side = match c.mode.as_str() {
                "ours" => "--ours",
                "theirs" => "--theirs",
                _ => return Err("Choose ours or theirs".into()),
            };
            git(path, &["checkout", side, "--", &c.target])?
        }
        PatchPreview | PatchApply => {
            if c.message.len() > 1024 * 1024 {
                return Err("Patch exceeds 1 MiB".into());
            }
            let mut a = args(&["apply"]);
            if c.action == PatchPreview {
                a.extend(args(&["--stat", "--summary"]));
            } else {
                a.push("--index".into());
            }
            git_input(
                path,
                &a.iter().map(String::as_str).collect::<Vec<_>>(),
                Some(&c.message),
                &[],
            )?
        }
        PatchExport => {
            let base = revision(path, &c.target)?;
            let head = revision(path, &c.secondary)?;
            git(
                path,
                &["format-patch", "--stdout", &format!("{base}..{head}")],
            )?
        }
        MailApply => {
            workflow::clean(path)?;
            git_input(path, &["am", "--3way"], Some(&c.message), &[])?
        }
        MailContinue => git(path, &["am", "--continue"])?,
        MailAbort => git(path, &["am", "--abort"])?,
        Archive => {
            let id = revision(path, &c.target)?;
            text(&c.secondary, "archive destination")?;
            let dest = Path::new(&c.secondary);
            if dest.exists() {
                return Err("Choose a new archive filename".into());
            }
            git(
                path,
                &[
                    "archive",
                    "--format=zip",
                    &format!("--output={}", c.secondary),
                    &id,
                ],
            )?
        }
        Verify => git(path, &["fsck", "--full"])?,
        GarbageCollect => git(path, &["gc"])?,
        RecoverObjects => git(path, &["fsck", "--no-reflogs", "--unreachable"])?,
        Statistics => git(path, &["shortlog", "--all", "-sne"])?,
        LargeFiles => {
            let tree = git(path, &["ls-tree", "-r", "-l", "HEAD"])?;
            let mut lines: Vec<_> = tree.lines().collect();
            lines.sort_by_key(|l| {
                std::cmp::Reverse(
                    l.split_whitespace()
                        .nth(3)
                        .and_then(|s| s.parse::<u64>().ok())
                        .unwrap_or(0),
                )
            });
            lines.into_iter().take(100).collect::<Vec<_>>().join("\n")
        }
        HunkDiff => {
            validate_file(&c.target)?;
            let mut a = args(&["diff", "--no-ext-diff", "--no-textconv", "--no-color"]);
            if c.flag {
                a.push("--cached".into());
            }
            a.extend(args(&["--", &c.target]));
            run(path, a)?
        }
        HunkApply => {
            validate_file(&c.target)?;
            let mut diff = args(&["diff", "--no-ext-diff", "--no-textconv", "--no-color"]);
            if c.flag {
                diff.push("--cached".into());
            }
            diff.extend(args(&["--", &c.target]));
            if run(path, diff)? != c.secondary {
                return Err("Diff changed. Reload before staging lines.".into());
            }
            let mut a = args(&["apply", "--cached", "--recount", "--unidiff-zero"]);
            if c.flag {
                a.push("--reverse".into());
            }
            let mut check = a.clone();
            check.push("--check".into());
            git_input(
                path,
                &check.iter().map(String::as_str).collect::<Vec<_>>(),
                Some(&c.message),
                &[],
            )?;
            git_input(
                path,
                &a.iter().map(String::as_str).collect::<Vec<_>>(),
                Some(&c.message),
                &[],
            )?
        }
    };
    Ok(output(result))
}

fn interactive_rebase(path: &Path, base: &str, plan: &str) -> Result<String, String> {
    workflow::clean(path)?;
    let base = revision(path, base)?;
    if !git(path, &["rev-list", "--merges", &format!("{base}..HEAD")])?
        .trim()
        .is_empty()
    {
        return Err("Interactive editor requires a linear range".into());
    }
    let commits = git(path, &["rev-list", &format!("{base}..HEAD")])?;
    let mut seen = std::collections::HashSet::new();
    let mut normalized = String::new();
    for line in plan.lines().filter(|line| !line.trim().is_empty()) {
        let mut fields = line.splitn(3, ' ');
        let action = fields.next().unwrap_or("");
        let id = fields.next().unwrap_or("");
        if !["pick", "drop", "edit", "squash", "fixup"].contains(&action)
            || !commits.lines().any(|c| c == id)
            || !seen.insert(id)
        {
            return Err(
                "Plan must contain each commit once, with pick/drop/edit/squash/fixup actions"
                    .into(),
            );
        }
        if seen.len() == 1 && ["squash", "fixup"].contains(&action) {
            return Err("First commit cannot be squashed or fixed up".into());
        }
        normalized.push_str(&format!("{action} {id} {}\n", fields.next().unwrap_or("")));
    }
    if seen.len() != commits.lines().count() || seen.is_empty() {
        return Err("Plan must include every commit; use drop to remove one".into());
    }
    let admin = git(path, &["rev-parse", "--absolute-git-dir"])?;
    let plan_path = Path::new(admin.trim()).join("gitstudiopro-rebase-plan");
    fs::write(&plan_path, normalized).map_err(|e| e.to_string())?;
    let exe = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .replace('\\', "/");
    // Git invokes editors through its shell; quote only the application path.
    let quoted = format!(
        "'{}' --gitstudiopro-sequence-editor",
        exe.replace('\'', "'\\''")
    );
    let plan_string = plan_path.to_string_lossy();
    let result = git_input(
        path,
        &[
            "-c",
            "rebase.updateRefs=false",
            "rebase",
            "--interactive",
            "--no-autostash",
            &base,
        ],
        None,
        &[
            ("GIT_SEQUENCE_EDITOR", &quoted),
            ("GITSTUDIO_REBASE_PLAN", &plan_string),
        ],
    );
    let _ = fs::remove_file(plan_path);
    result
}

/// Invoked only by Git's sequence editor, before the desktop runtime starts.
pub fn sequence_editor() -> bool {
    let mut args = std::env::args();
    let _ = args.next();
    if args.next().as_deref() != Some("--gitstudiopro-sequence-editor") {
        return false;
    }
    let result = (|| {
        let destination = args.next().ok_or("Missing todo path")?;
        let plan = std::env::var("GITSTUDIO_REBASE_PLAN").map_err(|_| "Missing plan")?;
        fs::copy(plan, destination).map_err(|_| "Could not write plan")?;
        Ok::<_, &str>(())
    })();
    if result.is_err() {
        std::process::exit(1);
    }
    true
}
