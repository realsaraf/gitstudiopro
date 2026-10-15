import { useSyncExternalStore } from 'react';
import { readSaved, save } from './api';
import { applyTheme, themes } from './themes';

export interface Settings {
  theme: number;
  fontSize: number;
  reduceMotion: boolean;
  splitDiff: boolean;
}

function normalize(value: Settings): Settings {
  return {
    theme:
      Number.isInteger(value.theme) && themes[value.theme] ? value.theme : 0,
    fontSize: Number.isFinite(value.fontSize)
      ? Math.max(12, Math.min(18, Math.round(value.fontSize)))
      : 15,
    reduceMotion: value.reduceMotion === true,
    splitDiff: value.splitDiff !== false,
  };
}

let settings = normalize({
  theme: readSaved('theme', 0),
  fontSize: readSaved('fontSize', 15),
  reduceMotion: readSaved('reduceMotion', false),
  splitDiff: readSaved('splitDiff', true),
});
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useSettings() {
  return useSyncExternalStore(subscribe, () => settings);
}

export function updateSettings(change: Partial<Settings>) {
  settings = normalize({ ...settings, ...change });
  for (const key of Object.keys(change) as (keyof Settings)[])
    save(key, settings[key]);
  applySettings(settings);
  listeners.forEach((listener) => listener());
}

export function applySettings(value: Settings) {
  applyTheme(value.theme);
  document.documentElement.style.fontSize = `${value.fontSize}px`;
  document.documentElement.dataset.reduceMotion = String(value.reduceMotion);
}

export function resetLayout() {
  save('sidebarWidth', 258);
  save('historyHeight', 48);
  window.dispatchEvent(new Event('reset-layout'));
}
