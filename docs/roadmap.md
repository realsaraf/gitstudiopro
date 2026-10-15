# Scope and roadmap

## 0.1 alpha

Implemented: local repository opening, recent repositories, independent tabs,
paged/virtualized history, branch filters, loaded-commit search, commit/file
selection, unified/split text diffs, stage/unstage, commit, create/switch branch,
stash save/apply, remote listing/fetch, upstream pull/push, comparison statistics,
command palette, keyboard shortcuts, resizable panels, and 15 offline palettes.

## Next milestones

1. Clone/init flows, remote editing, branch tracking setup, full commit messages,
   rename presentation, and more complete conflict status.
2. Hunk/line staging, image/binary previews, syntax highlighting, blame, tags,
   full comparison diffs, and configurable external editors.
3. Merge/rebase/cherry-pick/revert workflows with recoverable operation state,
   worktree/submodule management, and stronger concurrency handling with other clients.
4. Direct GitHub / Enterprise PR review with OS-keychain credentials and host scoping.
5. Optional AI assistance with explicit context preview, per-endpoint credentials,
   no default provider, and no automatic source upload.
6. Signed Windows builds, notarized macOS builds, update delivery, accessibility
   audits, localization, and reproducible performance measurements.

## Known limits

- This is not complete Git Extensions feature parity or a stable release.
- Git must be installed and available to the app on PATH. macOS GUI launches may
  not inherit shell PATH; use the platform Git installation or launch from a shell.
- Only worktree repositories are supported; bare repositories are not a UI target.
- Non-UTF-8 output returns an explicit error. Very long output is refused at 16 MiB.
- Untracked file preview is limited to UTF-8 text up to 1 MiB. Binary files show a notice.
- Search covers loaded commits, not every commit in the repository. Graphs with
  many simultaneous lanes may be clipped to the graph column's 220px maximum.
- File changes are read as a whole patch; diff DOM rendering stops at 3,000 lines.
- Operations do not offer interactive credential/signing prompts. Configure your
  Git credential helper/SSH agent first; helpers or hooks can outlive a timeout.
- Pull and push require a configured upstream. Push does not configure one for you.
- Conflicts are displayed through Git errors/status; resolve them in an editor or
  terminal. No destructive resolution shortcuts are implemented.
- The smallest supported window is 1000 × 680. Large font settings favor scrolling
  over reducing text size. Repository tabs persist only during the app session.
- No web-hosted backend, analytics, cloud service, AI provider, or direct PR API.
- CI packages are unsigned development artifacts, not store-approved releases.

For validation evidence and platform distinctions, see [validation.md](validation.md).
