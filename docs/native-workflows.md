# Native workflow verification

Run the actual Windows WebView2 application against disposable fixtures:

```powershell
npm run dev
# In another terminal, after a native build:
$env:GITSTUDIO_BINARY = 'src-tauri/target/release/gitstudiopro.exe'
npm run test:native:workflows
```

A debug build uses the development server; a release build uses its embedded
frontend. The harness starts its own temporary WebView profile and allocates a
free loopback debugging port for that run.

The 23 scenarios cover:

- Open repository; create and switch branch; stage/unstage all; commit Unicode paths.
- Publish/set upstream and push another commit; reject a divergent push without changing the remote.
- Cherry-pick and revert from the selected commit's menu; merge and rebase from branch menus.
- Branch-at-commit, rename, merged deletion, lightweight tag creation.
- Fetch, track a remote branch, and fast-forward pull from a simulated collaborator.
- Stash save/apply (retaining it), explicit drop, and pop.
- Rebase, cherry-pick, merge, and revert conflicts; abort restores the starting HEAD and content.
- Resolve/stage/continue for rebase, merge, and revert; skip a conflicted cherry-pick.

Every operation under test is triggered by UI controls. Git CLI commands create
the fixtures, simulate a separate collaborator, and independently check results.
Conflict text is edited as the external-editor step; staging and continuation
are performed through the UI. This is not a claim of a built-in merge editor.

Evidence is saved to ignored `artifacts/native-workflows/`: JSON results,
conflict screenshots, failure screenshot (if any), and a Playwright trace.
The [recorded release-run summary](testing/native-workflows.json) includes the
executable checksum and each scenario result without local fixture paths.
Fixtures remain in the OS temporary directory for diagnosis. No production
remote, personal repository, or user credential is required.

## Boundaries

Local bare-remotes validate Git behavior but do not validate GitHub/GitLab network
authentication, SSH prompts, proxy handling, or host integration. This harness
does not cover physical macOS interaction, installation, every Git Extensions
option, simultaneous external-client writes, large-repository performance, or
all hook/signing failures. See the [source parity audit](parity/README.md).
