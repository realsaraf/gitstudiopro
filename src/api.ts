import { invoke, isTauri } from '@tauri-apps/api/core';
import type { Repository, Request } from './types';
import {
  demoCommits,
  demoDiff,
  demoFiles,
  demoRepo,
  demoSnapshot,
} from './demo';
export const native = isTauri();
export async function openRepository(path: string): Promise<Repository> {
  if (path === demoRepo.path && !native) return demoRepo;
  if (!native)
    throw new Error(
      'Local repositories are available in the desktop app. Run npm run desktop.',
    );
  return invoke('open_repository', { path });
}
export async function request<T>(path: string, command: Request): Promise<T> {
  if (native)
    return invoke<T>('repository_request', { path, request: command });
  if (path !== demoRepo.path)
    throw new Error('Open the desktop app to access local repositories.');
  let result: unknown;
  switch (command.kind) {
    case 'snapshot':
      result = demoSnapshot;
      break;
    case 'history':
      result = command.skip ? [] : demoCommits;
      break;
    case 'commitFiles':
      result = demoFiles;
      break;
    case 'diff':
      result = demoDiff;
      break;
    case 'compare':
      result =
        ' src/components/Workspace.tsx | 8 ++++++--\n src/styles.css               | 4 ++++\n 2 files changed, 10 insertions(+), 2 deletions(-)';
      break;
    default:
      throw new Error(
        'This is a read-only design preview. Use the desktop app for Git operations.',
      );
  }
  return result as T;
}
export function readSaved<T>(key: string, fallback: T): T {
  try {
    return (
      JSON.parse(localStorage.getItem(`gitstudiopro:${key}`) ?? 'null') ??
      fallback
    );
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(`gitstudiopro:${key}`, JSON.stringify(value));
  } catch {
    /* Session remains usable when storage is full. */
  }
}
