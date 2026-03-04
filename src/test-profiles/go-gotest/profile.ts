import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import type { TestProfile, ValidateFilesOpts } from '../types.js';

/**
 * Best-effort static analysis for generated Go test files using `go vet`.
 * Runs against the public/ and hidden/ subdirectories so the package context
 * is correct. Skips silently if `go` is not on PATH.
 */
function gotestValidateFiles(opts: ValidateFilesOpts): void {
  const { testsDir, generatedFiles } = opts;
  if (generatedFiles.length === 0) return;
  if (!generatedFiles.some((f) => f.endsWith('_test.go'))) return;

  console.log(`\nValidating generated spec files (go vet)...`);

  // go vet needs to be run per package directory, not per file.
  const subdirs = [
    ...new Set(
      generatedFiles
        .filter((f) => f.endsWith('_test.go'))
        .map((f) => join(testsDir, f.split('/')[0] ?? '.')),
    ),
  ];

  try {
    for (const dir of subdirs) {
      const result = spawnSync('go', ['vet', './...'], {
        cwd: dir,
        encoding: 'utf8',
        timeout: 30_000,
      });
      if (result.error) throw result.error; // binary not found → ENOENT
      if (result.status !== 0) {
        const output = (result.stdout ?? '') + (result.stderr ?? '');
        console.error(`  ${opts.errMessage}`);
        for (const line of output.split('\n').filter(Boolean).slice(0, 20)) {
          console.error(`    ${line}`);
        }
        process.exit(1);
      }
    }
    console.log(`  Go validation passed.`);
  } catch {
    console.warn(`  Go validation skipped (go not available).`);
  }
}

export const gotestProfile: TestProfile = {
  id: 'go-gotest',
  language: 'Go',
  framework: 'go test',
  specExtension: '_test.go',
  fileNamingRule:
    'Files MUST use the "_test.go" suffix (e.g. "public/happy_path_test.go"). Every file MUST declare `package public_test` (for public/) or `package hidden_test` (for hidden/).',
  helpersFilename: 'helpers.go',
  infraFilename: 'infra_test.go',
  importRules:
    'Include `package public_test` (or `hidden_test`) at the top. Import `"testing"` and the helpers package. Use `t *testing.T` for all test functions.',
  assertionRules:
    'Use `t.Fatalf`, `t.Errorf`, or a helper like `github.com/stretchr/testify/assert`. Test function names MUST start with `Test` (e.g. `func TestHappyPath(t *testing.T)`).',
  validateFiles: gotestValidateFiles,
};
