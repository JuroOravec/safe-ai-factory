#!/usr/bin/env tsx
/**
 * Init CLI — initialize Saifctl config, saifctl directory, and codebase indexer.
 *
 * Usage: saifctl init [options]
 *   Creates saifctl/ and scaffolds saifctl/config.ts when no config exists.
 *   Requires at least one LLM API key for indexer operations.
 */

import { defineCommand, runMain } from 'citty';

import { scaffoldSaifctlConfig } from '../../config/scaffold.js';
import { resolveIndexerProfile } from '../../indexer-profiles/index.js';
import { consola } from '../../logger.js';
import { indexerArg, projectDirArg, saifDirArg } from '../args.js';
import {
  readProjectDirFromCli,
  readSaifDirFromCli,
  resolveCliProjectDir,
  resolveProjectName,
  resolveSaifDirRelative,
} from '../utils.js';

const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Initialize Saifctl config + codebase indexer',
  },
  args: {
    project: {
      type: 'string',
      alias: 'p',
      description: 'Project name override (default: package.json "name")',
    },
    'project-dir': projectDirArg,
    'saifctl-dir': saifDirArg,
    indexer: indexerArg,
  },
  async run({ args }) {
    const projectDir = resolveCliProjectDir(readProjectDirFromCli(args));
    const saifDir = resolveSaifDirRelative(readSaifDirFromCli(args));
    const indexerProfile = resolveIndexerProfile(args.indexer);
    const projectName = await resolveProjectName({ project: args.project, projectDir });

    const scaffolded = await scaffoldSaifctlConfig(saifDir, projectDir);
    if (scaffolded) {
      consola.log(`\nCreated ${saifDir}/config.ts (no config found).`);
    }

    consola.log(
      `\nIndexing codebase with ${indexerProfile.displayName} (project: ${projectName})...`,
    );
    await indexerProfile.init({ projectDir, projectName });

    consola.log('\nInit complete.');
  },
});

export default initCommand; // export for validation

// Allow running directly: tsx src/cli/commands/init.ts
if (process.argv[1]?.endsWith('init.ts') || process.argv[1]?.endsWith('init.js')) {
  await runMain(initCommand);
}
