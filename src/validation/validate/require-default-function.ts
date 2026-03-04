/**
 * Validates that all .ts files in this directory (except index.ts) export a
 * function as the default export.
 */

import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function (): Promise<void> {
  const files = await readdir(__dirname);
  const scripts = files.filter((f) => f.endsWith('.ts') && f !== 'index.ts').sort();

  const errors: string[] = [];

  for (const file of scripts) {
    const url = pathToFileURL(join(__dirname, file)).href;
    try {
      const mod = (await import(url)) as { default?: unknown };
      if (typeof mod.default !== 'function') {
        errors.push(`${file}: default export must be a function (got ${typeof mod.default})`);
      }
    } catch (err) {
      errors.push(`${file}: failed to load (${err instanceof Error ? err.message : String(err)})`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      'require-default-function failed:\n' + errors.map((e) => `  - ${e}`).join('\n'),
    );
  }
}
