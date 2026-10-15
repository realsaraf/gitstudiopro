# Security policy

This project is an early alpha. Security fixes target the latest main branch.
Please report vulnerabilities through GitHub's **Report a vulnerability** feature
if available, or contact the repository owner privately. Do not include private
repositories, tokens, or executable exploit payloads in a public issue.

## Local trust model

The frontend cannot run arbitrary shell commands. Tauri exposes typed repository
requests, and Rust permits operations only after a repository has been opened.
Git receives argument arrays, literal file pathspecs, and validated revisions.
Diff commands disable external diff drivers and text converters.

Opening and operating on a repository means trusting its Git configuration.
Git's configured hooks, signing programs, filters, SSH commands, and credential
helpers may run for the relevant operations. This application does not sandbox
Git or promise safe execution of malicious repositories. Review unfamiliar
repositories before performing writes or network operations.

No telemetry or AI requests are implemented. Repository paths and non-secret UI
preferences are persisted in local WebView storage. The app does not collect
provider tokens; network operations use your existing Git credentials. Passwords
embedded in HTTP remote authorities are removed from the remote-list display.

## Safeguards and limits

- No hard reset, discard, force push, branch deletion, or stash deletion UI.
- Pull is fast-forward only; push sends only HEAD to its configured upstream ref.
- Stage/unstage operate on individual literal paths. Unstage preserves worktree files.
- Each Git pipe is capped at 16 MiB, untracked previews at 1 MiB, and requests time
  out after 120 seconds. Hooks/helpers can outlive the parent on timeout; inspect
  repository state before retrying a write.
- Operations are serialized per opened worktree, not across unrelated repositories.
  Other Git clients can still modify a repository concurrently; Git's own locks
  remain authoritative.
- A restrictive production CSP disallows remote content and script evaluation.
- Development servers and WebView debug ports are for local testing only.

See [known limitations](docs/roadmap.md) before using the alpha for critical work.
