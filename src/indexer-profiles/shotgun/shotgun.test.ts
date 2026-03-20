import { afterEach, describe, expect, it, vi } from 'vitest';

import { spawnCapture } from '../../utils/io.js';
import { queryShotgunIndex, resolveShotgunPython } from './shotgun.js';

vi.mock('../../utils/io.js', () => ({
  spawnCapture: vi.fn(),
  spawnAsync: vi.fn(),
}));

describe('resolveShotgunPython', () => {
  afterEach(() => {
    delete process.env.SHOTGUN_PYTHON;
  });

  it('defaults to "python" when SHOTGUN_PYTHON is not set', () => {
    delete process.env.SHOTGUN_PYTHON;
    expect(resolveShotgunPython()).toBe('python');
  });

  it('returns SHOTGUN_PYTHON when set', () => {
    process.env.SHOTGUN_PYTHON = '/usr/local/bin/python3.12';
    expect(resolveShotgunPython()).toBe('/usr/local/bin/python3.12');
  });

  it('trims whitespace from SHOTGUN_PYTHON', () => {
    process.env.SHOTGUN_PYTHON = '  /path/to/python  ';
    expect(resolveShotgunPython()).toBe('/path/to/python');
  });
});

describe('queryShotgunIndex', () => {
  afterEach(() => {
    delete process.env.SHOTGUN_PYTHON;
    vi.clearAllMocks();
  });

  it('invokes python -m shotgun.main and returns raw output', async () => {
    vi.mocked(spawnCapture).mockResolvedValueOnce(
      'Results: 3 rows\nname | path\n---\nfoo | src/foo.ts',
    );

    const result = await queryShotgunIndex({
      graphId: 'abc123',
      question: 'where is foo?',
      projectDir: '/repo',
    });
    expect(result.raw).toContain('Results: 3 rows');
    expect(spawnCapture).toHaveBeenCalledWith({
      command: 'python',
      args: ['-m', 'shotgun.main', 'codebase', 'query', 'abc123', 'where is foo?'],
      cwd: '/repo',
    });
  });

  it('uses SHOTGUN_PYTHON when set', async () => {
    process.env.SHOTGUN_PYTHON = '/path/to/.venv/bin/python';
    vi.mocked(spawnCapture).mockResolvedValueOnce('ok');

    await queryShotgunIndex({ graphId: 'g1', question: 'q', projectDir: '/repo' });
    expect(spawnCapture).toHaveBeenCalledWith({
      command: '/path/to/.venv/bin/python',
      args: ['-m', 'shotgun.main', 'codebase', 'query', 'g1', 'q'],
      cwd: '/repo',
    });
  });

  it('throws on non-zero exit status', async () => {
    vi.mocked(spawnCapture).mockRejectedValueOnce(new Error('exited with code 1: No graph found'));

    await expect(
      queryShotgunIndex({ graphId: 'bad', question: 'q', projectDir: '/repo' }),
    ).rejects.toThrow(/shotgun-sh codebase query failed/);
  });
});
