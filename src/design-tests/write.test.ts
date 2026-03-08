/**
 * Unit tests for the tests writer orchestrator.
 *
 * Tests the scaffolding path without touching the LLM — the tests writer agent is mocked
 * to return a deterministic TypeScript stub. Real filesystem is used via temp dirs.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getChangeDirAbsolute } from '../constants.js';
import { DEFAULT_PROFILE } from '../test-profiles/index.js';
import { generateTests } from './write.js';

// ---------------------------------------------------------------------------
// Mock the coder agent so tests don't hit the LLM
// ---------------------------------------------------------------------------
vi.mock('../design-tests/agents/tests-writer.js', () => ({
  runTestsWriterAgent: vi
    .fn()
    .mockResolvedValue(
      `/* eslint-disable */\n// @ts-nocheck\nimport { describe, it, expect } from 'vitest';\ndescribe('mock', () => { it('placeholder', () => { expect(true).toBe(true); }); });\n`,
    ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  const dir = join(tmpdir(), `blackbox-test-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Build a TestCatalog JSON string with entrypoints */
function imperativeCatalog(extra: object = {}): string {
  return JSON.stringify({
    version: '1.0',
    changeName: 'test-change',
    specDir: 'openspec/changes/test-change',
    containers: {
      staging: { sidecarPort: 8080, sidecarPath: '/exec' },
      additional: [],
    },
    testCases: [
      {
        id: 'tc-001',
        title: 'Happy path',
        description: 'Does the thing',
        tracesTo: [],
        category: 'happy_path',
        visibility: 'public',
        entrypoint: 'public/happy.spec.ts',
      },
      {
        id: 'tc-002',
        title: 'Holdout boundary',
        description: 'Boundary case',
        tracesTo: [],
        category: 'boundary',
        visibility: 'hidden',
        entrypoint: 'hidden/boundary.spec.ts',
      },
    ],
    ...extra,
  });
}

// ---------------------------------------------------------------------------
// generateTests — main path
// ---------------------------------------------------------------------------

describe('generateTests', () => {
  let projectDir: string;
  const openspecDir = 'openspec';
  const changeName = 'test-change';

  beforeEach(() => {
    projectDir = makeTempDir();
    const testsDir = join(
      getChangeDirAbsolute({ cwd: projectDir, openspecDir, changeName }),
      'tests',
    );
    mkdirSync(testsDir, { recursive: true });
    writeFileSync(join(testsDir, 'tests.json'), imperativeCatalog(), 'utf8');
  });

  it('writes helpers.ts', async () => {
    const result = await generateTests({
      changeName,
      projectDir,
      openspecDir,
      testProfile: DEFAULT_PROFILE,
    });
    const helpersPath = join(result.testsDir, 'helpers.ts');
    expect(existsSync(helpersPath)).toBe(true);
    const content = readFileSync(helpersPath, 'utf8');
    expect(content).toContain('execSidecar');
    expect(content).toContain('baseUrl');
  });

  it('writes infra.spec.ts', async () => {
    const result = await generateTests({
      changeName,
      projectDir,
      openspecDir,
      testProfile: DEFAULT_PROFILE,
    });
    const infraPath = join(result.testsDir, 'infra.spec.ts');
    expect(existsSync(infraPath)).toBe(true);
    const content = readFileSync(infraPath, 'utf8');
    expect(content).toContain('sidecar:health');
  });

  it('generates spec files for each unique entrypoint', async () => {
    const result = await generateTests({
      changeName,
      projectDir,
      openspecDir,
      testProfile: DEFAULT_PROFILE,
    });

    const publicSpec = join(result.testsDir, 'public', 'happy.spec.ts');
    const hiddenSpec = join(result.testsDir, 'hidden', 'boundary.spec.ts');

    expect(existsSync(publicSpec)).toBe(true);
    expect(existsSync(hiddenSpec)).toBe(true);
  });

  it('reports generated and skipped files', async () => {
    const result = await generateTests({
      changeName,
      projectDir,
      openspecDir,
      testProfile: DEFAULT_PROFILE,
    });
    expect(result.generatedFiles).toContain('public/happy.spec.ts');
    expect(result.generatedFiles).toContain('hidden/boundary.spec.ts');
    expect(result.skippedFiles).toHaveLength(0);
  });

  it('does not overwrite an existing spec file', async () => {
    const testsDir = join(
      getChangeDirAbsolute({ cwd: projectDir, openspecDir, changeName }),
      'tests',
    );
    const existingPath = join(testsDir, 'public', 'happy.spec.ts');
    mkdirSync(join(testsDir, 'public'), { recursive: true });
    writeFileSync(existingPath, '// custom content', 'utf8');

    const result = await generateTests({
      changeName,
      projectDir,
      openspecDir,
      testProfile: DEFAULT_PROFILE,
    });

    expect(readFileSync(existingPath, 'utf8')).toBe('// custom content');
    expect(result.skippedFiles).toContain('public/happy.spec.ts');
    expect(result.generatedFiles).not.toContain('public/happy.spec.ts');
  });

  it('does not overwrite helpers.ts when it already exists', async () => {
    const testsDir = join(
      getChangeDirAbsolute({ cwd: projectDir, openspecDir, changeName }),
      'tests',
    );
    const helpersPath = join(testsDir, 'helpers.ts');
    writeFileSync(helpersPath, '// custom helpers', 'utf8');

    await generateTests({
      changeName,
      projectDir,
      openspecDir,
      testProfile: DEFAULT_PROFILE,
    });

    expect(readFileSync(helpersPath, 'utf8')).toBe('// custom helpers');
  });

  it('returns correct testCaseCount', async () => {
    const result = await generateTests({
      changeName,
      projectDir,
      openspecDir,
      testProfile: DEFAULT_PROFILE,
    });
    expect(result.testCaseCount).toBe(2);
  });

  it('always writes infra.spec.ts (even for web-only containers)', async () => {
    const testsDir = join(
      getChangeDirAbsolute({ cwd: projectDir, openspecDir, changeName }),
      'tests',
    );
    const webCatalog = JSON.stringify({
      version: '1.0',
      changeName,
      specDir: 'openspec/changes/test-change',
      containers: {
        staging: { baseUrl: 'http://staging:3000' },
        additional: [],
      },
      testCases: [
        {
          id: 'tc-001',
          title: 'API test',
          description: 'Hits API',
          tracesTo: [],
          category: 'happy_path',
          visibility: 'public',
          entrypoint: 'public/api.spec.ts',
        },
      ],
    });
    writeFileSync(join(testsDir, 'tests.json'), webCatalog, 'utf8');

    const result = await generateTests({
      changeName,
      projectDir,
      openspecDir,
      testProfile: DEFAULT_PROFILE,
    });
    expect(existsSync(join(result.testsDir, 'infra.spec.ts'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateTests — error cases
// ---------------------------------------------------------------------------

describe('generateTests (error cases)', () => {
  it('throws when tests.json does not exist', async () => {
    const projectDir = makeTempDir();
    await expect(
      generateTests({
        changeName: 'missing',
        projectDir,
        openspecDir: 'openspec',
        testProfile: DEFAULT_PROFILE,
      }),
    ).rejects.toThrow(/tests.json not found/);
  });

  it('throws when tests.json fails schema validation', async () => {
    const projectDir = makeTempDir();
    const testsDir = join(
      getChangeDirAbsolute({ cwd: projectDir, openspecDir: 'openspec', changeName: 'bad-change' }),
      'tests',
    );
    mkdirSync(testsDir, { recursive: true });
    writeFileSync(join(testsDir, 'tests.json'), '{"invalid": true}', 'utf8');
    await expect(
      generateTests({
        changeName: 'bad-change',
        projectDir,
        openspecDir: 'openspec',
        testProfile: DEFAULT_PROFILE,
      }),
    ).rejects.toThrow(/schema validation/);
  });
});
