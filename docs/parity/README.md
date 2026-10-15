# Git Extensions parity audit

**Full Git Extensions parity is the target, not the current state.** A working
button is not equivalent to the complete upstream dialog and its options. This
matrix distinguishes the implemented subset, native UI evidence, and missing
behavior. It must not be used to claim feature-complete replacement status.

## Source baseline and method

The upstream repository was cloned and inspected on October 15, 2026 at
[`813f48be0d91699124f61a1fa6c0fd5e376d3b81`](https://github.com/gitextensions/gitextensions/tree/813f48be0d91699124f61a1fa6c0fd5e376d3b81).
The clone is a separate reference checkout, not vendored into GitStudio Pro.
No Git Extensions implementation code was copied into this implementation.

The reproducible [source inventory](upstream-inventory.json) records **237 literal
menu entries, 91 dialog classes, 98 public GitUICommands entry points, and 173
controls in selected operation dialogs**, with source paths and line numbers.
These overlap and are **not feature counts or a completion percentage**. Dynamic
menus, plugins, translated resources, and dialog option combinations still need
manual assessment; an inventory alone does not certify exhaustive parity.

Regenerate against the pinned checkout:

```sh
node scripts/audit-upstream.mjs /path/to/gitextensions
```

Key inspected sources:

- [Main menus](https://github.com/gitextensions/gitextensions/blob/813f48be0d91699124f61a1fa6c0fd5e376d3b81/src/app/GitUI/CommandsDialogs/FormBrowse.Designer.cs)
- [Command implementations and dispatch](https://github.com/gitextensions/gitextensions/blob/813f48be0d91699124f61a1fa6c0fd5e376d3b81/src/app/GitUI/GitUICommands.cs)
- [Revision-grid menu commands](https://github.com/gitextensions/gitextensions/blob/813f48be0d91699124f61a1fa6c0fd5e376d3b81/src/app/GitUI/UserControls/RevisionGrid/RevisionGridMenuCommands.cs)
- [Rebase options](https://github.com/gitextensions/gitextensions/blob/813f48be0d91699124f61a1fa6c0fd5e376d3b81/src/app/GitUI/CommandsDialogs/FormRebase.Designer.cs)
- [Cherry-pick options](https://github.com/gitextensions/gitextensions/blob/813f48be0d91699124f61a1fa6c0fd5e376d3b81/src/app/GitUI/CommandsDialogs/FormCherryPick.Designer.cs)
- [Stash options](https://github.com/gitextensions/gitextensions/blob/813f48be0d91699124f61a1fa6c0fd5e376d3b81/src/app/GitUI/CommandsDialogs/FormStash.Designer.cs)
- [Push options](https://github.com/gitextensions/gitextensions/blob/813f48be0d91699124f61a1fa6c0fd5e376d3b81/src/app/GitUI/CommandsDialogs/FormPush.Designer.cs)

## Current coverage

The Windows native suites drive real WebView2 controls and Rust IPC against
throwaway repositories. `native-workflows.mjs` covers the original 23 scenarios;
`native-tools.mjs` covers extended operations. `native-hosts.mjs` runs through the
latter harness against a **loopback HTTP fixture**, not a live provider. See
[validation](../validation.md) for the latest run and its limitations.

“Implemented” identifies available controls, not exhaustive upstream parity.
Option combinations, platform behavior and provider behavior need separate evidence.

| Area                     | Implemented controls                                                                                                            | Remaining parity                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Open/recent repositories | Tabs, recent paths, directory selection                                                                                         | Dashboard categories and cross-launch tab restoration                                     |
| Clone/init               | New destination, branch, shallow depth, recursive, single branch, bare creation                                                 | Existing-directory initialization, full upstream clone options                            |
| History                  | Virtualized graph, refs, branch filters, loaded search, all-ref author/message/path search                                      | Full ordering/decorations, advanced navigation, unlimited search results                  |
| Commit/tree              | Full messages/metadata, recursive tree listing, revision file text                                                              | Interactive tree navigation, signature presentation, binary/image preview                 |
| Diff                     | Split/unified text, full revision comparison, word/whitespace options, configured external difftool                             | Syntax highlighting, image/binary comparison, complete upstream option set                |
| Staging                  | Files/all, selected lines and hunks, selected-line unstaging with stale-diff checks                                             | All rename/binary/untracked partial-selection combinations                                |
| Commit                   | Commit, amend, fixup/squash commits, author/date, sign-off, configured signing                                                  | Templates and interactive signing prompts                                                 |
| Reset/discard/clean      | Soft/mixed/hard reset, selected tracked-file discard, clean preview/execute with ignored option                                 | Dedicated undo workflow and richer multi-selection                                        |
| Branches                 | Create/switch/rename/delete/force-delete, detached revision, remote delete, upstream set/unset, publish                         | Full batch/refspec editing and upstream dialog combinations                               |
| Fetch/pull/push          | Fetch all/prune/tags, ff/merge/rebase pull, push normal/lease/force, upstream setup                                             | Multi-branch/refspec/URL destinations, autostash and all provider authentication flows    |
| Remotes                  | List/add/edit fetch or push URL/rename/remove                                                                                   | Multiple URLs, fetch refspec editor, advanced transport options                           |
| Merge                    | ff/no-ff/ff-only/squash, stop-before-commit, recovery                                                                           | Strategy and strategy-option controls                                                     |
| Rebase                   | Ordinary/onto/preserve-merges; visual linear pick/edit/drop/reorder/squash/fixup plan; continue/abort/skip                      | Interactive merge topology, reword without edit stop, autosquash, date/update-ref options |
| Cherry-pick/revert       | Ordered multiple IDs, mainline parent, no-commit, origin trailer for pick, recovery                                             | Range/multi-selection presentation and all upstream options                               |
| Conflict recovery        | Operation state, index conflicts, base/ours/theirs text editor, stale-save check, external mergetool, stage/continue/abort/skip | Structured submodule and binary conflict resolution                                       |
| Stash                    | Save/apply/pop/drop, selected path, untracked/keep-index, patch preview, branch from stash with object-ID guard                 | Staged-only and richer batch selection                                                    |
| Tags                     | List/lightweight/annotated/signed/create/delete/push/remote delete                                                              | Batch tags and full signature inspection                                                  |
| Blame/file history       | Blame text and rename-following file history                                                                                    | Interactive line history, blame-to-commit navigation                                      |
| Reflog/recovery          | Reflog, unreachable-object listing; create branch at recovered ID                                                               | Dedicated recovery browser                                                                |
| Patches                  | Inspect/apply unified patch, format-patch export, mail apply/continue/abort                                                     | Full patch series editor and format options                                               |
| Archive                  | ZIP revision to new file                                                                                                        | Other formats and selected file exports                                                   |
| Bisect                   | Start/good/bad/skip/reset/log                                                                                                   | Automatic test runner and rich result navigation                                          |
| Worktrees                | List/add existing or new branch/remove clean/prune; open via repository picker                                                  | Lock/unlock/move and richer nested navigation                                             |
| Submodules               | Add/status/init/recursive update/remote update/sync/deinitialize                                                                | Nested commit/merge management, submodule-specific conflict UI                            |
| Sparse checkout          | Cone directories, list, disable                                                                                                 | Non-cone pattern editor                                                                   |
| Repository editors       | .gitignore/.gitattributes/.mailmap with stale-save checks                                                                       | info/exclude and complete configuration editor                                            |
| Configuration            | Local/global common identity/signing/line-ending/pull/prune/rerere keys, full config inspection                                 | Arbitrary config, aliases, credential/tool configuration forms                            |
| Notes/maintenance        | Notes read/save/remove, fsck, garbage collection, unreachable objects                                                           | Stale-lock handling and all maintenance options                                           |
| GitHub/Enterprise        | OS vault tokens, PR list/details/files, draft create, comment/review/merge/fork                                                 | Live provider acceptance, other hosts, full inline review/checkout workflows              |
| Extensions               | Saved explicit executable/argument presets                                                                                      | Plugin API, Git Extensions binary compatibility and plugin settings                       |
| Bundled plugin workflows | Contributor statistics, largest HEAD blobs                                                                                      | Release notes, historical large-file search, unused-branch tools and remaining plugins    |
| Shell integration        | Not implemented                                                                                                                 | Explorer/Finder entry points and protocol handlers                                        |
| Settings/menus           | 15 themes, typography/motion/layout, searchable tools, context menus, direct palette settings                                   | Configurable shortcuts, translation, upstream settings breadth, multi-selection menus     |
| Distribution             | Windows/macOS packaging workflow                                                                                                | Signing, notarization, updater, installer upgrade acceptance                              |

## Acceptance for each parity item

1. Link the exact upstream source and enumerate meaningful options and defaults.
2. Implement typed backend requests and discoverable UI/menu controls together.
3. Test successful operations, invalid inputs, dirty/conflicted repositories,
   stale selections, cancellation/recovery, and interaction with a second client.
4. Drive the installed/runtime UI against disposable local repositories and a
   local remote; independently verify object IDs, refs, index and working files.
5. Record Windows and macOS evidence separately. Test authentication against
   actual supported providers before claiming provider parity.

The current native suite is a foundation, not a substitute for completing these
rows or exercising all upstream option combinations.
