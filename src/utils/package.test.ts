import { describe, expect, it } from 'vitest';

import { npmPackageNameToProjectSlug } from './package.js';

describe('npmPackageNameToProjectSlug', () => {
  it('strips npm scope', () => {
    expect(npmPackageNameToProjectSlug('@safe-ai-factory/saifctl')).toBe('saifctl');
  });

  it('leaves unscoped names unchanged', () => {
    expect(npmPackageNameToProjectSlug('my-app')).toBe('my-app');
  });
});
