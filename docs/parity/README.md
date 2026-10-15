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

“Native-tested” below refers to the Windows UI scenarios in
[`scripts/native-workflows.mjs`](../../scripts/native-workflows.mjs), not source
inspection or mocked IPC. It does not establish macOS interaction coverage.
“Partial” always names the remaining scope. Rows without native-test evidence
are not promoted just because the source contains a control.

| Area                                          | GitStudio Pro coverage and evidence                                                      | Remaining parity                                                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Open existing repository, recent repositories | Implemented; native-tested opening                                                       | Upstream dashboard/category behavior                                                                                |
| Clone and init                                | Missing                                                                                  | Clone options, recursive/shallow/single-branch, bare/init choices                                                   |
| History graph, refs, branch filters           | Partial; browser-tested, native history used in workflows                                | Advanced filtering, ordering, decorations and navigation options                                                    |
| Commit details and tree                       | Partial: subject, author, parents, file changes                                          | Full message/body, complete revision tree, GPG information                                                          |
| Diff and comparison                           | Partial: split/unified text diff, revision statistics                                    | Full comparison diff, word/whitespace options, binary/image, external tools                                         |
| Stage/unstage files and all changes           | Implemented; native-tested, including Unicode paths                                      | Hunk/line selection and partial-file staging                                                                        |
| Commit                                        | Partial; native-tested                                                                   | Amend, fixup/squash, author/date overrides, templates, interactive signing                                          |
| Undo/reset/clean/discard                      | Missing                                                                                  | Soft/mixed/hard reset, undo-last-commit, clean and selected-file discard                                            |
| Create/switch branches                        | Implemented; native-tested                                                               | Full checkout/start-point options and detached revision checkout                                                    |
| Branch at selected commit                     | Implemented; native-tested                                                               | Advanced creation/tracking option combinations                                                                      |
| Rename/delete branch                          | Partial; native-tested rename and merged deletion                                        | Force deletion, remote deletion, batch operations                                                                   |
| Track remote branch                           | Implemented; native-tested                                                               | Edit/unset upstream of an existing local branch                                                                     |
| Publish branch/set upstream                   | Implemented; native-tested against local bare remote                                     | Arbitrary source/destination refspec UI                                                                             |
| Fetch                                         | Partial; native-tested one remote                                                        | Fetch-all, prune options, tag/refspec choices                                                                       |
| Pull                                          | Partial; native-tested fast-forward and Rust-tested divergence refusal                   | Pull-merge and pull-rebase options, autostash, branch selection                                                     |
| Push                                          | Partial; native-tested success and rejection without remote overwrite                    | Force-with-lease, force, multiple branches, tags, URL destinations                                                  |
| Remotes                                       | Partial: list and fetch                                                                  | Add/edit/remove/rename remotes, push URL and refspec editing                                                        |
| Merge                                         | Partial; native-tested success, conflict, abort, continue                                | Explicit no-ff/squash/no-commit and strategy options                                                                |
| Rebase                                        | Partial; native-tested ordinary rebase, conflict, abort, continue; Rust-tested skip      | Interactive todo, reorder/edit/drop/squash/fixup, onto ranges, preserve merges, autosquash, date/ref update options |
| Cherry-pick                                   | Partial; native-tested one non-merge commit, conflict, abort, skip; Rust-tested continue | Multi-select/ranges, merge-parent selection, no-commit, origin-reference option                                     |
| Revert                                        | Partial; native-tested non-merge commit and conflict recovery                            | Merge-parent choice, ranges and no-commit options                                                                   |
| Conflict recovery                             | Partial: actual Git operation state, conflict list, stage/continue/abort/skip            | Built-in three-way editor, external mergetool launching, submodule conflict resolution                              |
| Stash save/apply/pop/drop                     | Partial; native-tested all four, stale selection protected by object ID                  | Selected-file/staged-only/keep-index choices, stash preview/branch, optional untracked inclusion                    |
| Tags                                          | Partial: lightweight tag at selected commit, native-tested                               | Annotated/signed tags, delete, push and remote tag management                                                       |
| Blame and file history                        | Missing                                                                                  | Follow renames, line history, blame navigation                                                                      |
| Reflog and recovery                           | Missing                                                                                  | Reflog browser, lost-object recovery, recovery actions                                                              |
| Patch workflows                               | Missing                                                                                  | Format/apply/view patch, mail patches, sequencer recovery                                                           |
| Archive revision                              | Missing                                                                                  | Archive formats and file selection                                                                                  |
| Bisect                                        | Missing                                                                                  | Start/good/bad/skip/reset and result navigation                                                                     |
| Worktrees                                     | Missing management UI; opening existing worktrees supported                              | Add/list/remove/prune/switch management                                                                             |
| Submodules                                    | Missing                                                                                  | Add/init/update/sync/status, nested navigation, commit and merge operations                                         |
| Sparse working copy                           | Missing                                                                                  | Sparse checkout configuration and updates                                                                           |
| Repository file editors                       | Missing                                                                                  | .gitignore, info/exclude, .gitattributes, .mailmap and local config                                                 |
| Repository maintenance                        | Missing                                                                                  | GC/compress, verification, stale-lock handling and lost objects                                                     |
| Git notes                                     | Missing                                                                                  | Show/edit note operations                                                                                           |
| Git configuration and identity UI             | Missing                                                                                  | Global/local scope, credentials, aliases, encoding, signing options                                                 |
| Host integrations and pull requests           | Missing                                                                                  | Fork/clone, view/create PRs, provider credentials                                                                   |
| Plugin/script extensibility                   | Missing                                                                                  | Host API, scripts, integrations, plugin settings                                                                    |
| Bundled plugin workflows                      | Missing                                                                                  | Statistics, large-file discovery, release notes, unused-branch cleanup and others                                   |
| Shell/explorer integration                    | Missing                                                                                  | Windows integration and equivalent macOS entry points                                                               |
| Application settings                          | Partial: themes, font, motion, layout, diff layout, shortcuts                            | Upstream option breadth, configurable bindings, translation and tool configuration                                  |
| Command/context menus                         | Partial: palette, repository/branch/stash menus, commit right-click and keyboard menu    | Remaining commands and multi-selection context behavior                                                             |
| Release/update behavior                       | Partial: unsigned Windows/macOS packaging                                                | Signed/notarized distribution, updater, installation/upgrade verification                                           |

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
