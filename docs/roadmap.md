# Scope and roadmap

## Implemented alpha workflows

GitStudio Pro supports local repositories and independent tabs; paged graph/history;
text diffs; file and selected-line staging; commits and amendments; branch and remote
management; fetch/pull/push options; tags; stashes; merge/rebase/pick/revert recovery;
a visual linear interactive rebase editor; a text conflict editor; blame/reflog;
worktrees, submodules and sparse checkout; bisect; notes; patches and ZIP archives;
common Git settings; maintenance; saved custom executable presets; GitHub/Enterprise
pull-request controls; and 15 attributed offline themes.

All extended operations are available from **Repository tools** and the command
palette. Clone/init is available without an open repository. Direct host controls
are in **Pull requests** and **Preferences → Repository hosts**.

## Remaining milestones

The [source-based Git Extensions matrix](parity/README.md) is the detailed backlog.
Full parity remains unfinished. A broad set of tools is not proof of every upstream
option combination, plugin workflow or platform behavior.

1. Complete upstream dialog options, multi-selection behavior and advanced refspecs.
2. Interactive revision-tree/blame navigation, image/binary previews, syntax highlighting,
   and rename presentation; complete merge topology and rebase options.
3. Remaining plugin workflows, extension API, Explorer/Finder integration, configurable
   bindings, translations, and upstream settings breadth.
4. Live host-provider acceptance, additional providers and inline review workflows.
5. Optional AI assistance with explicit context preview and per-endpoint OS credentials.
6. Signed Windows builds, notarized macOS builds, updates, installer acceptance,
   physical macOS UI testing and reproducible performance measurements.

## Known limits

- Early alpha, not complete Git Extensions parity or a stable release.
- Git must be installed on PATH. macOS GUI launches may not inherit shell PATH.
- Bare repositories can be created but cannot be opened as working-copy tabs.
- Non-UTF-8 Git output is refused. Process output is bounded at 16 MiB / 120 seconds;
  host responses at 8 MiB / 30 seconds. Helpers can outlive process timeouts.
- Untracked/conflict editor text is limited to 1 MiB. Binary previews are not available.
- Main history search covers loaded commits. Repository tools can search all refs,
  bounded to 500 matching commits. Wide graphs can be clipped to their column.
- Diff rendering stops at 3,000 lines. Full bounded patches can be copied/exported.
- Configure Git credential helpers, SSH agents and signing tools before use. There
  are no interactive terminal prompts. External tools must finish within 120 seconds.
- Interactive rebase supports linear pick/edit/drop/reorder/squash/fixup plans. To
  change a message, use an edit stop followed by Amend and Continue.
- GitHub controls support GitHub/Enterprise API contracts; tests using a loopback
  fixture do not establish live-provider authentication or permission acceptance.
- Windows Credential Manager and macOS Keychain are supported; no plaintext fallback.
- Minimum window size is 1000 × 680. Open tabs do not persist across app launches.
- No analytics, automatic cloud polling or AI source upload. Host calls are explicit.
- CI packages remain unsigned development artifacts.

See [validation.md](validation.md) for exact evidence and platform distinctions.
