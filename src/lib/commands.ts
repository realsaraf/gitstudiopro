import type { LucideIcon } from 'lucide-react';

export interface PaletteCommand {
  id: string;
  name: string;
  detail: string;
  group: string;
  icon: LucideIcon;
  keywords?: string;
  keys?: string;
  selected?: boolean;
  swatch?: string;
  disabled?: string;
  run: () => void;
}

const normalize = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Match every word in any order, including aliases and accent-free names. */
export function searchCommands(commands: PaletteCommand[], query: string) {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return commands
    .filter((command) => {
      const text = normalize(
        `${command.name} ${command.detail} ${command.group} ${command.keywords ?? ''}`,
      );
      return words.every((word) => text.includes(word));
    })
    .sort((a, b) => {
      const score = (command: PaletteCommand) =>
        words.filter((word) => normalize(command.name).includes(word)).length;
      return score(b) - score(a);
    });
}
