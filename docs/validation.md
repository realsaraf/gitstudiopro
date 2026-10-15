# Validation evidence

Initial evidence recorded October 14, 2026; workflow follow-up October 15, 2026.
This describes observed checks, not a stable-release certification.

## Extended Git tools and host controls — October 15, 2026

This follow-up implements the extended repository-tool catalog, clone/init,
selected-line staging, interactive rebase, built-in conflict editing, host controls
with OS credentials, and saved custom executable presets. The updated
[parity matrix](parity/README.md) separates these additions from remaining upstream
options; this is **not** a declaration of complete Git Extensions parity.

- Production frontend build passed; **12 unit tests** and **19 browser tests** passed.
  Browser checks include palette focus/themes, tools, confirmation guards, host
  navigation, modal behavior and automated accessibility checks.
- **24 Rust tests passed** against real Git fixtures. Clippy passed with warnings
  denied. Coverage includes stale edits/patches, path validation, scoped remote
  operations, author/sign-off, reset, worktrees, sparse checkout, bisect, patches,
  conflict gating, custom executable validation, and host endpoint/write validation.
- **41 Windows native UI scenarios passed on the final release executable**:
  [23 core workflows](testing/native-workflows.json) and
  [18 extended workflows](testing/native-tools.json). These include real Git
  operations and a loopback host fixture; remote publishing was not tested against
  a live provider. The synthetic host credential was removed after testing.
- The Windows executable and NSIS installer built successfully. The installer was
  not executed. Executable SHA-256:
  `263E811421ABA5FD436555563C2C9B698CF857A627D55F8D8ED219252F7F9101`.
  Installer SHA-256:
  `4D6F4C45133BD25CE69AFC307C41F14185D323C324B6D2B696978AC03FB02686`.

The local build initially exhausted free space on C:. Lossless NTFS compression of
this project's generated debug cache recovered space; source files were not deleted.
The desktop-only Cargo target now generates an `rlib`, omitting unused mobile/FFI
library artifacts. A separate slow alternate-drive build was stopped.

