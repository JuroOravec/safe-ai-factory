/**
 * Recursive discovery of features/specs in openspec/changes and openspec/specs.
 *
 * Supports Next.js-style route groups: directories named (group-name) are
 * traversed. Feature ID = entire relative path from changes/ or specs/.
 *
 * Example:
 *   openspec/changes/my-feat/              -> feature: my-feat
 *   openspec/changes/(auth)/login/        -> feature: (auth)/login
 *   openspec/changes/(auth)/router/       -> feature: (auth)/router
 *   openspec/changes/(user)/router/       -> feature: (user)/router  (distinct from above)
 */

import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const SPEC_FILE = '.openspec.yaml';

/**
 * True if a directory name is a group (Next.js-style), e.g. "(auth)".
 */
export function isGroupDir(dirName: string): boolean {
  return dirName.startsWith('(') && dirName.endsWith(')');
}

/**
 * Recursively scans a base directory for feature directories.
 * Feature ID = relative path from baseDir (e.g. "(auth)/login", "my-feat").
 * Only includes dirs that contain .openspec.yaml.
 *
 * @param baseDir - Absolute path to scan (e.g. projectDir/openspec/changes)
 * @returns Map<featureId, absolutePath> where featureId is the relative path
 */
export function discoverFeatures(baseDir: string): Map<string, string> {
  const features = new Map<string, string>();

  function scan(currentPath: string, relativePrefix: string): void {
    if (!existsSync(currentPath)) return;

    const entries = readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const fullPath = join(currentPath, entry.name);
      const relativePath = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;

      if (isGroupDir(entry.name)) {
        scan(fullPath, relativePath);
      } else {
        const specPath = join(fullPath, SPEC_FILE);
        if (!existsSync(specPath)) continue;

        features.set(relativePath, fullPath);
      }
    }
  }

  scan(baseDir, '');
  return features;
}

/**
 * Discovers all features under openspec/changes (or openspecs/changes).
 */
export function discoverChanges(projectDir: string, openspecDir: string): Map<string, string> {
  const baseDir = join(projectDir, openspecDir, 'changes');
  return discoverFeatures(baseDir);
}

/**
 * Discovers all specs under openspec/specs (or openspecs/specs).
 */
export function discoverSpecs(projectDir: string, openspecDir: string): Map<string, string> {
  const baseDir = join(projectDir, openspecDir, 'specs');
  return discoverFeatures(baseDir);
}

/**
 * Resolves a feature ID to its absolute path.
 *
 * @throws Error if the feature is not found.
 */
export function resolveFeaturePath(opts: {
  cwd: string;
  openspecDir: string;
  featureName: string;
}): string {
  const { cwd, openspecDir, featureName } = opts;
  const map = discoverChanges(cwd, openspecDir);
  const path = map.get(featureName);
  if (!path) {
    const available = [...map.keys()].sort().join(', ') || '(none)';
    throw new Error(`Feature "${featureName}" not found. Available: ${available}`);
  }
  return path;
}

/**
 * Relative path to a feature directory (e.g. "openspec/changes/add-login"
 * or "openspec/changes/(auth)/login"). Uses discovery so group paths are correct.
 */
export function getFeatureDirRelative(opts: {
  cwd: string;
  openspecDir: string;
  featureName: string;
}): string {
  const absolute = getFeatureDirAbsolute(opts);
  return relative(opts.cwd, absolute);
}

/**
 * Absolute path to a feature directory.
 * Supports Next.js-style groups: feature ID = full path from changes/.
 *
 * @param opts.cwd - Project root (or base directory)
 */
export function getFeatureDirAbsolute(opts: {
  cwd: string;
  openspecDir: string;
  featureName: string;
}): string {
  return resolveFeaturePath(opts);
}
