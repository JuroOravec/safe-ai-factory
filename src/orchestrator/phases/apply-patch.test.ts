import { describe, expect, it } from 'vitest';

import {
  computeRunCommitsDiffHash,
  defaultHostApplyBranchName,
  HOST_APPLY_DIFF_HASH_LEN,
  resolveHostApplyBranchName,
} from './apply-patch.js';

describe('host apply branch naming', () => {
  it('computes stable diff hash (length HOST_APPLY_DIFF_HASH_LEN)', () => {
    const commits = [
      { message: 'a', diff: 'diff1\n' },
      { message: 'b', diff: 'diff2\n' },
    ];
    const h = computeRunCommitsDiffHash(commits);
    expect(h).toHaveLength(HOST_APPLY_DIFF_HASH_LEN);
    expect(h).toMatch(/^[0-9a-f]+$/);
    expect(computeRunCommitsDiffHash(commits)).toBe(h);
  });

  it('default branch uses saifac/<feature>-<runId>-<hash>', () => {
    const commits = [{ message: 'a', diff: 'x\n' }];
    const b = defaultHostApplyBranchName({
      featureName: 'my-feature',
      runId: 'r1',
      commits,
    });
    expect(b).toMatch(new RegExp(`^saifac/my-feature-r1-[0-9a-f]{${HOST_APPLY_DIFF_HASH_LEN}}$`));
  });

  it('resolveHostApplyBranchName uses override when set', () => {
    const commits = [{ message: 'a', diff: 'x\n' }];
    expect(
      resolveHostApplyBranchName({
        featureName: 'f',
        runId: 'r',
        commits,
        targetBranch: 'custom/name',
      }),
    ).toBe('custom/name');
    expect(
      resolveHostApplyBranchName({ featureName: 'f', runId: 'r', commits, targetBranch: null }),
    ).toMatch(new RegExp(`^saifac/f-r-[0-9a-f]{${HOST_APPLY_DIFF_HASH_LEN}}$`));
  });
});
