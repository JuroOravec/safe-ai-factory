import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export default async function validateSpecsTests() {
  const specsDir = join(process.cwd(), 'specs');

  if (!existsSync(specsDir)) {
    return; // No specs dir, nothing to validate
  }

  let failed = false;

  function walkDir(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });

    let hasReadme = false;
    let hasTest = false;

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Ignore directories starting with _
        if (entry.name.startsWith('_')) {
          continue;
        }
        walkDir(join(dir, entry.name));
      } else if (entry.isFile()) {
        if (entry.name.toLowerCase() === 'readme.md') {
          hasReadme = true;
        }
        if (entry.name.endsWith('.test.ts')) {
          hasTest = true;
        }
      }
    }

    // Exempt the root specs/ directory itself from requiring a test file
    if (dir !== specsDir && hasReadme && !hasTest) {
      console.error(`❌ Missing TDD tests in ${dir}`);
      console.error(
        `   Hint: Any feature directory in specs/ with a README.md must also contain at least one *.test.ts file.`,
      );
      failed = true;
    }
  }

  walkDir(specsDir);

  if (failed) {
    throw new Error('One or more specs/ directories are missing a *.test.ts file.');
  }
}
