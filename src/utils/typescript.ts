import { spawnWait } from './io.js';

// TypeScript validation: ensure generated spec files have no syntax/type errors.
// - catch: spawn threw (e.g. npx/tsc not on PATH). Non-fatal — validation skipped.
// - status === 0: tsc found no errors. Validation passed.
// - status !== 0: tsc ran and reported real errors (bad imports, broken syntax).
export async function validateTypescript(opts: {
  files: string[];
  cwd: string;
  errMessage: string;
}) {
  const { files, cwd, errMessage } = opts;
  try {
    const tscResult = await spawnWait({
      command: 'npx',
      args: [
        'tsc',
        '--noEmit',
        '--allowJs',
        '--checkJs',
        'false',
        '--strict',
        'false',
        '--moduleResolution',
        'bundler',
        '--module',
        'esnext',
        '--target',
        'esnext',
        '--skipLibCheck',
        'true',
        ...files,
      ],
      cwd,
      timeoutMs: 30_000,
    });
    if (tscResult.code === 0) {
      console.log(`  TypeScript validation passed.`);
    } else {
      const output = tscResult.stdout + tscResult.stderr;
      console.error(`  ${errMessage}`);
      for (const line of output.split('\n').filter(Boolean).slice(0, 20)) {
        console.error(`    ${line}`);
      }
      process.exit(1);
    }
  } catch {
    console.warn(`  TypeScript validation skipped (tsc not available).`);
  }
}
