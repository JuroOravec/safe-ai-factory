/**
 * Unit tests for BitbucketProvider and getGitProvider factory (bitbucket case).
 *
 * All tests are pure/side-effect-free: git remote calls use a non-existent
 * repo path to exercise error branches, and fetch is mocked for API tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getGitProvider } from '../index.js';
import { BitbucketProvider } from './bitbucket.js';

const FAKE_ROOT = '/tmp/repo';

function makeProvider() {
  return new BitbucketProvider();
}

// ---------------------------------------------------------------------------
// getGitProvider factory — bitbucket case
// ---------------------------------------------------------------------------

describe('getGitProvider (bitbucket)', () => {
  it('returns a BitbucketProvider for id "bitbucket"', () => {
    const p = getGitProvider('bitbucket');
    expect(p).toBeInstanceOf(BitbucketProvider);
    expect(p.id).toBe('bitbucket');
  });

  it('is case-insensitive', () => {
    expect(getGitProvider('Bitbucket').id).toBe('bitbucket');
    expect(getGitProvider('BITBUCKET').id).toBe('bitbucket');
  });
});

// ---------------------------------------------------------------------------
// BitbucketProvider.resolvePushUrl
// ---------------------------------------------------------------------------

describe('BitbucketProvider.resolvePushUrl', () => {
  beforeEach(() => {
    delete process.env.BITBUCKET_TOKEN;
    delete process.env.BITBUCKET_USERNAME;
  });

  afterEach(() => {
    delete process.env.BITBUCKET_TOKEN;
    delete process.env.BITBUCKET_USERNAME;
    vi.restoreAllMocks();
  });

  it('passes through a full HTTPS URL unchanged when no credentials are set', () => {
    const p = makeProvider();
    const url = 'https://bitbucket.org/workspace/repo.git';
    expect(p.resolvePushUrl(url, FAKE_ROOT)).toBe(url);
  });

  it('injects BITBUCKET_USERNAME and BITBUCKET_TOKEN into a bitbucket.org HTTPS URL', () => {
    process.env.BITBUCKET_TOKEN = 'mytoken';
    process.env.BITBUCKET_USERNAME = 'myuser';
    const p = makeProvider();
    const result = p.resolvePushUrl('https://bitbucket.org/workspace/repo.git', FAKE_ROOT);
    expect(result).toContain('myuser:mytoken@bitbucket.org');
  });

  it('does not inject credentials when only BITBUCKET_TOKEN is set (username missing)', () => {
    process.env.BITBUCKET_TOKEN = 'mytoken';
    const p = makeProvider();
    const url = 'https://bitbucket.org/workspace/repo.git';
    expect(p.resolvePushUrl(url, FAKE_ROOT)).toBe(url);
  });

  it('does not inject credentials when only BITBUCKET_USERNAME is set (token missing)', () => {
    process.env.BITBUCKET_USERNAME = 'myuser';
    const p = makeProvider();
    const url = 'https://bitbucket.org/workspace/repo.git';
    expect(p.resolvePushUrl(url, FAKE_ROOT)).toBe(url);
  });

  it('passes through git@ SSH URLs unchanged even when credentials are set', () => {
    process.env.BITBUCKET_TOKEN = 'mytoken';
    process.env.BITBUCKET_USERNAME = 'myuser';
    const p = makeProvider();
    const url = 'git@bitbucket.org:workspace/repo.git';
    expect(p.resolvePushUrl(url, FAKE_ROOT)).toBe(url);
  });

  it('does not inject credentials into non-bitbucket.org HTTPS URLs', () => {
    process.env.BITBUCKET_TOKEN = 'mytoken';
    process.env.BITBUCKET_USERNAME = 'myuser';
    const p = makeProvider();
    const url = 'https://github.com/owner/repo.git';
    expect(p.resolvePushUrl(url, FAKE_ROOT)).toBe(url);
  });

  it('expands a workspace/repo slug to a full bitbucket.org URL', () => {
    const p = makeProvider();
    const result = p.resolvePushUrl('workspace/repo', FAKE_ROOT);
    expect(result).toBe('https://bitbucket.org/workspace/repo.git');
  });

  it('strips an existing .git suffix from a slug before expanding', () => {
    const p = makeProvider();
    const result = p.resolvePushUrl('workspace/repo.git', FAKE_ROOT);
    expect(result).toBe('https://bitbucket.org/workspace/repo.git');
  });

  it('injects credentials when expanding a slug', () => {
    process.env.BITBUCKET_TOKEN = 'tok';
    process.env.BITBUCKET_USERNAME = 'usr';
    const p = makeProvider();
    const result = p.resolvePushUrl('workspace/repo', FAKE_ROOT);
    expect(result).toContain('usr:tok@bitbucket.org');
  });

  it('throws for an unknown remote name when git remote get-url fails', () => {
    const p = makeProvider();
    expect(() => p.resolvePushUrl('nonexistent-remote', '/tmp/not-a-real-git-repo')).toThrow(
      /Cannot resolve push target "nonexistent-remote"/,
    );
  });
});

// ---------------------------------------------------------------------------
// BitbucketProvider.extractRepoSlug
// ---------------------------------------------------------------------------

describe('BitbucketProvider.extractRepoSlug', () => {
  it('extracts workspace/repo from an HTTPS URL with .git suffix', () => {
    const p = makeProvider();
    expect(p.extractRepoSlug('https://bitbucket.org/workspace/repo.git', FAKE_ROOT)).toBe(
      'workspace/repo',
    );
  });

  it('extracts workspace/repo from an HTTPS URL without .git suffix', () => {
    const p = makeProvider();
    expect(p.extractRepoSlug('https://bitbucket.org/workspace/repo', FAKE_ROOT)).toBe(
      'workspace/repo',
    );
  });

  it('extracts workspace/repo from a git@ SSH URL', () => {
    const p = makeProvider();
    expect(p.extractRepoSlug('git@bitbucket.org:workspace/repo.git', FAKE_ROOT)).toBe(
      'workspace/repo',
    );
  });

  it('extracts workspace/repo from a git@ SSH URL without .git suffix', () => {
    const p = makeProvider();
    expect(p.extractRepoSlug('git@bitbucket.org:workspace/repo', FAKE_ROOT)).toBe('workspace/repo');
  });

  it('returns a slug shorthand as-is', () => {
    const p = makeProvider();
    expect(p.extractRepoSlug('workspace/repo', FAKE_ROOT)).toBe('workspace/repo');
  });

  it('strips .git from a slug shorthand', () => {
    const p = makeProvider();
    expect(p.extractRepoSlug('workspace/repo.git', FAKE_ROOT)).toBe('workspace/repo');
  });

  it('extracts workspace/repo from an ssh:// URL', () => {
    const p = makeProvider();
    expect(p.extractRepoSlug('ssh://git@bitbucket.org/workspace/repo.git', FAKE_ROOT)).toBe(
      'workspace/repo',
    );
  });

  it('extracts workspace/repo from an ssh:// URL without .git suffix', () => {
    const p = makeProvider();
    expect(p.extractRepoSlug('ssh://git@bitbucket.org/workspace/repo', FAKE_ROOT)).toBe(
      'workspace/repo',
    );
  });

  it('throws when the URL does not match bitbucket.org patterns', () => {
    const p = makeProvider();
    expect(() => p.extractRepoSlug('https://github.com/owner/repo.git', FAKE_ROOT)).toThrow(
      /Cannot extract Bitbucket workspace\/repo/,
    );
  });

  it('throws for an unresolvable remote name', () => {
    const p = makeProvider();
    expect(() => p.extractRepoSlug('nonexistent-remote', '/tmp/not-a-real-git-repo')).toThrow(
      /Cannot resolve remote/,
    );
  });
});

// ---------------------------------------------------------------------------
// BitbucketProvider.createPullRequest
// ---------------------------------------------------------------------------

describe('BitbucketProvider.createPullRequest', () => {
  afterEach(() => {
    delete process.env.BITBUCKET_TOKEN;
    vi.restoreAllMocks();
  });

  it('throws when BITBUCKET_TOKEN is not set', async () => {
    delete process.env.BITBUCKET_TOKEN;
    const p = makeProvider();
    await expect(
      p.createPullRequest({
        repoSlug: 'workspace/repo',
        head: 'feature-branch',
        base: 'main',
        title: 'My PR',
        body: 'body',
      }),
    ).rejects.toThrow(/BITBUCKET_TOKEN is required/);
  });

  it('sends a POST to the Bitbucket PR API with correct fields and returns links.html.href', async () => {
    process.env.BITBUCKET_TOKEN = 'bb-test-token';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        links: { html: { href: 'https://bitbucket.org/workspace/repo/pull-requests/42' } },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const p = makeProvider();
    const url = await p.createPullRequest({
      repoSlug: 'workspace/repo',
      head: 'feature-branch',
      base: 'main',
      title: 'My PR',
      body: 'pr body text',
    });

    expect(url).toBe('https://bitbucket.org/workspace/repo/pull-requests/42');
    expect(mockFetch).toHaveBeenCalledOnce();
    const [apiUrl, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(apiUrl).toBe('https://api.bitbucket.org/2.0/repositories/workspace/repo/pullrequests');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer bb-test-token');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      title: 'My PR',
      description: 'pr body text',
      source: { branch: { name: 'feature-branch' } },
      destination: { branch: { name: 'main' } },
    });
  });

  it('throws on non-ok API response', async () => {
    process.env.BITBUCKET_TOKEN = 'bb-test-token';
    vi.stubGlobal('fetch', () =>
      Promise.resolve({
        ok: false,
        status: 400,
        text: async () => 'Source branch does not exist',
      }),
    );

    const p = makeProvider();
    await expect(
      p.createPullRequest({
        repoSlug: 'workspace/repo',
        head: 'nonexistent',
        base: 'main',
        title: 'T',
        body: 'B',
      }),
    ).rejects.toThrow(/Bitbucket PR creation failed \(400\)/);
  });
});
