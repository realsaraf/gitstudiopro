use serde::{Deserialize, Serialize};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Repository {
    pub path: String,
    pub name: String,
    pub branch: String,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Commit {
    pub id: String,
    pub parents: Vec<String>,
    pub author: String,
    pub email: String,
    pub timestamp: i64,
    pub refs: Vec<String>,
    pub subject: String,
}
#[derive(Serialize, Debug)]
pub struct FileChange {
    pub path: String,
    pub index: String,
    pub worktree: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Branch {
    pub name: String,
    pub current: bool,
    pub remote: bool,
    pub upstream: String,
}
#[derive(Serialize)]
pub struct Remote {
    pub name: String,
    pub url: String,
}
#[derive(Serialize)]
pub struct Stash {
    pub index: usize,
    pub id: String,
    pub message: String,
}
#[derive(Serialize)]
pub struct Snapshot {
    pub branch: String,
    pub files: Vec<FileChange>,
    pub branches: Vec<Branch>,
    pub remotes: Vec<Remote>,
    pub stashes: Vec<Stash>,
    pub operation: Option<Operation>,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone, Copy)]
#[serde(rename_all = "kebab-case")]
pub enum Operation {
    Am,
    Merge,
    Rebase,
    CherryPick,
    Revert,
}
impl Operation {
    pub fn command(self) -> &'static str {
        match self {
            Self::Am => "am",
            Self::Merge => "merge",
            Self::Rebase => "rebase",
            Self::CherryPick => "cherry-pick",
            Self::Revert => "revert",
        }
    }
}
#[derive(Deserialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub enum OperationAction {
    Continue,
    Abort,
    Skip,
}

#[derive(Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Request {
    Tool {
        command: crate::tools::ToolRequest,
    },
    Snapshot,
    History {
        skip: usize,
        reference: Option<String>,
    },
    CommitFiles {
        revision: String,
    },
    Diff {
        revision: Option<String>,
        file: String,
        staged: bool,
    },
    Compare {
        base: String,
        head: String,
    },
    Stage {
        file: String,
    },
    Unstage {
        file: String,
    },
    Commit {
        message: String,
    },
    CreateBranch {
        name: String,
    },
    Checkout {
        name: String,
    },
    StashSave {
        message: String,
    },
    StashApply {
        index: usize,
        expected: String,
    },
    StashPop {
        index: usize,
        expected: String,
    },
    StashDrop {
        index: usize,
        expected: String,
    },
    RenameBranch {
        name: String,
        new_name: String,
    },
    DeleteBranch {
        name: String,
    },
    TrackBranch {
        name: String,
        reference: String,
    },
    CreateBranchAt {
        name: String,
        revision: String,
    },
    Publish {
        remote: String,
    },
    Merge {
        revision: String,
    },
    Rebase {
        revision: String,
    },
    CherryPick {
        revision: String,
    },
    Revert {
        revision: String,
    },
    CreateTag {
        name: String,
        revision: String,
    },
    StageAll,
    UnstageAll,
    Operation {
        operation: Operation,
        action: OperationAction,
    },
    Fetch {
        remote: String,
    },
    Pull,
    Push,
}
