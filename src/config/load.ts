/**
 * Load saifac config from saifDir using cosmiconfig.
 *
 * Config can be written as config.json, config.yml, config.js, config.ts, etc.
 * Returns empty defaults when no config file exists.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { cosmiconfigSync } from 'cosmiconfig';

import { type SaifConfig, saifConfigSchema } from './schema.js';

const EXPLORER = cosmiconfigSync('saifac', {
  searchPlaces: [
    'config.ts',
    'config.js',
    // 'config.mjs', // TODO: Change Cosmiconfig to async to support
    'config.json',
    'config.yaml',
    'config.yml',
    'config.cjs',
  ],
  searchStrategy: 'none' as const,
});

/**
 * Load config from saifDir. Resolves saifDir relative to projectDir when saifDir
 * is not absolute.
 *
 * @param saifDir - Path to saifac directory (default "saifac", can be relative to cwd or projectDir)
 * @param projectDir - Project root (for resolving relative saifDir when needed)
 * @returns Parsed and validated config, or empty defaults if no file found
 */
export function loadSaifConfig(saifDir: string, projectDir: string): SaifConfig {
  const configDir = resolve(projectDir, saifDir);
  if (!existsSync(configDir)) {
    return {};
  }

  const result = EXPLORER.search(configDir);
  if (!result?.config) {
    return {};
  }

  try {
    return saifConfigSchema.parse(result.config);
  } catch (err) {
    console.error(`Error parsing config at ${result.filepath}:`);
    console.error(err);
    process.exit(1);
  }
}
