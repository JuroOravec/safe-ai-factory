/**
 * Unit tests for config schema validation.
 */

import { describe, expect, it } from 'vitest';

import { saifctlConfigSchema } from './schema.js';

describe('saifctlConfigSchema', () => {
  describe('agentModels', () => {
    it('accepts valid agent keys', () => {
      const result = saifctlConfigSchema.parse({
        defaults: {
          agentModels: { coder: 'openai/gpt-4o', 'vague-specs-check': 'openai/gpt-4o-mini' },
        },
      });
      expect(result.defaults?.agentModels).toEqual({
        coder: 'openai/gpt-4o',
        'vague-specs-check': 'openai/gpt-4o-mini',
      });
    });

    it('rejects unknown agent keys', () => {
      expect(() =>
        saifctlConfigSchema.parse({
          defaults: {
            agentModels: { 'bad-agent': 'openai/gpt-4o' },
          },
        }),
      ).toThrow(/agentModels keys must be one of/);
    });

    it('accepts undefined agentModels', () => {
      const result = saifctlConfigSchema.parse({ defaults: {} });
      expect(result.defaults?.agentModels).toBeUndefined();
    });
  });

  describe('agentBaseUrls', () => {
    it('accepts valid agent keys', () => {
      const result = saifctlConfigSchema.parse({
        defaults: {
          agentBaseUrls: { coder: 'https://api.example.com/v1' },
        },
      });
      expect(result.defaults?.agentBaseUrls).toEqual({
        coder: 'https://api.example.com/v1',
      });
    });

    it('rejects unknown agent keys', () => {
      expect(() =>
        saifctlConfigSchema.parse({
          defaults: {
            agentBaseUrls: { unknown: 'https://api.example.com/v1' },
          },
        }),
      ).toThrow(/agentBaseUrls keys must be one of/);
    });
  });

  describe('storages', () => {
    it('accepts valid storage keys', () => {
      const result = saifctlConfigSchema.parse({
        defaults: {
          storages: { runs: 'local', tasks: 's3://bucket/tasks' },
        },
      });
      expect(result.defaults?.storages).toEqual({
        runs: 'local',
        tasks: 's3://bucket/tasks',
      });
    });

    it('rejects unknown storage keys', () => {
      expect(() =>
        saifctlConfigSchema.parse({
          defaults: {
            storages: { badkey: 'local' },
          },
        }),
      ).toThrow(/storages keys must be one of/);
    });
  });
});
