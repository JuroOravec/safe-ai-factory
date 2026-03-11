#!/usr/bin/env tsx
/**
 * Init CLI — initialize codebase indexer for the factory.
 *
 * Usage: saif init [options]
 *   Requires at least one LLM API key.
 */

import { defineCommand, runMain } from 'citty';

import { resolveIndexerProfile } from '../../indexer-profiles/index.js';
import { indexerArg, projectDirArg } from '../args.js';
import { parseProjectDir, resolveProjectName } from '../utils.js';

const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Initialize Saif + codebase indexer',
  },
  args: {
    project: {
      type: 'string',
      alias: 'p',
      description: 'Project name override (default: package.json "name")',
    },
    'project-dir': projectDirArg,
    indexer: indexerArg,
  },
  async run({ args }) {
    const projectDir = parseProjectDir(args);
    const indexerProfile = resolveIndexerProfile(args.indexer);
    const projectName = resolveProjectName(args, projectDir);

    console.log(
      `\nIndexing codebase with ${indexerProfile.displayName} (project: ${projectName})...`,
    );
    await indexerProfile.init({ projectDir, projectName });

    console.log('\nInit complete.');
  },
});

export default initCommand; // export for validation

// Allow running directly: tsx src/cli/commands/init.ts
if (process.argv[1]?.endsWith('init.ts') || process.argv[1]?.endsWith('init.js')) {
  await runMain(initCommand);
}