The prior workflow revision `0b8fcc98b6f5046f62a84f21bd909e94db42a10e` passed
[Windows and macOS CI](https://github.com/realsaraf/gitstudiopro/actions/runs/38681673001).
That result applies to the prior code, not this follow-up. Physical macOS UI,
installer execution, signing/notarization, live provider credentials and exhaustive
upstream option combinations still require their own verification.

## Git workflow and source-parity follow-up

The [source-based parity audit](parity/README.md) records the inspected upstream
revision, a reproducible menu/dialog inventory, and explicit remaining gaps.
Full Git Extensions parity has not been achieved.

- **12 Rust tests passed**, including real repositories/remotes, conflict recovery
  for merge/rebase/cherry-pick/revert, stale stash selection, tracking/publishing,
  and safe branch deletion. Clippy passed with warnings denied.
- **9 frontend unit tests and 16 browser tests passed.** Browser coverage includes
  right-click and Shift+F10 commit menus, keyboard navigation, focus restoration,
  contextual actions, palette settings, and automated accessibility checks.
- **23 Windows native UI scenarios passed** against the release executable,
  using real IPC and Git in disposable repositories. Branches, commits,
  publish/push rejection, fetch/pull, stash save/apply/pop/drop, history operations,
  and conflict abort/continue/skip are covered. Git independently checks the refs,
  files, index, and remote results. See the [workflow guide](native-workflows.md).

The native suite uses local bare remotes, not authenticated GitHub/GitLab traffic.
Conflict file text is resolved through a simulated external-editor step; staging
and recovery use UI controls. This does not validate a built-in conflict editor,
all upstream options, physical macOS interaction, installer execution, or signing.
Screenshots and a trace are retained in ignored `artifacts/native-workflows/`.

The workflow follow-up Windows executable and NSIS installer rebuilt successfully.
Installer SHA-256:
`3BE7AD35B282666AB5DC32C973C878CF311A6C9E3A6B11F8336058250FFC02A2`.
The installer was built but not executed. This follow-up needs its own macOS CI
result; the successful earlier CI runs below do not validate the new code.

## Command palette follow-up

The palette/settings follow-up adds direct theme and setting selection, shared
settings persistence, contextual repository actions, and accessible keyboard
navigation. `npm run build`, formatting checks, 9 frontend unit tests, and all
14 browser tests passed on Windows. The browser checks include palette focus,
search aliases and accents, settings persistence, disabled commands, action
dialog routing, tab switching, scrolling at 1000 × 680, and automated accessibility
checks for the workspace, Preferences, palette, and theme results.

Screenshots were regenerated from the read-only fixture. The Windows release
executable and NSIS installer rebuilt successfully. The release native smoke test
passed direct Dracula selection, text-size changes, palette focus/reopening, and
the existing real Git stage/commit/branch workflow in a disposable repository and
profile. The installer SHA-256 for this follow-up is
`8D298A03D50BD8DB42614E78EB2661C2C687590EF74F0A6226521C9DD45AD631`.
The installer itself was not executed. The [palette follow-up CI run](https://github.com/realsaraf/gitstudiopro/actions/runs/38678889942)
subsequently passed at `e0c9dd7712cff74e4dc7ceb9c2a82cf1cfbc3372`.
That evidence applies to the palette revision, not the later workflow changes.

## Initial alpha checks

| Check                                 | Evidence                                                                                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript and production frontend    | `npm run build` passed                                                                                                                               |
| Graph and diff parser                 | 6 Vitest tests passed                                                                                                                                |
| Browser interaction                   | 7 interaction scenarios plus a default-workspace/preferences automated accessibility check passed                                                    |
| Rust Git operations                   | 8 tests passed against disposable local repositories                                                                                                 |
| Rust linting                          | Clippy with warnings denied passed, including the integration tests                                                                                  |
| Windows debug and release executables | Both built successfully; the release executable is 7,440,384 bytes                                                                                   |
| Windows native IPC                    | Debug and final release smoke tests passed: open → history → stage → commit → create branch → switch branch; Git independently confirmed the results |
| Theme notices                         | Eight upstream theme-family licenses copied, source commits recorded, and notices embedded in Preferences                                            |
| npm dependency audit                  | No known vulnerabilities reported after dependency updates                                                                                           |
| macOS Apple Silicon                   | CI passed frontend, browser, Rust tests, formatting, Clippy, app/DMG build, and artifact upload; no hands-on macOS interaction claimed               |

## Test coverage

Rust fixtures exercise empty repositories, root commits, merge first-parent diffs,
Unicode and whitespace filenames, literal glob-like filenames, deletion staging,
index-only unstage, branch creation/switching, stash save/apply with untracked files,
unopened repository rejection, invalid argument rejection, credential redaction,
local bare-remote fetch/push/pull, and refusal to pull divergent history.

Browser tests exercise welcome/preview entry, history search and keyboard
navigation, unified/split diffs, command palette, persistent theme selection,
read-only fixture write refusal, tab independence, workflow screens, and keyboard
resizing at the minimum desktop viewport.

The native harness controls the actual Windows WebView2 app through a temporary
local debugging port. It uses a disposable repository and WebView profile, and
independently checks results with Git. Diagnostic output is kept under the ignored
`artifacts/` folder; user repositories are not used for write tests.

## Screenshots

README screenshots are actual renders of the application using explicitly labeled,
fictional browser fixtures at 1600 × 1000. Regenerate them with the development
server running and `npm run screenshots`. They illustrate layout, not native
repository correctness, signing, or release availability.

## Build artifacts

The [initial cross-platform CI run](https://github.com/realsaraf/gitstudiopro/actions/runs/38675975964)
builds code commit `d49215b5e70886831143eaa9b6f343d98b130494`. Its macOS ARM64
DMG was successfully uploaded as `gitstudiopro-macOS-ARM64-unsigned`.

The final local Windows NSIS installer was produced from that same code revision:

- File: `src-tauri/target/release/bundle/nsis/GitStudio Pro_0.1.0_x64-setup.exe`
- Size: **2,611,478 bytes** (approximately 2.49 MiB)
- SHA-256: `07FB6B0BF7A3383906C880FD4C85A7038B962F0C58C9B27F8844636DFE29B468`
- The packaged release executable passed the native smoke test. The installer
  itself was built but was not run to modify the host's installed applications.

Installer bytes can differ across toolchains or builds; this checksum identifies
the observed local artifact, not all CI artifacts for this version.

## Remaining release evidence

Installer execution, signing, notarization, physical macOS interaction, assistive
technology testing, and representative large-repository latency/memory benchmarks
remain release work. CI artifacts are unsigned development packages.
