/**
 * Mirrors `spawnUserCmdCapture` in the repo root `src/utils/io.ts` for this CJS/tsup bundle;
 * that module is ESM-only and is not type-importable from the extension tsconfig.
 */
import { spawn } from 'node:child_process';

export function spawnUserCmdCapture(
  script: string,
  opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<string> {
  const { cwd, env } = opts;
  return new Promise((resolve, reject) => {
    const child = spawn(script, {
      shell: true,
      cwd: cwd ?? process.cwd(),
      env: env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout!.on('data', (d: string | Buffer) => {
      out += String(d);
    });
    child.stderr!.on('data', (d: string | Buffer) => {
      out += String(d);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(out);
      } else {
        reject(new Error(`Shell command exited with code ${code ?? 1}: ${script}\n${out}`));
      }
    });
  });
}
