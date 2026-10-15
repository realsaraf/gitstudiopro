# Command palette

Open with **Ctrl+K** (Windows), **Cmd+K** (macOS), or the Commands button.
The search field receives focus immediately. Type, use Up/Down or Page Up/Page
Down to select a result, then press Enter. Escape closes the palette and restores
focus. Clicking a result works too. Unavailable entries explain the requirement
and cannot execute.

## Direct settings

| Search example          | Result                                                               |
| ----------------------- | -------------------------------------------------------------------- |
| `theme`                 | All 15 bundled themes, with color swatches and the current selection |
| `light theme`           | Light themes only                                                    |
| `frappe`                | Catppuccin Frappé, without requiring the accent                      |
| `dracula theme`         | Apply Dracula directly                                               |
| `font 16`               | Set workspace and code text to 16 px                                 |
| `zoom`                  | Text-size choices, increase/decrease, and reset                      |
| `reduce motion`         | Enable or disable reduced motion                                     |
| `reset panel layout`    | Restore sidebar width and history-panel height                       |
| `unified diff`          | Persist unified diff layout across tabs and restarts                 |
| `settings`              | Available settings and preference destinations                       |
| `intelligence settings` | Open the AI integration status tab                                   |
| `credits licenses`      | Open expanded theme/license attribution                              |

Changes take effect immediately and use the same storage as Preferences. Theme,
text size, reduced motion, and diff layout persist locally. There is no network
request for a settings change. Text is bounded to 12–18 px; the default is 15 px.

## Workspace and Git

Navigation, refresh, new/close tab, open/recent repositories, open-tab switching,
and keyboard help are discoverable commands. Repository entries require an open
repository. Changes and remote operations also reflect the current workspace's
availability and busy state.

New branch, stash, pull, and push open the same dialogs as the workspace buttons;
they do not bypass the existing review step. Fetch opens the Remotes view so you
can choose the remote. Stage/unstage, commit, and branch/stash selection remain in
their contextual workspace views.

Search matches every typed word across the name, description, category, and
aliases, ignoring case, accents, and extra whitespace. Name matches rank first.
This is word matching, not typo correction. Keyboard selection scrolls into view;
the search field and footer remain visible at the minimum supported window size.

AI and direct GitHub integration are roadmap items. Their commands open status
information; they do not imply working provider connections or credential storage.
