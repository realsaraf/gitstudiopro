import { describe, it, expect } from 'vitest';
import { Palette } from 'lucide-react';
import { searchCommands } from './commands';
import type { PaletteCommand } from './commands';

const commands: PaletteCommand[] = [
  {
    id: 'preferences',
    name: 'Preferences',
    detail: 'Color themes',
    group: 'Settings',
    icon: Palette,
    run() {},
  },
  {
    id: 'frappe',
    name: 'Theme: Catppuccin Frappé',
    detail: 'Dark',
    group: 'Themes',
    keywords: 'appearance colour',
    icon: Palette,
    run() {},
  },
  {
    id: 'day',
    name: 'Theme: Studio Day',
    detail: 'Light',
    group: 'Themes',
    icon: Palette,
    run() {},
  },
];
describe('command search', () => {
  it('matches words in any order, whitespace, case, accents, and aliases', () => {
    expect(searchCommands(commands, '  DARK  frappe colour ')).toEqual([
      commands[1],
    ]);
    expect(searchCommands(commands, 'day theme')).toEqual([commands[2]]);
  });
  it('ranks title matches before descriptions without changing the registry', () => {
    expect(searchCommands(commands, 'theme').map((c) => c.id)).toEqual([
      'frappe',
      'day',
      'preferences',
    ]);
    expect(commands[0].id).toBe('preferences');
  });
  it('keeps discovery order for an empty query and requires every word', () => {
    expect(searchCommands(commands, '   ')).toEqual(commands);
    expect(searchCommands(commands, 'dark day')).toEqual([]);
  });
});
