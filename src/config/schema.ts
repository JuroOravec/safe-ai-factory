/**
 * Schema for saif/config.* file.
 *
 * All configurable options can be specified under `defaults`. CLI flags override
 * config defaults. Config uses richer formats where applicable (e.g. model overrides
 * as object instead of comma-separated strings).
 */

import { z } from 'zod';

export const saifConfigDefaultsSchema = z.object({
  // Run params
  maxRuns: z.number().int().positive().optional(),
  testRetries: z.number().int().positive().optional(),
  resolveAmbiguity: z.enum(['off', 'prompt', 'ai']).optional(),
  dangerousDebug: z.boolean().optional(),
  cedarPolicyPath: z.string().optional(),
  coderImage: z.string().optional(),
  gateRetries: z.number().int().positive().optional(),
  agentLogFormat: z.enum(['openhands', 'raw']).optional(),
  push: z.string().optional(),
  pr: z.boolean().optional(),
  gitProvider: z.enum(['github', 'gitlab', 'bitbucket', 'azure', 'gitea']).optional(),
  // Agent env vars (object form)
  agentEnv: z.record(z.string(), z.string()).optional(),

  // Model overrides (object form)
  globalModel: z.string().optional(),
  globalBaseUrl: z.string().optional(),
  agentModels: z.record(z.string(), z.string()).optional(),
  agentBaseUrls: z.record(z.string(), z.string()).optional(),

  // Storage (object form)
  globalStorage: z.string().optional(),
  storages: z.record(z.string(), z.string()).optional(),

  // Profile IDs
  testProfile: z.string().optional(),
  agentProfile: z.string().optional(),
  designerProfile: z.string().optional(),
  indexerProfile: z.string().optional(),
  sandboxProfile: z.string().optional(),

  // Paths and project
  // NOTE: projectDir/saifDir are NOT in config - required to find the config file
  project: z.string().optional(),
  sandboxBaseDir: z.string().optional(),

  // Script paths (overrides for profile defaults)
  testScript: z.string().optional(),
  testImage: z.string().optional(),
  startupScript: z.string().optional(),
  stageScript: z.string().optional(),
  gateScript: z.string().optional(),
  agentScript: z.string().optional(),
  agentStartScript: z.string().optional(),
});

export const saifConfigSchema = z.object({
  defaults: saifConfigDefaultsSchema.optional(),
});

export type SaifConfig = z.infer<typeof saifConfigSchema>;
export type SaifConfigDefaults = z.infer<typeof saifConfigDefaultsSchema>;
