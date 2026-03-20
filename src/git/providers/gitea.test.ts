/**
 * Unit tests for GiteaProvider and getGitProvider factory (gitea case).
 *
 * All tests are pure/side-effect-free: git remote calls use a non-existent
 * repo path to exercise error branches, and fetch is mocked for API tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getGitProvider } from '../index.js';
import { GiteaProvider } from './gitea.js';

const FAKE_ROOT = '/tmp/repo';

function makeProvider() {
  return new GiteaProvider();
}

// ---------------------------------------------------------------------------
// getGitProvider factory — gitea case
// ---------------------------------------------------------------------------

describe('getGitProvider (gitea)', () => {
  it('returns a GiteaProvider for id "gitea"', () => {
    const p = getGitProvider('gitea');
    expect(p).toBeInstanceOf(GiteaProvider);
    expect(p.id).toBe('gitea');
  });

  it('is case-insensitive', () => {
    expect(getGitProvider('Gitea').id).toBe('gitea');
    expect(getGitProvider('GITEA').id).toBe('gitea');
  });
});

// ---------------------------------------------------------------------------
// GiteaProvider.resolvePushUrl
// ---------------------------------------------------------------------------

describe('GiteaProvider.resolvePushUrl', () => {
  beforeEach(() => {
    delete process.env.GITEA_TOKEN;
    delete process.env.GITEA_USERNAME;
    delete process.env.GITEA_URL;
  });

  afterEach(() => {
    delete process.env.GITEA_TOKEN;
    delete process.env.GITEA_USERNAME;
    delete process.env.GITEA_URL;
    vi.restoreAllMocks();
  });

  it('passes through a full HTTPS URL unchanged when no credentials are set', async () => {
    const p = makeProvider();
    const url = 'https://gitea.com/owner/repo.git';
    expect(await p.resolvePushUrl(url, FAKE_ROOT)).toBe(url);
  });

  it('injects GITEA_USERNAME and GITEA_TOKEN into a gitea.com HTTPS URL', async () => {
    process.env.GITEA_TOKEN = 'mytoken';
    process.env.GITEA_USERNAME = 'myuser';
    const p = makeProvider();
    const result = await p.resolvePushUrl('https://gitea.com/owner/repo.git', FAKE_ROOT);
    expect(result).toContain('myuser:mytoken@gitea.com');
  });

  it('injects credentials into a self-hosted Gitea HTTPS URL when GITEA_URL matches', async () => {
    process.env.GITEA_TOKEN = 'mytoken';
    process.env.GITEA_USERNAME = 'myuser';
    process.env.GITEA_URL = 'https://gitea.mycompany.com';
    const p = makeProvider();
    const result = await p.resolvePushUrl('https://gitea.mycompany.com/owner/repo.git', FAKE_ROOT);
    expect(result).toContain('myuser:mytoken@gitea.mycompany.com');
  });

  it('does NOT inject credentials into a non-configured HTTPS host (credential safety)', async () => {
    process.env.GITEA_TOKEN = 'mytoken';
    process.env.GITEA_USERNAME = 'myuser';
    // GITEA_URL defaults to gitea.com — a github.com URL should be left unchanged
    const p = makeProvider();
    const url = 'https://github.com/owner/repo.git';
    expect(await p.resolvePushUrl(url, FAKE_ROOT)).toBe(url);
  });

  it('does not inject credentials when only GITEA_TOKEN is set (username missing)', async () => {
    process.env.GITEA_TOKEN = 'mytoken';
    const p = makeProvider();
    const url = 'https://gitea.com/owner/repo.git';
    expect(await p.resolvePushUrl(url, FAKE_ROOT)).toBe(url);
  });

  it('does not inject credentials when only GITEA_USERNAME is set (token missing)', async () => {
    process.env.GITEA_USERNAME = 'myuser';
    const p = makeProvider();
    const url = 'https://gitea.com/owner/repo.git';
    expect(await p.resolvePushUrl(url, FAKE_ROOT)).toBe(url);
  });

  it('passes through git@ SSH URLs unchanged even when credentials are set', async () => {
    process.env.GITEA_TOKEN = 'mytoken';
    process.env.GITEA_USERNAME = 'myuser';
    const p = makeProvider();
    const url = 'git@gitea.com:owner/repo.git';
    expect(await p.resolvePushUrl(url, FAKE_ROOT)).toBe(url);
  });

  it('expands an owner/repo slug to a full gitea.com URL when GITEA_URL is not set', async () => {
    const p = makeProvider();
    const result = await p.resolvePushUrl('owner/repo', FAKE_ROOT);
    expect(result).toBe('https://gitea.com/owner/repo.git');
  });

  it('expands an owner/repo.git slug (with .git suffix) correctly', async () => {
    const p = makeProvider();
    const result = await p.resolvePushUrl('owner/repo.git', FAKE_ROOT);
    expect(result).toBe('https://gitea.com/owner/repo.git');
  });

  it('expands a slug with a dotted repo name (owner/my.repo)', async () => {
    const p = makeProvider();
    const result = await p.resolvePushUrl('owner/my.repo', FAKE_ROOT);
    expect(result).toBe('https://gitea.com/owner/my.repo.git');
  });

  it('expands an owner/repo slug using GITEA_URL when set', async () => {
    process.env.GITEA_URL = 'https://gitea.mycompany.com';
    const p = makeProvider();
    const result = await p.resolvePushUrl('owner/repo', FAKE_ROOT);
    expect(result).toBe('https://gitea.mycompany.com/owner/repo.git');
  });

  it('strips trailing slash from GITEA_URL before expanding a slug', async () => {
    process.env.GITEA_URL = 'https://gitea.mycompany.com/';
    const p = makeProvider();
    const result = await p.resolvePushUrl('owner/repo', FAKE_ROOT);
    expect(result).toBe('https://gitea.mycompany.com/owner/repo.git');
  });

  it('injects credentials when expanding a slug', async () => {
    process.env.GITEA_TOKEN = 'tok';
    process.env.GITEA_USERNAME = 'usr';
    const p = makeProvider();
    const result = await p.resolvePushUrl('owner/repo', FAKE_ROOT);
    expect(result).toContain('usr:tok@gitea.com');
  });

  it('throws for an unknown remote name when git remote get-url fails', async () => {
    const p = makeProvider();
    await expect(p.resolvePushUrl('nonexistent-remote', '/tmp/not-a-real-git-repo')).rejects.toThrow(/Cannot resolve push target "nonexistent-remote"/);
  });
});

// ---------------------------------------------------------------------------
// GiteaProvider.extractRepoSlug
// ---------------------------------------------------------------------------

describe('GiteaProvider.extractRepoSlug', () => {
  afterEach(() => {
    delete process.env.GITEA_URL;
  });

  it('extracts host|owner/repo from a gitea.com HTTPS URL', async () => {
    const p = makeProvider();
    expect(await p.extractRepoSlug('https://gitea.com/owner/repo.git', FAKE_ROOT)).toBe(
      'https://gitea.com|owner/repo',
    );
  });

  it('extracts host|owner/repo from an HTTPS URL without .git suffix', async () => {
    const p = makeProvider();
    expect(await p.extractRepoSlug('https://gitea.com/owner/repo', FAKE_ROOT)).toBe(
      'https://gitea.com|owner/repo',
    );
  });

  it('extracts host|owner/repo from a self-hosted HTTPS URL', async () => {
    const p = makeProvider();
    expect(await p.extractRepoSlug('https://gitea.mycompany.com/owner/repo.git', FAKE_ROOT)).toBe(
      'https://gitea.mycompany.com|owner/repo',
    );
  });

  it('extracts host|owner/repo from a git@ SSH SCP URL', async () => {
    const p = makeProvider();
    expect(await p.extractRepoSlug('git@gitea.com:owner/repo.git', FAKE_ROOT)).toBe(
      'https://gitea.com|owner/repo',
    );
  });

  it('extracts host|owner/repo from an ssh:// URL with git@ user', async () => {
    const p = makeProvider();
    expect(await p.extractRepoSlug('ssh://git@gitea.com/owner/repo.git', FAKE_ROOT)).toBe(
      'https://gitea.com|owner/repo',
    );
  });

  it('extracts host|owner/repo from an ssh:// URL without explicit user', async () => {
    const p = makeProvider();
    expect(await p.extractRepoSlug('ssh://gitea.com/owner/repo.git', FAKE_ROOT)).toBe(
      'https://gitea.com|owner/repo',
    );
  });

  it('strips embedded userinfo from an HTTPS URL when extracting slug', async () => {
    const p = makeProvider();
    // userinfo should not leak into the host stored in the opaque slug
    expect(await p.extractRepoSlug('https://myuser:mytoken@gitea.com/owner/repo.git', FAKE_ROOT)).toBe(
      'https://gitea.com|owner/repo',
    );
  });

  it('extracts slug correctly for a dotted repo name (owner/my.repo)', async () => {
    const p = makeProvider();
    expect(await p.extractRepoSlug('owner/my.repo', FAKE_ROOT)).toBe('https://gitea.com|owner/my.repo');
  });

  it('extracts slug from an owner/repo.git slug shorthand', async () => {
    const p = makeProvider();
    expect(await p.extractRepoSlug('owner/repo.git', FAKE_ROOT)).toBe('https://gitea.com|owner/repo');
  });

  it('expands an owner/repo slug using gitea.com when GITEA_URL is not set', async () => {
    const p = makeProvider();
    expect(await p.extractRepoSlug('owner/repo', FAKE_ROOT)).toBe('https://gitea.com|owner/repo');
  });

  it('expands an owner/repo slug using GITEA_URL when set', async () => {
    process.env.GITEA_URL = 'https://gitea.mycompany.com';
    const p = makeProvider();
    expect(await p.extractRepoSlug('owner/repo', FAKE_ROOT)).toBe(
      'https://gitea.mycompany.com|owner/repo',
    );
  });

  it('throws for an unresolvable remote name', async () => {
    const p = makeProvider();
    await expect(p.extractRepoSlug('nonexistent-remote', '/tmp/not-a-real-git-repo')).rejects.toThrow(
      /Cannot resolve remote/,
    );
  });

  it('throws when GITEA_URL contains a pipe character', async () => {
    process.env.GITEA_URL = 'https://gitea|bad.com';
    const p = makeProvider();
    await expect(p.extractRepoSlug('owner/repo', FAKE_ROOT)).rejects.toThrow(/GITEA_URL must not contain/);
  });

  it('throws when the URL cannot be parsed as a Gitea URL', async () => {
    const p = makeProvider();
    // An HTTPS URL that cannot be reduced to owner/repo (extra path segment)
    await expect(p.extractRepoSlug('https://gitea.com/group/subgroup/repo.git', FAKE_ROOT)).rejects.toThrow(
      /Cannot extract Gitea owner\/repo/,
    );
  });
});

// ---------------------------------------------------------------------------
// GiteaProvider.createPullRequest
// ---------------------------------------------------------------------------

describe('GiteaProvider.createPullRequest', () => {
  afterEach(() => {
    delete process.env.GITEA_TOKEN;
    vi.restoreAllMocks();
  });

  it('throws when GITEA_TOKEN is not set', async () => {
    delete process.env.GITEA_TOKEN;
    const p = makeProvider();
    await expect(
      p.createPullRequest({
        repoSlug: 'https://gitea.com|owner/repo',
        head: 'feature-branch',
        base: 'main',
        title: 'My PR',
        body: 'body',
      }),
    ).rejects.toThrow(/GITEA_TOKEN is required/);
  });

  it('throws when repoSlug does not contain "|"', async () => {
    process.env.GITEA_TOKEN = 'tok';
    const p = makeProvider();
    await expect(
      p.createPullRequest({
        repoSlug: 'owner/repo',
        head: 'feature',
        base: 'main',
        title: 'T',
        body: 'B',
      }),
    ).rejects.toThrow(/must be "host\|owner\/repo"/);
  });

  it('sends a POST to the Gitea API with correct fields and returns html_url', async () => {
    process.env.GITEA_TOKEN = 'gitea-test-token';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        html_url: 'https://gitea.com/owner/repo/pulls/7',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const p = makeProvider();
    const url = await p.createPullRequest({
      repoSlug: 'https://gitea.com|owner/repo',
      head: 'feature-branch',
      base: 'main',
      title: 'My PR',
      body: 'pr body text',
    });

    expect(url).toBe('https://gitea.com/owner/repo/pulls/7');
    expect(mockFetch).toHaveBeenCalledOnce();
    const [apiUrl, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(apiUrl).toBe('https://gitea.com/api/v1/repos/owner/repo/pulls');
    expect((init.headers as Record<string, string>)['Authorization']).toBe(
      'token gitea-test-token',
    );
    const reqBody = JSON.parse(init.body as string) as Record<string, string>;
    expect(reqBody).toMatchObject({
      title: 'My PR',
      body: 'pr body text',
      head: 'feature-branch',
      base: 'main',
    });
  });

  it('calls the correct API URL for a self-hosted Gitea instance', async () => {
    process.env.GITEA_TOKEN = 'tok';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ html_url: 'https://gitea.mycompany.com/owner/repo/pulls/1' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const p = makeProvider();
    await p.createPullRequest({
      repoSlug: 'https://gitea.mycompany.com|owner/repo',
      head: 'feat',
      base: 'main',
      title: 'T',
      body: 'B',
    });

    const [apiUrl] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(apiUrl).toBe('https://gitea.mycompany.com/api/v1/repos/owner/repo/pulls');
  });

  it('throws on non-ok API response', async () => {
    process.env.GITEA_TOKEN = 'tok';
    vi.stubGlobal('fetch', () =>
      Promise.resolve({
        ok: false,
        status: 422,
        text: async () => 'pull request already exists',
      }),
    );

    const p = makeProvider();
    await expect(
      p.createPullRequest({
        repoSlug: 'https://gitea.com|owner/repo',
        head: 'branch',
        base: 'main',
        title: 'T',
        body: 'B',
      }),
    ).rejects.toThrow(/Gitea PR creation failed \(422\)/);
  });
});
