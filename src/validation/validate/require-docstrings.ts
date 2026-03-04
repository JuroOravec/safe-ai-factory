import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export default async function validateDocstrings() {
  const output = execSync('git ls-files "src/**/*.ts"', {
    encoding: 'utf-8',
  });
  const files = output.split('\n').filter((f) => {
    return (
      f.trim() !== '' &&
      !f.endsWith('.test.ts') &&
      !f.includes('/validate/') &&
      !f.includes('/__generated__/')
    );
  });

  let failed = false;

  const exportRegex =
    /^export\s+(?:async\s+)?(function|class|interface|type|const)\s+([a-zA-Z0-9_]+)/gm;

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    let match;

    while ((match = exportRegex.exec(content)) !== null) {
      const exportType = match[1];
      const exportName = match[2];

      const textBefore = content.substring(0, match.index);
      const trimmedBefore = textBefore.trimEnd();

      if (!trimmedBefore.endsWith('*/')) {
        console.error(`❌ Missing docstring for 'export ${exportType} ${exportName}' in ${file}`);
        failed = true;
      } else {
        const lastCommentStart = trimmedBefore.lastIndexOf('/*');
        if (
          lastCommentStart === -1 ||
          !trimmedBefore.substring(lastCommentStart).startsWith('/**')
        ) {
          console.error(
            `❌ Invalid docstring (must start with /**) for 'export ${exportType} ${exportName}' in ${file}`,
          );
          failed = true;
        }
      }
    }
  }

  if (failed) {
    throw new Error('One or more exports are missing TSDoc/JSDoc comments.');
  }
}
