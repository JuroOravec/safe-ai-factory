import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  discoverCurrentFeatures,
  discoverFeatures,
  isGroupDir,
  resolveFeaturePath,
} from './discover.js';

const TEST_BASE = join(tmpdir(), `discover-features-${Date.now()}`);

function createDir(path: string) {
  const full = join(TEST_BASE, path);
  mkdirSync(full, { recursive: true });
  return full;
}

describe('discover-features', () => {
  afterEach(() => {
    try {
      rmSync(TEST_BASE, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('isGroupDir', () => {
    it('returns true for (group) style names', () => {
      expect(isGroupDir('(auth)')).toBe(true);
      expect(isGroupDir('(core)')).toBe(true);
      expect(isGroupDir('(user)')).toBe(true);
    });
    it('returns false for normal dir names', () => {
      expect(isGroupDir('auth')).toBe(false);
      expect(isGroupDir('login')).toBe(false);
      expect(isGroupDir('my-feat')).toBe(false);
    });
    it('returns false for partial parens', () => {
      expect(isGroupDir('(auth')).toBe(false);
      expect(isGroupDir('auth)')).toBe(false);
    });
  });

  describe('discoverFeatures', () => {
    it('finds flat features', () => {
      createDir('features/my-feat');
      createDir('features/add-login');

      const map = discoverFeatures(join(TEST_BASE, 'features'));
      expect(map.size).toBe(2);
      expect(map.get('my-feat')).toContain('my-feat');
      expect(map.get('add-login')).toContain('add-login');
    });

    it('finds features inside groups with path-based IDs', () => {
      createDir('features/(auth)/login');
      createDir('features/(auth)/logout');
      createDir('features/(core)/profile');

      const map = discoverFeatures(join(TEST_BASE, 'features'));
      expect(map.size).toBe(3);
      expect(map.get('(auth)/login')).toContain('login');
      expect(map.get('(auth)/logout')).toContain('logout');
      expect(map.get('(core)/profile')).toContain('profile');
    });

    it('treats same leaf name in different groups as distinct features', () => {
      createDir('features/(auth)/router');
      createDir('features/(user)/router');

      const map = discoverFeatures(join(TEST_BASE, 'features'));
      expect(map.size).toBe(2);
      expect(map.get('(auth)/router')).toBeDefined();
      expect(map.get('(user)/router')).toBeDefined();
    });

    it('includes all non-group dirs (path-based)', () => {
      createDir('features/valid-feat');
      mkdirSync(join(TEST_BASE, 'features', 'no-spec'), { recursive: true });

      const map = discoverFeatures(join(TEST_BASE, 'features'));
      expect(map.size).toBe(2);
      expect(map.has('valid-feat')).toBe(true);
      expect(map.has('no-spec')).toBe(true);
    });
  });

  describe('discoverCurrentFeatures', () => {
    it('scans saif/features', () => {
      mkdirSync(join(TEST_BASE, 'saif'), { recursive: true });
      createDir('saif/features/feat-a');

      const map = discoverCurrentFeatures(TEST_BASE, 'saif');
      expect(map.size).toBe(1);
      expect(map.get('feat-a')).toContain('feat-a');
    });
  });

  describe('resolveFeaturePath', () => {
    it('returns path for existing feature', () => {
      mkdirSync(join(TEST_BASE, 'saif'), { recursive: true });
      createDir('saif/features/my-feat');

      const path = resolveFeaturePath({
        cwd: TEST_BASE,
        saifDir: 'saif',
        featureName: 'my-feat',
      });
      expect(path).toContain('my-feat');
      expect(path).toContain('saif');
    });

    it('resolves path-based feature ID', () => {
      mkdirSync(join(TEST_BASE, 'saif'), { recursive: true });
      createDir('saif/features/(auth)/login');

      const path = resolveFeaturePath({
        cwd: TEST_BASE,
        saifDir: 'saif',
        featureName: '(auth)/login',
      });
      expect(path).toContain('login');
      expect(path).toContain('auth');
    });

    it('throws for missing feature', () => {
      mkdirSync(join(TEST_BASE, 'saif'), { recursive: true });

      expect(() =>
        resolveFeaturePath({ cwd: TEST_BASE, saifDir: 'saif', featureName: 'nonexistent' }),
      ).toThrow(/Feature "nonexistent" not found/);
    });
  });
});
