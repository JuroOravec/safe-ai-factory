/**
 * Check pipeline — Types, Lint, Dead Code, Format, Tests & Coverage, Custom Constraints.
 * Used by CI and for local verification before commit/push.
 *
 * Exported as runCheck() for use by the commands CLI.
 */

import { spawn } from 'node:child_process';

const phases = [
  { name: 'Types', command: 'npx tsc --noEmit' },
  { name: 'Lint', command: 'npm run lint' },
  { name: 'Dead Code', command: 'npm run knip' },
  { name: 'Format', command: 'npm run format:check' },
  { name: 'Custom Constraints', command: 'npm run validate' },
  { name: 'Tests & Coverage', command: 'npm run coverage' },
];

async function runPhase(opts: {
  name: string;
  command: string;
  captureOutput: boolean;
}): Promise<string> {
  const { name, command, captureOutput } = opts;
  return new Promise((resolve, reject) => {
    const [cmd, ...cmdArgs] = command.split(' ');

    const child = spawn(cmd, cmdArgs, {
      stdio: captureOutput ? 'pipe' : 'inherit',
      // Ensure commands like 'npm' and 'npx' can be spawned properly,
      // especially on windows, but generally shell:true helps cross-platform with npm
      shell: true,
    });

    let output = '';
    if (captureOutput) {
      child.stdout?.on('data', (data: string | Buffer) => {
        output += String(data);
      });
      child.stderr?.on('data', (data: string | Buffer) => {
        output += String(data);
      });
    }

    child.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject({ name, command, output, code });
      }
    });

    child.on('error', (err) => {
      reject({ name, command, output: output + err.message, code: 1 });
    });
  });
}

/**
 * Run the check pipeline with optional agent reporter mode.
 * When reporter=agent, stdout is JSON only (status, phase, command, details).
 */
export async function runCheck(opts: { reporter?: string }): Promise<void> {
  const isAgentReporter = opts.reporter === 'agent';

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const phaseName = `Phase ${i + 1}: ${phase.name}`;
    try {
      if (!isAgentReporter) {
        console.log(`\n--- Running ${phaseName} ---`);
      }
      await runPhase({ name: phaseName, command: phase.command, captureOutput: isAgentReporter });
    } catch (error) {
      const err = error as { code: number; output: string; name: string; command: string };
      if (isAgentReporter) {
        const output = err.output;
        const lines = output.split('\n');
        const lastLines = lines.slice(-50).join('\n').trim();
        console.log(
          JSON.stringify({
            status: 'FAILED',
            phase: phaseName,
            command: phase.command,
            details: lastLines || 'No output',
          }),
        );
        process.exit(1);
      } else {
        console.error(`\n❌ ${phaseName} failed with exit code ${err.code}`);
        process.exit(1);
      }
    }
  }

  if (isAgentReporter) {
    console.log(JSON.stringify({ status: 'PASSED' }));
  } else {
    console.log('\n✅ All phases passed successfully.');
  }
}
