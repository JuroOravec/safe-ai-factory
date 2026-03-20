/**
 * Unit tests for AzureReposProvider and getGitProvider factory (azure case).
 *
 * All tests are pure/side-effect-free: git remote calls use a non-existent
 * repo path to exercise error branches, and fetch is mocked for API tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getGitProvider } from '../index.js';
import { AzureReposProvider } from './azure.js';

const FAKE_ROOT = '/tmp/repo';

function makeProvider() {
  return new AzureReposProvider();
}

// ---------------------------------------------------------------------------
// getGitProvider factory — azure case
// ---------------------------------------------------------------------------

describe('getGitProvider (azure)', () => {
  it('returns an AzureReposProvider for id "azure"', () => {
    const p = getGitProvider('azure');
    expect(p).toBeInstanceOf(AzureReposProvider);
    expect(p.id).toBe('azure');
  });

  it('is case-insensitive', () => {
    expect(getGitProvider('Azure').id).toBe('azure');
    expect(getGitProvider('AZURE').id).toBe('azure');
  });
});

// ---------------------------------------------------------------------------
// AzureReposProvider.resolvePushUrl
// ---------------------------------------------------------------------------

describe('AzureReposProvider.resolvePushUrl', () => {
  beforeEach(() => {
    delete process.env.AZURE_DEVOPS_TOKEN;
  });

  afterEach(() => {
    delete process.env.AZURE_DEVOPS_TOKEN;
    vi.restoreAllMocks();
  });

  it('passes through a full HTTPS URL unchanged when no token is set', async () => {
    const p = makeProvider();
    const url = 'https://dev.azure.com/myorg/myproject/_git/myrepo';
    expect(await p.resolvePushUrl(url, FAKE_ROOT)).toBe(url);
  });

  it('injects AZURE_DEVOPS_TOKEN into a dev.azure.com HTTPS URL', async () => {
    process.env.AZURE_DEVOPS_TOKEN = 'mytoken';
    const p = makeProvider();
    const result = await p.resolvePushUrl(
      'https://dev.azure.com/myorg/myproject/_git/myrepo',
      FAKE_ROOT,
    );
    expect(result).toContain('pat:mytoken@dev.azure.com');
  });

  it('does not inject token into non-Azure HTTPS URLs', async () => {
    process.env.AZURE_DEVOPS_TOKEN = 'mytoken';
    const p = makeProvider();
    const url = 'https://github.com/owner/repo.git';
    expect(await p.resolvePushUrl(url, FAKE_ROOT)).toBe(url);
  });

  it('passes through git@ SSH URLs unchanged even when token is set', async () => {
    process.env.AZURE_DEVOPS_TOKEN = 'mytoken';
    const p = makeProvider();
    const url = 'git@ssh.dev.azure.com:v3/myorg/myproject/myrepo';
    expect(await p.resolvePushUrl(url, FAKE_ROOT)).toBe(url);
  });

  it('passes through ssh:// URLs unchanged even when token is set', async () => {
    process.env.AZURE_DEVOPS_TOKEN = 'mytoken';
    const p = makeProvider();
    const url = 'ssh://git@ssh.dev.azure.com:22/myorg/myproject/myrepo';
    expect(await p.resolvePushUrl(url, FAKE_ROOT)).toBe(url);
  });

  it('injects AZURE_DEVOPS_TOKEN into a legacy visualstudio.com HTTPS URL', async () => {
    process.env.AZURE_DEVOPS_TOKEN = 'mytoken';
    const p = makeProvider();
    const result = await p.resolvePushUrl(
      'https://myorg.visualstudio.com/myproject/_git/myrepo',
      FAKE_ROOT,
    );
    expect(result).toContain('pat:mytoken@myorg.visualstudio.com');
  });

  it('expands an org/project/repo slug to a full dev.azure.com URL', async () => {
    const p = makeProvider();
    const result = await p.resolvePushUrl('myorg/myproject/myrepo', FAKE_ROOT);
    expect(result).toBe('https://dev.azure.com/myorg/myproject/_git/myrepo');
  });

  it('injects token when expanding a slug', async () => {
    process.env.AZURE_DEVOPS_TOKEN = 'tok';
    const p = makeProvider();
    const result = await p.resolvePushUrl('myorg/myproject/myrepo', FAKE_ROOT);
    expect(result).toContain('pat:tok@dev.azure.com');
    expect(result).toContain('/myorg/myproject/_git/myrepo');
  });

  it('throws for an unknown remote name when git remote get-url fails', async () => {
    const p = makeProvider();
    await expect(
      p.resolvePushUrl('nonexistent-remote', '/tmp/not-a-real-git-repo'),
    ).rejects.toThrow(/Cannot resolve push target "nonexistent-remote"/);
  });
});

// ---------------------------------------------------------------------------
// AzureReposProvider.extractRepoSlug
// ---------------------------------------------------------------------------

describe('AzureReposProvider.extractRepoSlug', () => {
  it('extracts org/project/repo from an HTTPS URL', async () => {
    const p = makeProvider();
    expect(
      await p.extractRepoSlug('https://dev.azure.com/myorg/myproject/_git/myrepo', FAKE_ROOT),
    ).toBe('myorg/myproject/myrepo');
  });

  it('extracts org/project/repo from an HTTPS URL with .git suffix', async () => {
    const p = makeProvider();
    expect(
      await p.extractRepoSlug('https://dev.azure.com/myorg/myproject/_git/myrepo.git', FAKE_ROOT),
    ).toBe('myorg/myproject/myrepo');
  });

  it('extracts org/project/repo from a git@ SSH SCP URL', async () => {
    const p = makeProvider();
    expect(
      await p.extractRepoSlug('git@ssh.dev.azure.com:v3/myorg/myproject/myrepo', FAKE_ROOT),
    ).toBe('myorg/myproject/myrepo');
  });

  it('extracts org/project/repo from a git@ SSH SCP URL with .git suffix', async () => {
    const p = makeProvider();
    expect(
      await p.extractRepoSlug('git@ssh.dev.azure.com:v3/myorg/myproject/myrepo.git', FAKE_ROOT),
    ).toBe('myorg/myproject/myrepo');
  });

  it('extracts org/project/repo from an ssh:// URL with port', async () => {
    const p = makeProvider();
    expect(
      await p.extractRepoSlug('ssh://git@ssh.dev.azure.com:22/myorg/myproject/myrepo', FAKE_ROOT),
    ).toBe('myorg/myproject/myrepo');
  });

  it('extracts org/project/repo from an ssh:// URL without port', async () => {
    const p = makeProvider();
    expect(
      await p.extractRepoSlug('ssh://git@ssh.dev.azure.com/myorg/myproject/myrepo.git', FAKE_ROOT),
    ).toBe('myorg/myproject/myrepo');
  });

  it('returns a slug shorthand as-is', async () => {
    const p = makeProvider();
    expect(await p.extractRepoSlug('myorg/myproject/myrepo', FAKE_ROOT)).toBe(
      'myorg/myproject/myrepo',
    );
  });

  it('extracts org/project/repo from a legacy visualstudio.com HTTPS URL', async () => {
    const p = makeProvider();
    expect(
      await p.extractRepoSlug('https://myorg.visualstudio.com/myproject/_git/myrepo', FAKE_ROOT),
    ).toBe('myorg/myproject/myrepo');
  });

  it('extracts org/project/repo from a legacy visualstudio.com URL with .git suffix', async () => {
    const p = makeProvider();
    expect(
      await p.extractRepoSlug(
        'https://myorg.visualstudio.com/myproject/_git/myrepo.git',
        FAKE_ROOT,
      ),
    ).toBe('myorg/myproject/myrepo');
  });

  it('throws when the URL does not match Azure Repos patterns', async () => {
    const p = makeProvider();
    await expect(p.extractRepoSlug('https://github.com/owner/repo.git', FAKE_ROOT)).rejects.toThrow(
      /Cannot extract Azure org\/project\/repo/,
    );
  });

  it('throws for an unresolvable remote name', async () => {
    const p = makeProvider();
    await expect(
      p.extractRepoSlug('nonexistent-remote', '/tmp/not-a-real-git-repo'),
    ).rejects.toThrow(/Cannot resolve remote/);
  });
});

// ---------------------------------------------------------------------------
// AzureReposProvider.createPullRequest
// ---------------------------------------------------------------------------

describe('AzureReposProvider.createPullRequest', () => {
  afterEach(() => {
    delete process.env.AZURE_DEVOPS_TOKEN;
    vi.restoreAllMocks();
  });

  it('throws when AZURE_DEVOPS_TOKEN is not set', async () => {
    delete process.env.AZURE_DEVOPS_TOKEN;
    const p = makeProvider();
    await expect(
      p.createPullRequest({
        repoSlug: 'myorg/myproject/myrepo',
        head: 'feature-branch',
        base: 'main',
        title: 'My PR',
        body: 'body',
      }),
    ).rejects.toThrow(/AZURE_DEVOPS_TOKEN is required/);
  });

  it('throws when repoSlug does not have exactly three segments', async () => {
    process.env.AZURE_DEVOPS_TOKEN = 'tok';
    const p = makeProvider();
    await expect(
      p.createPullRequest({
        repoSlug: 'myorg/myrepo',
        head: 'feature',
        base: 'main',
        title: 'T',
        body: 'B',
      }),
    ).rejects.toThrow(/must be "org\/project\/repo"/);
  });

  it('sends a POST to the Azure Repos API with correct fields and returns the PR web URL', async () => {
    process.env.AZURE_DEVOPS_TOKEN = 'az-test-token';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        pullRequestId: 42,
        repository: { remoteUrl: 'https://dev.azure.com/myorg/myproject/_git/myrepo' },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const p = makeProvider();
    const url = await p.createPullRequest({
      repoSlug: 'myorg/myproject/myrepo',
      head: 'feature-branch',
      base: 'main',
      title: 'My PR',
      body: 'pr body text',
    });

    expect(url).toBe('https://dev.azure.com/myorg/myproject/_git/myrepo/pullrequests/42');
    expect(mockFetch).toHaveBeenCalledOnce();
    const [apiUrl, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(apiUrl).toBe(
      'https://dev.azure.com/myorg/myproject/_apis/git/repositories/myrepo/pullrequests?api-version=7.1',
    );
    // Auth header is Basic with base64(":token")
    const expectedAuth = `Basic ${Buffer.from(':az-test-token').toString('base64')}`;
    expect((init.headers as Record<string, string>)['Authorization']).toBe(expectedAuth);
    const reqBody = JSON.parse(init.body as string) as Record<string, string>;
    expect(reqBody).toMatchObject({
      title: 'My PR',
      description: 'pr body text',
      sourceRefName: 'refs/heads/feature-branch',
      targetRefName: 'refs/heads/main',
    });
  });

  it('throws on non-ok API response', async () => {
    process.env.AZURE_DEVOPS_TOKEN = 'az-test-token';
    vi.stubGlobal('fetch', () =>
      Promise.resolve({
        ok: false,
        status: 400,
        text: async () => 'TF401179: Source branch does not exist',
      }),
    );

    const p = makeProvider();
    await expect(
      p.createPullRequest({
        repoSlug: 'myorg/myproject/myrepo',
        head: 'nonexistent',
        base: 'main',
        title: 'T',
        body: 'B',
      }),
    ).rejects.toThrow(/Azure Repos PR creation failed \(400\)/);
  });
});
