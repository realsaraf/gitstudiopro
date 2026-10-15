# Validation evidence

Recorded on October 14, 2026, during the initial Windows development run.
This describes observed checks, not a stable-release certification.

| Check                              | Evidence                                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TypeScript and production frontend | `npm run build` passed                                                                                                                                 |
| Graph and diff parser              | 6 Vitest tests passed                                                                                                                                  |
| Browser interaction                | 7 interaction scenarios plus a default-workspace/preferences automated accessibility check passed                                                      |
| Rust Git operations                | 8 tests passed against disposable local repositories                                                                                                   |
| Rust linting                       | Clippy with warnings denied passed, including the integration tests                                                                                    |
| Windows debug executable           | Built successfully                                                                                                                                     |
| Windows native IPC                 | Smoke test passed: open → history → stage → commit → create branch → switch branch; Git independently confirmed two commits and expected file contents |
| Theme notices                      | Eight upstream theme-family licenses copied, source commits recorded, and notices embedded in Preferences                                              |
| npm dependency audit               | No known vulnerabilities reported after dependency updates                                                                                             |
| macOS                              | Cross-platform CI configured; local host is Windows, so no hands-on macOS validation is claimed                                                        |

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

## Remaining release evidence

Installer execution, signing, notarization, physical macOS interaction, assistive
technology testing, and representative large-repository latency/memory benchmarks
remain release work. CI artifacts are unsigned development packages.
