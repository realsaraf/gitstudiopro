# Security policy

This project is an early alpha. Security fixes target the latest main branch.
Please report vulnerabilities through GitHub's **Report a vulnerability** feature
if available, or contact the repository owner privately. Do not include private
repositories, tokens, or executable exploit payloads in a public issue.

## Local trust model

Tauri exposes typed repository requests, and Rust permits repository operations
only after a repository has been opened. Git receives argument arrays, literal
file pathspecs, and validated revisions. Normal diff commands disable external
diff drivers and text converters. External diff/merge tools are separate explicit
actions. Custom tools require an absolute executable, individual arguments and
confirmation; they run with the user's permissions in the repository directory.
On Windows, select an `.exe` interpreter to run a script; batch files are not
implicitly passed to a shell. Saved custom-tool arguments must not contain secrets.

Opening and operating on a repository means trusting its Git configuration.
Git's configured hooks, signing programs, filters, SSH commands, and credential
helpers may run for the relevant operations. This application does not sandbox
Git or promise safe execution of malicious repositories. Review unfamiliar
repositories before performing writes or network operations.

No telemetry or AI requests are implemented. Repository paths and non-secret UI
preferences are persisted in local WebView storage. Git network operations use
existing Git credentials. GitHub/Enterprise API tokens use Windows Credential
Manager or macOS Keychain, isolated by the normalized API base URL. They are never
returned to the frontend or persisted in browser settings. There is no plaintext
fallback. Passwords embedded in HTTP remote authorities are removed from the
remote-list display.

## Safeguards and limits

- Destructive tools require explicit review and confirmation. Hard reset, clean,
  discard, forced deletion and forced push can lose work; Git's checks still apply.
- Default pull is fast-forward only; advanced controls also offer merge/rebase.
  Force-with-lease uses the captured remote-tracking object ID. An explicit force
  mode is separately available; it does not preserve the lease safeguard.
- Hosted writes require confirmation and a stored token. Merge sends the inspected
  pull request's head SHA so a changed head is rejected by the provider.
- Host APIs require HTTPS except loopback testing, disable redirects, limit bodies
  to 8 MiB, and time out after 30 seconds. Saving credentials sends no network request.
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
