# Repository tools

Open **Repository tools** in a repository, or use **Ctrl/Cmd K** to search for an
operation directly. The left list groups inspection, history editing, remotes,
working files, maintenance and extension tools. Inspection does not require a
confirmation; writes show their inputs and require review before execution.

## Stage part of a file

1. Open **Stage selected lines** and enter a tracked file path.
2. Load its diff. Select individual added/deleted lines or toggle a whole hunk.
3. Review and apply. Enable **Unstage from the index** to reverse selected staged changes.

Unselected edits stay in the working file. The app rereads the diff before applying
and refuses stale selections. Binary and untracked files must be staged as whole
files. A replacement consists of a removed line and an added line; select both to
stage the complete replacement.

## Edit history

**Interactive rebase** loads a linear range after an upstream commit. Reorder rows
with the arrow buttons and choose pick, edit, drop, squash or fixup. Every original
commit remains represented in the plan; use drop to remove it. The first retained
change must have a preceding commit before a squash/fixup is meaningful.

An **edit** stop leaves the rebase active. Make and stage changes, use **Amend last
commit** for the replacement message, then **Continue rebase**. Conflict recovery
shows Continue/Skip/Abort in the workspace. Ordinary writes are blocked while a
history operation is active; staging and supported recovery remain available.

Preserve-merges rebase is a separate operation. The visual editor rejects ranges
containing merge commits; it does not silently flatten them. Advanced cherry-pick
and revert accept commit IDs in the order entered and a mainline parent for merges.

## Resolve a text conflict

Open **Resolve file conflict**, load the file and inspect base/ours/theirs. Edit the
result or start from one side, review, then save. Saving does not stage the file.
Stage it in Working changes and continue the operation. If the file changed outside
the editor, reload before saving. The editor supports UTF-8 text up to 1 MiB.

**Open external merge tool** uses the repository's configured Git mergetool. Configure
the tool before use; the app waits up to 120 seconds and does not supply terminal input.

## Synchronize and recover

The simple Pull control requires fast-forward. **Pull with options** adds merge
and rebase modes. **Push with options** chooses a remote/destination and normal,
force-with-lease or force behavior. Lease uses the remote-tracking object ID known
when the operation executes; Git rejects a changed remote value. Force has no such
protection. Fetch first and inspect the history before rewriting a published branch.

**Browse reflog** and **Find unreachable objects** expose recovery IDs. Create a
branch at a chosen commit to keep it reachable. **Reset current branch** offers
soft/mixed/hard modes. **Preview untracked cleanup** lists candidates before **Clean
untracked files**; clean/discard/hard reset can permanently remove local work.

## Direct repository hosts

Open **Pull requests** or **Preferences → Repository hosts**. Enter an API base URL
(`https://api.github.com`, or an Enterprise API prefix), optionally save a token,
and enter `owner/repository`. Public reads can work anonymously. Tokens are stored
in the OS credential manager, separately for each normalized API URL. Changing
hosts clears an unsaved token. Git fetch/push still uses Git's own authentication.

Load a pull request to inspect its body, current head SHA and changed-file patches.
Draft creation, comments, reviews, merge and fork all require a separate publish
confirmation showing the destination. Merge includes the inspected head SHA; reload
if the provider reports that the head changed. No remote action is sent just by
opening settings. API redirects are refused. Provider permissions and policies
still apply; a successful loopback test is not live-provider acceptance.

## Custom tools

Choose an absolute executable and put each argument on its own line. Arguments
are passed directly, without shell interpolation. For a script, select its interpreter
executable and pass the script path as an argument. Windows requires an `.exe`.
The current directory is the repository. Save a named preset for reuse; selecting
a preset never runs it. Arguments are local plaintext preferences, so do not save
credentials in them. Execution uses your account's permissions and requires confirmation.

See [native UI verification](native-workflows.md), [known limits](roadmap.md) and
[the parity matrix](parity/README.md) for tested scope and remaining differences.
