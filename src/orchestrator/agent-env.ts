/**
 * Filters user-supplied agent env variables before passing to a provisioner.
 * Reserved keys must not shadow factory-injected variables.
 */

import { consola } from '../logger.js';

// Since these keys are injected into the coder container, we raise error
// if they are set by the user, because that likely means that the user
// is trying to override the coder container's environment variables,
// which is not allowed.
const RESERVED_ENV_KEYS = new Set([
  'SAIFAC_INITIAL_TASK',
  'SAIFAC_GATE_RETRIES',
  'SAIFAC_GATE_SCRIPT',
  'SAIFAC_REVIEWER_ENABLED',
  'SAIFAC_STARTUP_SCRIPT',
  'SAIFAC_AGENT_INSTALL_SCRIPT',
  'SAIFAC_AGENT_SCRIPT',
  'SAIFAC_TASK_PATH',
  'SAIFAC_WORKSPACE_BASE',
  'LLM_API_KEY',
  'LLM_MODEL',
  'LLM_PROVIDER',
  'LLM_BASE_URL',
  'REVIEWER_LLM_PROVIDER',
  'REVIEWER_LLM_MODEL',
  'REVIEWER_LLM_API_KEY',
  'REVIEWER_LLM_BASE_URL',
]);

/**
 * Filters agentEnv, emitting warnings for any keys that shadow reserved
 * factory variables. Returns a safe copy.
 */
export function filterAgentEnv(agentEnv: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(agentEnv)) {
    if (key.startsWith('SAIFAC_') || RESERVED_ENV_KEYS.has(key)) {
      consola.warn(
        `[agent-runner] WARNING: --agent-env ${key} is a reserved factory variable and will be ignored.`,
      );
      continue;
    }
    result[key] = val;
  }
  return result;
}
