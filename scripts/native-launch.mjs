import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';

// Keep startup failures observable even when WebView2 never creates a page.
export function launchNative(executable, env, evidence) {
  let output = '';
  let failure;
  const app = spawn(executable, [], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  });
  const append = (data) => {
    output = (output + data.toString()).slice(-65536);
  };
  app.stdout.on('data', append);
  app.stderr.on('data', append);
  app.on('error', (error) => {
    failure = error.message;
  });
  app.on('exit', (code, signal) => {
    failure = `Native process exited (code ${code}, signal ${signal})`;
  });
  return {
    kill: () => app.kill(),
    async connect(port) {
      const deadline = Date.now() + 45000;
      let connectionError;
      try {
        while (Date.now() < deadline && !failure) {
          try {
            return await chromium.connectOverCDP(`http://127.0.0.1:${port}`, {
              timeout: 2000,
            });
          } catch (error) {
            connectionError = error.message;
            await delay(250);
          }
        }
        throw new Error(
          `${failure ?? 'WebView2 debugging endpoint did not become ready'}\n${output}\n${connectionError ?? ''}`,
        );
      } finally {
        await writeFile(
          join(evidence, 'startup.log'),
          `Executable: ${executable}\nPID: ${app.pid}\n${failure ?? 'Process running'}\n${output}`,
        );
      }
    },
  };
}
