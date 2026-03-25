/**
 * Helpers for {@link RunRule} — prompt selection and lifecycle (once-rule consumption).
 */

import { randomBytes } from 'node:crypto';

import type { RunRule, RunRuleScope } from './types.js';

/** Short stable id: 6 lowercase hex characters (3 random bytes). */
export function newRunRuleId(): string {
  return randomBytes(3).toString('hex');
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Rules that belong in the agent task: `always` every round; `once` only until consumed.
 * Sorted by {@link RunRule#createdAt} (chronological).
 */
export function rulesForPrompt(rules: readonly RunRule[] | undefined): RunRule[] {
  if (rules == null || rules.length === 0) return [];
  const active = rules.filter(
    (r) => r.scope === 'always' || (r.scope === 'once' && r.consumedAt == null),
  );
  return active.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * IDs of `once` rules that are currently active (would appear in the prompt).
 */
export function activeOnceRuleIds(rules: readonly RunRule[]): string[] {
  return rules.filter((r) => r.scope === 'once' && r.consumedAt == null).map((r) => r.id);
}

/** After a coding round, mark the given once-rules as consumed (mutates `rules` in place). */
export function markOnceRulesConsumed(rules: RunRule[], onceIds: readonly string[]): void {
  if (onceIds.length === 0) return;
  const idSet = new Set(onceIds);
  const t = nowIso();
  for (const r of rules) {
    if (idSet.has(r.id) && r.scope === 'once' && r.consumedAt == null) {
      r.consumedAt = t;
      r.updatedAt = t;
    }
  }
}

export function createRunRule(content: string, scope: RunRuleScope): RunRule {
  const t = nowIso();
  return {
    id: newRunRuleId(),
    content,
    scope,
    createdAt: t,
    updatedAt: t,
  };
}

export function removeRunRuleById(rules: RunRule[], ruleId: string): RunRule[] {
  const next = rules.filter((r) => r.id !== ruleId);
  if (next.length === rules.length) {
    throw new Error(`Rule not found: ${ruleId}`);
  }
  return next;
}

export function patchRunRule(
  rules: RunRule[],
  opts: { id: string; content?: string; scope?: RunRuleScope },
): RunRule[] {
  const { id: ruleId, content, scope } = opts;
  const idx = rules.findIndex((r) => r.id === ruleId);
  if (idx < 0) {
    throw new Error(`Rule not found: ${ruleId}`);
  }
  const t = nowIso();
  const cur = rules[idx]!;
  const next: RunRule = {
    ...cur,
    ...(content !== undefined ? { content } : {}),
    ...(scope !== undefined ? { scope } : {}),
    updatedAt: t,
  };
  const copy = rules.slice();
  copy[idx] = next;
  return copy;
}

export function getRunRule(rules: readonly RunRule[], ruleId: string): RunRule | undefined {
  return rules.find((r) => r.id === ruleId);
}

/** Deep copy rules (e.g. fork). */
export function cloneRunRules(rules: readonly RunRule[] | undefined): RunRule[] {
  if (rules == null || rules.length === 0) return [];
  return rules.map((r) => ({ ...r }));
}
