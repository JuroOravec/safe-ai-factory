/**
 * Package-level constants. Prefer a single source of truth for paths that
 * must stay consistent regardless of where the process is invoked from.
 */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Absolute path to the SAIF repository root.
 *
 * Resolved from this file's location (src/constants.ts → one level up = SAIF root).
 * Use this instead of computing the root from import.meta.url in other modules —
 * that pattern breaks when files live at different depths (e.g. scripts/ vs src/).
 */
export function getSaifRoot(): string {
  const thisFile = fileURLToPath(import.meta.url);
  return resolve(dirname(thisFile), '..');
}

/** Environment variable names for LLM API keys. At least one must be set for init and agent workflows. */
export const LLM_API_KEYS = [
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENROUTER_API_KEY',
] as const;

/**
 * Relative path to an OpenSpec change directory (e.g. "openspec/changes/add-login").
 */
export function getChangeDirRelative(opts: { openspecDir: string; changeName: string }): string {
  return `${opts.openspecDir}/changes/${opts.changeName}`;
}

/**
 * Absolute path to an OpenSpec change directory.
 * @param opts.cwd - Project root (or base directory)
 */
export function getChangeDirAbsolute(opts: {
  cwd: string;
  openspecDir: string;
  changeName: string;
}): string {
  const relativePath = getChangeDirRelative({
    openspecDir: opts.openspecDir,
    changeName: opts.changeName,
  });
  return join(opts.cwd, relativePath);
}
