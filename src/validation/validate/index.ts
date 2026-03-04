/**
 * Validation runner — discovers and executes all validation scripts in this
 * directory. Each script must export a default async function. If any script
 * throws, the runner exits with code 1.
 *
 * Exported as runValidation() for use by the commands CLI.
 */

import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Run all validation scripts in this directory.
 * Caller is responsible for handling --help (typically via commands runner).
 */
export async function runValidation(): Promise<void> {
  const files = await readdir(__dirname);
  const scripts = files.filter((f) => f.endsWith('.ts') && f !== 'index.ts').sort();

  if (scripts.length === 0) {
    console.log('No validation scripts found.');
    return;
  }

  let failed = false;

  for (const script of scripts) {
    console.log(`\n=== ${script} ===\n`);
    try {
      const mod = (await import(join(__dirname, script))) as { default?: unknown };
      if (typeof mod.default !== 'function') {
        throw new Error(`${script} does not export a default function`);
      }
      await (mod.default as () => Promise<void>)();
      console.log(`\nPASS: ${script}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\nFAIL: ${script} -- ${message}`);
      failed = true;
    }
  }

  console.log('');

  if (failed) {
    throw new Error('One or more validation scripts failed.');
  }
  console.log('All validation scripts passed.');
}
