/**
 * Recursive discovery of features in saif/features.
 *
 * Supports Next.js-style route groups: directories named (group-name) are
 * traversed. Feature ID = entire relative path from features/.
 *
 * Example:
 *   saif/features/my-feat/              -> feature: my-feat
 *   saif/features/(auth)/login/        -> feature: (auth)/login
 *   saif/features/(auth)/router/       -> feature: (auth)/router
 *   saif/features/(user)/router/       -> feature: (user)/router  (distinct from above)
 */

import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * True if a directory name is a group (Next.js-style), e.g. "(auth)".
 */
export function isGroupDir(dirName: string): boolean {
  return dirName.startsWith('(') && dirName.endsWith(')');
}

/**
 * Recursively scans a base directory for feature directories.
 * Feature ID = relative path from baseDir (e.g. "(auth)/login", "my-feat").
 * First non-parenthesised dir nested within base is the feature dir (path-based only).
 *
 * @param baseDir - Absolute path to scan (e.g. projectDir/saif/features)
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
        features.set(relativePath, fullPath);
      }
    }
  }

  scan(baseDir, '');
  return features;
}

/**
 * Discovers all features under saif/features.
 */
export function discoverCurrentFeatures(projectDir: string, saifDir: string): Map<string, string> {
  const baseDir = join(projectDir, saifDir, 'features');
  return discoverFeatures(baseDir);
}

/**
 * Resolves a feature ID to its absolute path.
 *
 * @throws Error if the feature is not found.
 */
export function resolveFeaturePath(opts: {
  cwd: string;
  saifDir: string;
  featureName: string;
}): string {
  const { cwd, saifDir, featureName } = opts;
  const map = discoverCurrentFeatures(cwd, saifDir);
  const path = map.get(featureName);
  if (!path) {
    const available = [...map.keys()].sort().join(', ') || '(none)';
    throw new Error(`Feature "${featureName}" not found. Available: ${available}`);
  }
  return path;
}

/**
 * Relative path to a feature directory (e.g. "saif/features/add-login"
 * or "saif/features/(auth)/login"). Uses discovery so group paths are correct.
 */
export function getFeatureDirRelative(opts: {
  cwd: string;
  saifDir: string;
  featureName: string;
}): string {
  const absolute = getFeatureDirAbsolute(opts);
  return relative(opts.cwd, absolute);
}

/**
 * Absolute path to a feature directory.
 * Supports Next.js-style groups: feature ID = full path from features/.
 *
 * @param opts.cwd - Project root (or base directory)
 */
export function getFeatureDirAbsolute(opts: {
  cwd: string;
  saifDir: string;
  featureName: string;
}): string {
  return resolveFeaturePath(opts);
}
