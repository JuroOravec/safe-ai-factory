import { execSync } from 'node:child_process';

/**
 * Validates that all test files containing "e2e" in their name use the suffix
 * convention (xxx-e2e.test.ts or xxx.e2e.test.ts), not the prefix (e2e-xxx.test.ts).
 */
export default async function validateE2eTestNaming() {
  const output = execSync('git ls-files "**/*.test.ts" "**/*.test.js"', { encoding: 'utf-8' });
  const files = output.split('\n').filter((f) => f.trim() !== '');

  const violations: string[] = [];

  for (const file of files) {
    const basename = file.split('/').pop() ?? file;
    if (!basename.toLowerCase().includes('e2e')) {
      continue;
    }
    // Violation: e2e as prefix (e2e-xxx.test.ts)
    if (/^e2e[-.]/i.test(basename)) {
      violations.push(file);
    }
  }

  if (violations.length > 0) {
    console.error('❌ E2E test files must use the suffix convention, not prefix.');
    console.error('   Use xxx-e2e.test.ts or xxx.e2e.test.ts, not e2e-xxx.test.ts');
    console.error('');
    for (const f of violations) {
      console.error(`   ${f}`);
    }
    throw new Error('One or more e2e test files use the prefix naming (e2e-xxx).');
  }
}
