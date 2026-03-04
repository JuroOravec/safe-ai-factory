/**
 * Unit tests for GitLabProvider and getGitProvider factory (gitlab case).
 *
 * All tests are pure/side-effect-free: git remote calls use a non-existent
 * repo path to exercise error branches, and fetch is mocked for API tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getGitProvider } from '../index.js';
import { GitLabProvider } from './gitlab.js';

const FAKE_ROOT = '/tmp/repo';

function makeProvider() {
  return new GitLabProvider();
}

// ---------------------------------------------------------------------------
// getGitProvider factory — gitlab case
// ---------------------------------------------------------------------------

describe('getGitProvider (gitlab)', () => {
  it('returns a GitLabProvider for id "gitlab"', () => {
    const p = getGitProvider('gitlab');
    expect(p).toBeInstanceOf(GitLabProvider);
    expect(p.id).toBe('gitlab');
  });

  it('is case-insensitive', () => {
    expect(getGitProvider('GitLab').id).toBe('gitlab');
    expect(getGitProvider('GITLAB').id).toBe('gitlab');
  });
});

// ---------------------------------------------------------------------------
// GitLabProvider.resolvePushUrl
// ---------------------------------------------------------------------------

describe('GitLabProvider.resolvePushUrl', () => {
  beforeEach(() => {
    delete process.env.GITLAB_TOKEN;
    delete process.env.GITLAB_URL;
  });

  afterEach(() => {
    delete process.env.GITLAB_TOKEN;
    delete process.env.GITLAB_URL;
    vi.restoreAllMocks();
  });

  it('passes through a full https URL unchanged when no token is set', () => {
    const p = makeProvider();
    const url = 'https://gitlab.com/group/repo.git';
    expect(p.resolvePushUrl(url, FAKE_ROOT)).toBe(url);
  });

  it('injects GITLAB_TOKEN as oauth2 credentials into a gitlab.com https URL', () => {
    process.env.GITLAB_TOKEN = 'glpat-abc';
    const p = makeProvider();
    const result = p.resolvePushUrl('https://gitlab.com/group/repo.git', FAKE_ROOT);
    expect(result).toContain('oauth2:glpat-abc@gitlab.com');
  });

  it('injects token into a self-hosted GitLab HTTPS URL when GITLAB_URL matches', () => {
    process.env.GITLAB_TOKEN = 'glpat-xyz';
    process.env.GITLAB_URL = 'https://git.mycompany.com';
    const p = makeProvider();
    const result = p.resolvePushUrl('https://git.mycompany.com/group/repo.git', FAKE_ROOT);
    expect(result).toContain('oauth2:glpat-xyz@git.mycompany.com');
  });

  it('does NOT inject token into a self-hosted URL when GITLAB_URL is not set', () => {
    process.env.GITLAB_TOKEN = 'glpat-xyz';
    // GITLAB_URL defaults to gitlab.com — a different host must not receive the token
    const p = makeProvider();
    const url = 'https://git.mycompany.com/group/repo.git';
    expect(p.resolvePushUrl(url, FAKE_ROOT)).toBe(url);
  });

  it('does not inject token into github.com URLs', () => {
    process.env.GITLAB_TOKEN = 'glpat-abc';
    const p = makeProvider();
    const url = 'https://github.com/owner/repo.git';
    expect(p.resolvePushUrl(url, FAKE_ROOT)).toBe(url);
  });

  it('passes through git@ SSH URLs unchanged', () => {
    process.env.GITLAB_TOKEN = 'glpat-abc';
    const p = makeProvider();
    const url = 'git@gitlab.com:group/repo.git';
    expect(p.resolvePushUrl(url, FAKE_ROOT)).toBe(url);
  });

  it('expands a group/project slug to a full gitlab.com URL', () => {
    const p = makeProvider();
    const result = p.resolvePushUrl('group/repo', FAKE_ROOT);
    expect(result).toBe('https://gitlab.com/group/repo.git');
  });

  it('expands a group/project slug using GITLAB_URL when set', () => {
    process.env.GITLAB_URL = 'https://git.mycompany.com';
    const p = makeProvider();
    const result = p.resolvePushUrl('group/repo', FAKE_ROOT);
    expect(result).toBe('https://git.mycompany.com/group/repo.git');
  });

  it('expands a multi-segment path to a full gitlab.com URL', () => {
    const p = makeProvider();
    const result = p.resolvePushUrl('group/subgroup/repo', FAKE_ROOT);
    expect(result).toBe('https://gitlab.com/group/subgroup/repo.git');
  });

  it('strips an existing .git suffix from a slug before expanding', () => {
    const p = makeProvider();
    const result = p.resolvePushUrl('group/repo.git', FAKE_ROOT);
    expect(result).toBe('https://gitlab.com/group/repo.git');
  });

  it('injects token when expanding a slug', () => {
    process.env.GITLAB_TOKEN = 'glpat-tok';
    const p = makeProvider();
    const result = p.resolvePushUrl('group/repo', FAKE_ROOT);
    expect(result).toContain('oauth2:glpat-tok@gitlab.com');
  });

  it('strips trailing slash from GITLAB_URL before expanding a slug', () => {
    process.env.GITLAB_URL = 'https://git.mycompany.com/';
    const p = makeProvider();
    const result = p.resolvePushUrl('group/repo', FAKE_ROOT);
    expect(result).toBe('https://git.mycompany.com/group/repo.git');
  });

  it('throws for an unknown remote name when git remote get-url fails', () => {
    const p = makeProvider();
    expect(() => p.resolvePushUrl('nonexistent-remote', '/tmp/not-a-real-git-repo')).toThrow(
      /Cannot resolve push target "nonexistent-remote"/,
    );
  });
});

// ---------------------------------------------------------------------------
// GitLabProvider.extractRepoSlug
// ---------------------------------------------------------------------------

describe('GitLabProvider.extractRepoSlug', () => {
  it('URL-encodes a group/project path from an HTTPS URL', () => {
    const p = makeProvider();
    expect(p.extractRepoSlug('https://gitlab.com/group/repo.git', FAKE_ROOT)).toBe('group%2Frepo');
    expect(p.extractRepoSlug('https://gitlab.com/group/repo', FAKE_ROOT)).toBe('group%2Frepo');
  });

  it('URL-encodes a multi-segment path from an HTTPS URL', () => {
    const p = makeProvider();
    expect(p.extractRepoSlug('https://gitlab.com/group/subgroup/repo.git', FAKE_ROOT)).toBe(
      'group%2Fsubgroup%2Frepo',
    );
  });

  it('URL-encodes a path from a git@ SSH URL', () => {
    const p = makeProvider();
    expect(p.extractRepoSlug('git@gitlab.com:group/repo.git', FAKE_ROOT)).toBe('group%2Frepo');
  });

  it('URL-encodes a multi-segment path from a git@ SSH URL', () => {
    const p = makeProvider();
    expect(p.extractRepoSlug('git@gitlab.com:group/subgroup/repo.git', FAKE_ROOT)).toBe(
      'group%2Fsubgroup%2Frepo',
    );
  });

  it('URL-encodes a slug shorthand', () => {
    const p = makeProvider();
    expect(p.extractRepoSlug('group/repo', FAKE_ROOT)).toBe('group%2Frepo');
  });

  it('URL-encodes a multi-segment slug shorthand', () => {
    const p = makeProvider();
    expect(p.extractRepoSlug('group/subgroup/repo', FAKE_ROOT)).toBe('group%2Fsubgroup%2Frepo');
  });

  it('throws for an unresolvable remote name', () => {
    const p = makeProvider();
    expect(() => p.extractRepoSlug('nonexistent-remote', '/tmp/not-a-real-git-repo')).toThrow(
      /Cannot resolve remote/,
    );
  });
});

// ---------------------------------------------------------------------------
// GitLabProvider.createPullRequest
// ---------------------------------------------------------------------------

describe('GitLabProvider.createPullRequest', () => {
  afterEach(() => {
    delete process.env.GITLAB_TOKEN;
    delete process.env.GITLAB_URL;
    vi.restoreAllMocks();
  });

  it('throws when GITLAB_TOKEN is not set', async () => {
    delete process.env.GITLAB_TOKEN;
    const p = makeProvider();
    await expect(
      p.createPullRequest({
        repoSlug: 'group%2Frepo',
        head: 'feature-branch',
        base: 'main',
        title: 'My MR',
        body: 'body',
      }),
    ).rejects.toThrow(/GITLAB_TOKEN is required/);
  });

  it('sends a POST to the GitLab MR API with correct fields and returns web_url', async () => {
    process.env.GITLAB_TOKEN = 'glpat-test';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        web_url: 'https://gitlab.com/group/repo/-/merge_requests/7',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const p = makeProvider();
    const url = await p.createPullRequest({
      repoSlug: 'group%2Frepo',
      head: 'feature-branch',
      base: 'main',
      title: 'My MR',
      body: 'body text',
    });

    expect(url).toBe('https://gitlab.com/group/repo/-/merge_requests/7');
    expect(mockFetch).toHaveBeenCalledOnce();
    const [apiUrl, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(apiUrl).toBe('https://gitlab.com/api/v4/projects/group%2Frepo/merge_requests');
    expect((init.headers as Record<string, string>)['PRIVATE-TOKEN']).toBe('glpat-test');
    const body = JSON.parse(init.body as string) as Record<string, string>;
    expect(body).toMatchObject({
      source_branch: 'feature-branch',
      target_branch: 'main',
      title: 'My MR',
      description: 'body text',
    });
  });

  it('uses GITLAB_URL as the API host for self-hosted instances', async () => {
    process.env.GITLAB_TOKEN = 'glpat-test';
    process.env.GITLAB_URL = 'https://git.mycompany.com';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ web_url: 'https://git.mycompany.com/group/repo/-/merge_requests/3' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const p = makeProvider();
    await p.createPullRequest({
      repoSlug: 'group%2Frepo',
      head: 'feat',
      base: 'main',
      title: 'T',
      body: 'B',
    });

    const [apiUrl] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(apiUrl).toBe('https://git.mycompany.com/api/v4/projects/group%2Frepo/merge_requests');
  });

  it('throws on non-ok API response', async () => {
    process.env.GITLAB_TOKEN = 'glpat-test';
    vi.stubGlobal('fetch', () =>
      Promise.resolve({
        ok: false,
        status: 409,
        text: async () => 'Another open merge request already exists',
      }),
    );

    const p = makeProvider();
    await expect(
      p.createPullRequest({
        repoSlug: 'group%2Frepo',
        head: 'branch',
        base: 'main',
        title: 'T',
        body: 'B',
      }),
    ).rejects.toThrow(/GitLab MR creation failed \(409\)/);
  });
});
