/**
 * Application-wide Consola instance.
 *
 * Prefer `import { consola } from '../logger.js'` (or `./logger.js`) instead of
 * `import { consola } from 'consola'` so tags, level, and reporters stay consistent.
 *
 * Environment (handled by Consola when this instance is created):
 * - `CONSOLA_LEVEL` — numeric minimum log level
 * - `DEBUG` — influences default level when `CONSOLA_LEVEL` is unset
 *
 * CLI `--verbose` hooks into {@link setVerboseLogging}.
 *
 * VS Code extension: duplicate defaults live in `vscode-ext/src/saifac-logger.ts`.
 */

import { type ConsolaInstance, createConsola, LogLevels } from 'consola';

export const logger: ConsolaInstance = createConsola({
  defaults: {
    tag: 'saifac',
  },
});

/** Same instance as {@link logger}; use either name. */
export const consola: ConsolaInstance = logger;

/** Level from env/reporter defaults on first load, before CLI overrides. */
const baselineLogLevel = logger.level;

/**
 * Turns verbose logging on or off for the shared `logger` instance.
 * Call from CLI after parsing flags (e.g. `saifac feat run --verbose`).
 */
export function setVerboseLogging(verbose: boolean): void {
  logger.level = verbose ? LogLevels.debug : baselineLogLevel;
}

export { LogLevels };
export type { ConsolaInstance };
