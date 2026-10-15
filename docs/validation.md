# Validation evidence

Recorded on October 14, 2026, during the initial Windows development run.
This describes observed checks, not a stable-release certification.

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
