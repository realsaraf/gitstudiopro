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
    pub message: String,
}
#[derive(Serialize)]
pub struct Snapshot {
    pub branch: String,
    pub files: Vec<FileChange>,
    pub branches: Vec<Branch>,
    pub remotes: Vec<Remote>,
    pub stashes: Vec<Stash>,
}

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Request {
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
    },
    Fetch {
        remote: String,
    },
    Pull,
    Push,
}
