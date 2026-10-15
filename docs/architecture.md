# Architecture

GitStudio Pro uses Tauri 2 with a Rust process boundary and a React / TypeScript
interface. The operating system supplies the WebView: WebView2 on Windows and
WKWebView on macOS. There is no bundled Node server or Electron runtime.

```text
React views / per-tab state
        │ typed invoke requests
        ▼
Tauri commands (async)
        │ spawn_blocking
        ▼
GitService → canonical repository registry → per-worktree mutex
        │ validated argument arrays
        ▼
Installed Git → local repository / configured remotes
```

## Boundaries

- `src/types.ts` defines the client data and request contracts.
- `src/api.ts` is the frontend access point for registered repository commands.
  A browser-only fixture adapter supports visual development. Its writes always
  fail; it cannot silently substitute for a failed native request.
- `src-tauri/src/models.rs` defines the serialized Rust contracts.
- `src-tauri/src/git.rs` owns repository registration and supported operations.
- `src-tauri/src/workflow.rs` handles history operations, Git operation-state
  detection, recovery, branch management, publishing, and stash identity checks.
- `src-tauri/src/process.rs` runs Git directly without a shell, drains both pipes,
  enforces payload/time limits, and returns errors to the UI.
- `tools.rs` defines the extended typed operation allowlist; `git-tools.ts` defines
  its searchable forms. `GitTools.tsx` owns review/confirmation and editor state.
- `bootstrap.rs` creates/clones repositories at new paths. `hosts.rs` handles
  explicit HTTP API calls and endpoint-scoped OS credentials, independently of Git.
- `partial-patch.ts` builds line selections into checked index patches. The backend
  compares the original diff again before applying to prevent stale selection writes.
- `src/components/Workspace.tsx` orchestrates repository views and stale-request
  suppression. Separate components own history, diffs, navigation, and dialogs.
- `src/lib/graph.ts` tracks pending parent lanes from the actual commit DAG.
- `src/lib/diff.ts` parses unified patches and aligns additions/removals for split view.

The Git CLI is intentional: it preserves users' existing SSH, credential-helper,
signing, filter, and hook configuration. Git is a required system dependency.
The Rust layer does not claim to be a reimplementation of Git or libgit2.

## Responsiveness

History requests load 150 commits per page in topological order. The frontend
renders only visible history rows plus eight rows of overscan on either side.
Diffs are fetched only for the selected file and render up to 3,000 parsed lines;
the full bounded patch remains available through Copy diff.

Git calls run on Tauri's blocking worker pool. Operations for the same worktree
serialize, while unrelated repositories can run independently. Activating a tab,
returning app focus, explicit refresh, or completing a write refreshes repository
data. There is no periodic polling or filesystem watcher in this version.

This architecture reduces avoidable work; it is not a benchmark result. Startup,
memory, and very large / wide-merge repositories need measured baselines before
performance claims or budgets are published.

## State

Each tab retains its own view, branch filter, history selection, and file selection
while mounted. Duplicate tabs share the real worktree and therefore share branch
and index changes. Async responses carry cancellation/generation checks so an
older selection cannot replace the currently requested diff or history.

Recent repository paths (up to 30), theme, font size, motion preference, and panel
sizes persist in local WebView storage. Open tabs are not restored across launches.
No credentials or source files are stored in those preferences. Custom tool
executable paths/arguments are local preferences; users must not save secrets in
arguments. GitHub tokens are held by the OS credential store, never WebView storage.

## Git behavior

- History includes local/remote refs and HEAD; filtering resolves a branch to a commit.
- Commit details use the first parent for merges, and the empty tree for root commits.
- Rename detection is disabled in the alpha, displaying a rename as delete + add.
- Status uses NUL-delimited porcelain output; filenames with spaces and Unicode
  do not depend on shell parsing.
- Unstage resets only the index path and preserves the working file. Unborn HEAD
  uses `git rm --cached` instead.
- Stash includes untracked files and apply keeps the saved stash.
- Default pull requires an upstream and refuses divergent history. Push explicitly sends
  HEAD to the current branch's upstream ref, overriding mirror/follow-tags settings.
- Merge, rebase, cherry-pick, and revert require a clean working tree and resolve
  the selected target to a commit before execution. Pick/revert refuse merge
  commits in the simple action. Advanced pick/revert offer explicit mainline selection.
- Snapshots expose Git's active operation markers, including those in linked
  worktrees. Failed operations also refresh the snapshot so conflicts and recovery
  controls appear immediately. Continue requires no unresolved index entries.
- Mutating commands unrelated to recovery are blocked during an active operation.
  Abort/skip are explicit UI actions; normal commits cannot bypass recovery.
- Stash apply/pop/drop include the selected object ID as well as its index and
  refuse a stale selection. Apply/pop require clean files; pop retains Git's
  normal conflict behavior. Normal branch deletion uses Git's merged-only check;
  force deletion is a separately confirmed tool.

Advanced pull supports merge/rebase. Push supports an explicit remote/destination,
force-with-lease using a captured tracking ID, and a separately chosen force mode.
Interactive rebase uses a one-purpose sequence-editor entry point in the executable;
the visual plan accepts only known actions and the original commit IDs. Linear
plans are supported; merge topology is rejected. At an edit stop, Amend is allowed
only when the index has no unresolved conflicts.

Host calls use the OS TLS implementation, disable redirects, and enforce 30-second
and 8-MiB limits. Credential lookup is serialized separately from network requests.
Reading settings does not send network requests. Publish controls display their
destination and require confirmation; PR merge includes the inspected head SHA.

See [SECURITY.md](../SECURITY.md) for the local trust model and execution limits.
