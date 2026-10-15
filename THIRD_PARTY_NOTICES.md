# Open-source credits

GitStudio Pro is an independent project. The application code is MIT licensed;
third-party themes, fonts, icons, and dependencies retain their own licenses.
Upstream names identify the original projects, not an endorsement.

## Theme palettes

These are **adaptations of open-source palettes**, not original GitStudio Pro
color schemes. Surface, muted-text, accent, and border roles have been adjusted
for this application's interface. We do not redistribute upstream editor plugins.

| Bundled theme                              | Upstream / attribution                                                                                                                                         | License notice                         |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Catppuccin Latte, Frappé, Macchiato, Mocha | [Catppuccin](https://github.com/catppuccin/catppuccin)                                                                                                         | [MIT](licenses/catppuccin.txt)         |
| Nord                                       | [Sven Greb / Nord](https://github.com/nordtheme/nord)                                                                                                          | [MIT](licenses/nord.txt)               |
| Dracula                                    | [Dracula contributors](https://github.com/dracula/dracula-theme)                                                                                               | [MIT](licenses/dracula.txt)            |
| Solarized Light / Dark                     | [Ethan Schoonover / Solarized](https://github.com/altercation/solarized)                                                                                       | [MIT](licenses/solarized.txt)          |
| Gruvbox Light / Dark                       | [Pavel Pertsev (morhetz), Gruvbox community](https://github.com/gruvbox-community/gruvbox)                                                                     | [MIT](licenses/gruvbox.txt)            |
| Tokyo Night                                | [Folke Lemaitre / Tokyo Night](https://github.com/folke/tokyonight.nvim), based on [enkia's original theme](https://github.com/enkia/tokyo-night-vscode-theme) | [Apache-2.0](licenses/tokyo-night.txt) |
| Rosé Pine                                  | [Rosé Pine](https://github.com/rose-pine/rose-pine-theme)                                                                                                      | [MIT](licenses/rose-pine.txt)          |
| One Dark                                   | [GitHub / Atom One Dark](https://github.com/atom/one-dark-syntax)                                                                                              | [MIT](licenses/one-dark.txt)           |
| Studio Day / Dusk                          | GitStudio Pro contributors                                                                                                                                     | [Project MIT license](LICENSE)         |

The complete upstream theme license texts are preserved in `licenses/`, embedded
in Preferences → Appearance → Open-source credits & licenses, and tracked with
exact source commits in [licenses/sources.json](licenses/sources.json).
`node scripts/update-theme-licenses.mjs` refreshes those notices; review each change.

## Typography and icons

- [Inter](https://github.com/rsms/inter), The Inter Project Authors: [SIL OFL 1.1](licenses/inter.txt). Fonts are bundled locally through Fontsource; there is no font CDN request.
- [Lucide](https://github.com/lucide-icons/lucide), Lucide contributors and Feather portions by Cole Bemis: [ISC / MIT](licenses/lucide.txt).
- The GitStudio Pro application mark is project artwork under the project MIT license.

## Implementation and inspiration

[Tauri](https://github.com/tauri-apps/tauri) (MIT / Apache-2.0),
[React](https://github.com/facebook/react) (MIT), and the Rust / web dependency
ecosystems power this application. Lockfiles record the actual dependency versions.
Git is an independently installed runtime dependency, not bundled with the app.

[Git Extensions](https://github.com/gitextensions/gitextensions) inspired the
workflow. This is a from-scratch implementation: no Git Extensions source or
assets are included. User-supplied GitBuddy screenshots informed the layout;
the screenshots themselves and their private repository content are not shipped.
