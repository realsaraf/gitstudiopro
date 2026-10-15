# Contributing to GitStudio Pro

Welcome. The goal is a dependable, readable Git workspace for Windows and macOS.
Small, well-tested improvements are particularly useful during the alpha.

1. Read [the architecture](docs/architecture.md) and [roadmap](docs/roadmap.md).
2. Install the prerequisites in the README and run `npm ci`.
3. Create a branch and make a focused change.
4. Run the checks below and describe the evidence in your pull request.

```sh
npm run format
npm run build
npm test
npx playwright install chromium
npm run test:e2e
cargo fmt --manifest-path src-tauri/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml
cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Use disposable repositories for tests. Never run write-operation tests against
your checkout or a user's repositories. Tests must configure identity locally,
avoid network dependencies, and leave user Git configuration alone.

## Review standards

- Keep Git arguments typed and shell-free. Validate revisions and file paths at
  the Rust boundary; do not add arbitrary command execution to the frontend.
- Cover deletion, empty repositories, spaces/Unicode in paths, and conflicts
  when changing Git behavior. Preserve worktree contents during unstage.
- Keep slow work off the event loop. Bound payloads and render visible rows.
- Provide keyboard focus, readable errors, empty states, and reduced-motion support.
- Add or preserve source attribution and full license notices for imported assets.
- State whether evidence comes from a fixture preview, actual native IPC, a
  package build, or physical-platform testing. These are different checks.

## Screenshots

Run `npm run screenshots` while the dev server is available. The capture script
uses deterministic, fictional fixture data. Never publish private repository
paths, source, authors, tokens, or the original supplied reference screenshots.
Review the PNGs and update the README when behavior or visual design changes.

By submitting a contribution, you agree that your contribution is available under
the project's MIT license. Third-party assets retain their original licenses.
