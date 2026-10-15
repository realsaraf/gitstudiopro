import { Columns2, Palette, Settings2, ShieldCheck, Type } from 'lucide-react';
import { themes } from './themes';
import { resetLayout } from './settings';
import type { Settings } from './settings';
import type { PaletteCommand } from './lib/commands';
import type { PreferencesTab } from './components/Preferences';

/** The palette and Preferences use the same settings store and persistence. */
export function settingsCommands(
  settings: Settings,
  changeSetting: (change: Partial<Settings>) => void,
  showPreferences: (tab?: PreferencesTab, section?: string) => void,
  onClose: () => void,
): PaletteCommand[] {
  return [
    ...(['Appearance', 'Intelligence', 'Repository hosts'] as const).map(
      (tab) => ({
        id: `settings-${tab.replaceAll(' ', '-')}`,
        group: 'Settings',
        name: `${tab} settings`,
        detail:
          tab === 'Appearance'
            ? 'Themes, text size, layout, and reduced motion'
            : tab === 'Intelligence'
              ? 'AI integration status · planned'
              : 'Git authentication and hosted integration status',
        keywords:
          tab === 'Intelligence'
            ? 'ai model provider'
            : tab === 'Repository hosts'
              ? 'github ssh credentials authentication'
              : 'color font zoom animation',
        icon: Settings2,
        run: () => showPreferences(tab),
      }),
    ),
    ...themes.map((theme, index) => ({
      id: `theme-${index}`,
      group: 'Themes',
      name: `Theme: ${theme.name}`,
      detail: `${theme.family} · ${theme.dark ? 'Dark' : 'Light'} · Apply immediately`,
      keywords: 'appearance color colour palette settings',
      icon: Palette,
      swatch: theme.accent,
      selected: settings.theme === index,
      run: () => changeSetting({ theme: index }),
    })),
    ...Array.from({ length: 7 }, (_, i) => i + 12).map((size) => ({
      id: `font-${size}`,
      group: 'Settings',
      name: `Text size: ${size} px`,
      detail: 'Set workspace and code text size',
      keywords: 'font zoom appearance',
      icon: Type,
      selected: settings.fontSize === size,
      run: () => changeSetting({ fontSize: size }),
    })),
    {
      id: 'font-increase',
      group: 'Settings',
      name: 'Increase text size',
      detail: `Current: ${settings.fontSize} px`,
      keywords: 'font zoom in bigger',
      icon: Type,
      disabled:
        settings.fontSize === 18 ? 'Maximum text size is 18 px' : undefined,
      run: () => changeSetting({ fontSize: settings.fontSize + 1 }),
    },
    {
      id: 'font-decrease',
      group: 'Settings',
      name: 'Decrease text size',
      detail: `Current: ${settings.fontSize} px`,
      keywords: 'font zoom out smaller',
      icon: Type,
      disabled:
        settings.fontSize === 12 ? 'Minimum text size is 12 px' : undefined,
      run: () => changeSetting({ fontSize: settings.fontSize - 1 }),
    },
    {
      id: 'font-reset',
      group: 'Settings',
      name: 'Reset text size',
      detail: 'Restore the default 15 px',
      keywords: 'font zoom default',
      icon: Type,
      run: () => changeSetting({ fontSize: 15 }),
    },
    {
      id: 'motion',
      group: 'Settings',
      name: settings.reduceMotion
        ? 'Disable reduced motion'
        : 'Enable reduced motion',
      detail: settings.reduceMotion
        ? 'Allow interface transitions'
        : 'Keep interface transitions quiet',
      keywords: 'animation reduce motion accessibility',
      icon: Settings2,
      run: () => changeSetting({ reduceMotion: !settings.reduceMotion }),
    },
    {
      id: 'reset-layout',
      group: 'Settings',
      name: 'Reset panel layout',
      detail: 'Restore sidebar width and history height',
      keywords: 'divider resize panels default',
      icon: Columns2,
      run: () => {
        resetLayout();
        onClose();
      },
    },
    ...[true, false].map((split) => ({
      id: split ? 'diff-split' : 'diff-unified',
      group: 'Settings',
      name: split ? 'Side by side diff' : 'Unified diff',
      detail: 'Set the default diff layout across tabs',
      keywords: 'code comparison split inline',
      icon: Columns2,
      selected: settings.splitDiff === split,
      run: () => changeSetting({ splitDiff: split }),
    })),
    {
      id: 'licenses',
      group: 'Help',
      name: 'Open-source credits and licenses',
      detail: 'Read theme and dependency attribution',
      keywords: 'copyright license themes',
      icon: ShieldCheck,
      run: () => showPreferences('Appearance', 'licenses'),
    },
  ];
}
