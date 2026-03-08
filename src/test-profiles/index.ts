/**
 * TestProfile — describes the test language and framework used by the Test Runner container.
 *
 * Supported profiles: ts-vitest | ts-playwright | py-pytest | py-playwright | go-gotest | go-playwright | rs-rusttest | rs-playwright
 *
 * The profile is used by:
 *   - tests-catalog agent   → generates entrypoint paths with correct extension + naming
 *   - tests-coder agent     → generates test code in the correct language/framework
 *   - generateTests → copies the correct helpers/infra template files
 *   - parseTestScript (agents.ts) → loads the profile's test.sh as the default test script
 */

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { gotestProfile } from './go-gotest/profile.js';
import { goPlaywrightProfile } from './go-playwright/profile.js';
import { pyPlaywrightProfile } from './py-playwright/profile.js';
import { pytestProfile } from './py-pytest/profile.js';
import { rsPlaywrightProfile } from './rs-playwright/profile.js';
import { rusttestProfile } from './rs-rusttest/profile.js';
import { tsPlaywrightProfile } from './ts-playwright/profile.js';
import { vitestProfile } from './ts-vitest/profile.js';
import { SUPPORTED_PROFILE_IDS, type SupportedProfileId, type TestProfile } from './types.js';

export { type SupportedProfileId, type TestProfile } from './types.js';

export const SUPPORTED_PROFILES = {
  'ts-vitest': vitestProfile,
  'ts-playwright': tsPlaywrightProfile,
  'py-pytest': pytestProfile,
  'py-playwright': pyPlaywrightProfile,
  'go-gotest': gotestProfile,
  'go-playwright': goPlaywrightProfile,
  'rs-rusttest': rusttestProfile,
  'rs-playwright': rsPlaywrightProfile,
} satisfies Record<SupportedProfileId, TestProfile>;

/** Returns the default profile (ts-vitest). */
export const DEFAULT_PROFILE: TestProfile = SUPPORTED_PROFILES['ts-vitest'];

const _profilesDir = join(fileURLToPath(import.meta.url), '..');

/**
 * Returns the absolute path to the test.sh script for the given profile id.
 * Used by agents.ts as the default --test-script when no override is provided.
 */
export function resolveTestScriptPath(profileId: SupportedProfileId): string {
  return join(_profilesDir, profileId, 'test.sh');
}

/**
 * Returns the absolute path to the Dockerfile for the given profile id.
 * Used by agents.ts as the default --test-image when no override is provided.
 */
export function resolveTestDockerfilePath(profileId: SupportedProfileId): string {
  return join(_profilesDir, profileId, 'Dockerfile');
}

/**
 * Looks up a profile by id. Throws a user-facing error for unsupported ids.
 */
export function resolveTestProfile(id: string): TestProfile {
  if (SUPPORTED_PROFILE_IDS.includes(id as SupportedProfileId)) {
    return SUPPORTED_PROFILES[id as keyof typeof SUPPORTED_PROFILES];
  }
  throw new Error(
    `Unsupported test profile "${id}". Supported profiles: ${SUPPORTED_PROFILE_IDS.join(', ')}.\n` +
      `To add a new language, open a PR adding templates under src/test-profiles/<id>/templates/.`,
  );
}
