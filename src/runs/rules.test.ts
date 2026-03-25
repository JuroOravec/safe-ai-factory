import { describe, expect, it } from 'vitest';

import {
  activeOnceRuleIds,
  createRunRule,
  markOnceRulesConsumed,
  patchRunRule,
  removeRunRuleById,
  rulesForPrompt,
} from './rules.js';
import type { RunRule } from './types.js';

function at(iso: string): Pick<RunRule, 'createdAt' | 'updatedAt'> {
  return { createdAt: iso, updatedAt: iso };
}

describe('rulesForPrompt', () => {
  it('orders by createdAt and drops consumed once rules', () => {
    const rules: RunRule[] = [
      {
        id: 'b',
        content: 'second',
        scope: 'always',
        ...at('2025-01-02T00:00:00.000Z'),
      },
      {
        id: 'a',
        content: 'first',
        scope: 'once',
        ...at('2025-01-01T00:00:00.000Z'),
      },
      {
        id: 'c',
        content: 'gone',
        scope: 'once',
        ...at('2025-01-03T00:00:00.000Z'),
        consumedAt: '2025-01-04T00:00:00.000Z',
      },
    ];
    const prompt = rulesForPrompt(rules);
    expect(prompt.map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('markOnceRulesConsumed', () => {
  it('sets consumedAt only for listed once ids', () => {
    const rules: RunRule[] = [
      { id: 'x', content: '1', scope: 'once', ...at('2025-01-01T00:00:00.000Z') },
      { id: 'y', content: '2', scope: 'once', ...at('2025-01-02T00:00:00.000Z') },
      { id: 'z', content: 'p', scope: 'always', ...at('2025-01-03T00:00:00.000Z') },
    ];
    markOnceRulesConsumed(rules, ['x']);
    expect(rules[0]!.consumedAt).toBeDefined();
    expect(rules[1]!.consumedAt).toBeUndefined();
    expect(rules[2]!.consumedAt).toBeUndefined();
  });
});

describe('activeOnceRuleIds', () => {
  it('returns unconsumed once rule ids', () => {
    const rules: RunRule[] = [
      { id: 'a', content: '', scope: 'once', ...at('t'), consumedAt: 't2' },
      { id: 'b', content: '', scope: 'once', ...at('t') },
    ];
    expect(activeOnceRuleIds(rules)).toEqual(['b']);
  });
});

describe('createRunRule', () => {
  it('assigns id and timestamps', () => {
    const r = createRunRule('hello', 'always');
    expect(r.content).toBe('hello');
    expect(r.scope).toBe('always');
    expect(r.id).toMatch(/^[0-9a-f]{6}$/);
    expect(r.createdAt).toBe(r.updatedAt);
  });
});

describe('removeRunRuleById', () => {
  it('throws when missing', () => {
    expect(() => removeRunRuleById([], 'nope')).toThrow(/not found/);
  });
});

describe('patchRunRule', () => {
  it('updates fields', () => {
    const prev: RunRule[] = [
      { id: 'r1', content: 'old', scope: 'once', ...at('2025-01-01T00:00:00.000Z') },
    ];
    const next = patchRunRule(prev, { id: 'r1', content: 'new', scope: 'always' });
    expect(next[0]!.content).toBe('new');
    expect(next[0]!.scope).toBe('always');
    expect(next[0]!.updatedAt >= next[0]!.createdAt).toBe(true);
  });
});
