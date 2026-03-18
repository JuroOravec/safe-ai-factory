/**
 * Iterative agent loop and related utilities.
 * Used by mode 'start' (and 'resume' via runStartCore).
 */

import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { isCancel, text } from '@clack/prompts';

import type {
  NormalizedCodingEnvironment,
  NormalizedStagingEnvironment,
} from '../config/schema.js';
import { getSaifRoot } from '../constants.js';
import { runDesignTests } from '../design-tests/design.js';
import { TestCatalogSchema } from '../design-tests/schema.js';
import { generateTests } from '../design-tests/write.js';
import { generatePRSummary } from '../git/agents/pr-summarizer.js';
import type { GitProvider } from '../git/types.js';
import { type ModelOverrides, resolveAgentLlmConfig } from '../llm-config.js';
import { createProvisioner } from '../provisioners/index.js';
import {
  type AssertionSuiteResult,
  type RunTestsOpts,
  type TestsResult,
} from '../provisioners/types.js';
import { buildRunArtifact, type RunStorage } from '../runs/index.js';
import type { SupportedSandboxProfileId } from '../sandbox-profiles/types.js';
import type { Feature } from '../specs/discover.js';
import type { TestProfile } from '../test-profiles/types.js';
import type { CleanupRegistry } from '../utils/cleanup.js';
import { runVagueSpecsChecker } from './agents/vague-specs-check.js';
import {
  destroySandbox,
  extractPatch,
  type PatchExcludeRule,
  type SandboxPaths,
} from './sandbox.js';
import { getArgusBinaryPath } from './sidecars/reviewer/argus.js';

// ---------------------------------------------------------------------------
// Shared: Iterative Loop (used by 'start' and 'continue')
// ---------------------------------------------------------------------------

/**
 * Options used by runIterativeLoop (modes 'start' and 'resume').
 */
export interface IterativeLoopOpts {
  /** Sandbox profile id (e.g. 'node-pnpm-python'). Used to resolve Dockerfile.stage for the staging container when tests.json does not specify build.dockerfile. */
  sandboxProfileId: SupportedSandboxProfileId;
  /** Resolved feature (name, absolutePath, relativePath). */
  feature: Feature;
  /** Absolute path to the project directory */
  projectDir: string;
  /** Max full pipeline runs before giving up. Default: 5 */
  maxRuns: number;
  /**
   * CLI-level LLM overrides (--model, --base-url).
   *
   * The orchestrator uses this to resolve the coder agent's model config via
   * `resolveAgentLlmConfig('coder', 'coder', overrides)` and to pass overrides
   * through to Mastra agents (vague-specs-check, pr-summarizer, tests pipeline).
   *
   * When omitted, all agents fall back to env-var tier overrides then auto-discovery.
   */
  overrides: ModelOverrides;
  /**
   * Saifac directory name relative to repo root (e.g. 'saifac').
   * Resolved by caller (e.g. agents CLI parseSaifDir).
   */
  saifDir: string;
  /**
   * Project name prefix for sandbox directory names (e.g. 'crawlee-one').
   * Resolved by caller (e.g. agents CLI parseProjectName from -p/--project or package.json).
   */
  projectName: string;
  /**
   * Test Docker image tag (default: 'factory-test-<profileId>:latest').
   *
   * Override via --test-image CLI flag.
   */
  testImage: string;
  /**
   * Decides action when tests fail due to ambiguous specs:
   * - `'off'`    — No action, failing tests are NOT analysed for ambiguity.
   * - `'prompt'` — Runs ambiguity analysis. If ambiguous, pause and ask the human to confirm/edit the clarification before regenerating tests and continuing.
   * - `'ai'`     — Runs ambiguity analysis. If ambiguous, automatically append AI agent's proposed clarification to specification.md and regenerate runner.spec.ts without human input.
   */
  resolveAmbiguity: 'off' | 'prompt' | 'ai';
  /**
   * When true, skip Leash and run OpenHands directly on the host.
   * Isolation is filesystem-only (rsync sandbox). No Cedar enforcement.
   * Default: false (Leash is enabled by default).
   */
  dangerousDebug: boolean;
  /**
   * Absolute path to a Cedar policy file for Leash.
   *
   * Defaults to leash-policy.cedar in src/orchestrator/.
   * Ignored when dangerousDebug=true.
   */
  cedarPolicyPath: string;
  /**
   * Docker image for the coder container.
   * Resolved from the sandbox profile (default: node-pnpm-python). Override via --coder-image.
   * Ignored when dangerousDebug=true.
   */
  coderImage: string;
  /**
   * Remote target to push the feature branch to after all tests pass.
   * Accepts a Git URL (https://github.com/owner/repo.git), a GitHub slug (owner/repo),
   * or a configured remote name (e.g. 'origin').
   * When omitted, the branch is created locally but not pushed.
   * A GITHUB_TOKEN env var is required when pushing via HTTPS to github.com.
   */
  push: string | null;
  /**
   * When true, open a Pull Request after pushing the feature branch.
   * Requires `push` to be set and the appropriate provider token env var.
   */
  pr: boolean;
  /**
   * Git hosting provider to use for push URL resolution and PR creation.
   *
   * The required auth token is read from the corresponding env var (e.g. GITHUB_TOKEN).
   */
  gitProvider: GitProvider;
  /**
   * Maximum number of gate retries (agent → gate → feedback) per run.
   * Forwarded as FACTORY_GATE_RETRIES to coder-start.sh.
   *
   * Resolved by the CLI: defaults to 10 when --gate-retries is not set.
   */
  gateRetries: number;
  /**
   * Extra environment variables to forward into the agent container (Leash mode)
   * or inject into the host process env (--dangerous-debug mode).
   *
   * Parsed from --agent-env KEY=VALUE flags and --agent-env-file <path> by the CLI.
   * Reserved factory variables (FACTORY_*, LLM_*, REVIEWER_LLM_*) are silently filtered out
   * by the runner to prevent accidental override.
   */
  agentEnv: Record<string, string>;
  /**
   * Controls how agent stdout is parsed and displayed.
   *
   * - `'openhands'` (default) — parse OpenHands --json event stream; pretty-print
   *   action events, thought blocks, and errors.
   * - `'raw'` — stream lines as-is with an `[agent]` prefix; suitable for any
   *   agent CLI that does not emit OpenHands-style JSON events.
   */
  agentLogFormat: 'openhands' | 'raw';
  /**
   * Content of the test script to write into the sandbox and bind-mount at
   * /usr/local/bin/test.sh inside the Test Runner container (read-only).
   *
   * Always set — defaults to DEFAULT_TEST_SCRIPT (test-default.sh) when --test-script is not
   * provided. Override via --test-script CLI flag (accepts a file path; content is read by CLI).
   */
  testScript: string;
  /**
   * Test profile to use for the test runner.
   *
   * Resolved by the CLI: defaults to DEFAULT_TEST_PROFILE (vitest) when --test-profile is not set.
   */
  testProfile: TestProfile;
  /**
   * How many times to re-run the full test suite on failed tests. Useful for flaky test environments.
   * Applies to modes 'fail2pass', 'start', 'resume', and 'test'.
   * Default: 1 (run once; no retries).
   */
  testRetries: number;
  /**
   * Additional file sections to strip from the extracted patch before it is
   * applied to the host repo. The saifDir/ glob is always prepended
   * automatically — passing rules here adds to that, not replaces it.
   */
  patchExclude?: PatchExcludeRule[];
  /**
   * When true, run the semantic AI reviewer (Argus) after static checks pass.
   * Requires the Argus binary. Disable with --no-reviewer.
   * Default: true.
   */
  reviewerEnabled: boolean;
  /**
   * Normalized staging environment — always present (defaults to `{ provisioner: 'docker' }` when
   * `environments.staging` is absent in config). Contains `app` (with DEFAULT_STAGING_APP
   * defaults) and `appEnvironment` (defaults to `{}`). Used to configure the staging container
   * and to instantiate the provisioner.
   */
  stagingEnvironment: NormalizedStagingEnvironment;
  /**
   * Normalized coding environment — always present (defaults to `{ provisioner: 'docker' }` when
   * `environments.coding` is absent in config).
   *
   * When a docker-compose `file` is provided, the orchestrator starts the declared Compose stack
   * before each agent run and attaches the Leash container to the same Docker network so the agen
   * can reach services (e.g. databases, mock APIs) by their service-name hostnames.
   * The stack is torn down cleanly after each agent run regardless of outcome.
   */
  codingEnvironment: NormalizedCodingEnvironment;
}

export interface OrchestratorResult {
  success: boolean;
  attempts: number;
  /** Run ID for resuming (run state saved to .saifac/runs/) */
  runId?: string;
  /** Path to the winning patch.diff if success=true */
  patchPath?: string;
  message: string;
}

export interface RunStorageContext {
  /** Part to re-create the base state of the feature branch - last commit SHA */
  baseCommitSha: string;
  /** Part to re-create the base state of the feature branch - unstaged + staged diff */
  basePatchDiff?: string;
  /** Mutable: set by loop for save-on-Ctrl+C */
  lastErrorFeedback?: string;
}

export async function runIterativeLoop(
  sandbox: SandboxPaths,
  opts: IterativeLoopOpts & { registry: CleanupRegistry },
): Promise<OrchestratorResult> {
  const {
    sandboxProfileId,
    feature,
    projectDir,
    maxRuns,
    overrides,
    saifDir,
    projectName,
    registry,
    testImage,
    resolveAmbiguity,
    dangerousDebug,
    cedarPolicyPath,
    coderImage,
    push,
    pr,
    gitProvider,
    gateRetries,
    agentEnv,
    agentLogFormat,
    testScript,
    testProfile,
    testRetries,
    reviewerEnabled,
    codingEnvironment,
  } = opts;

  // Resolve the coder agent's LLM config once per loop.
  // The resolved config is injected into the Leash container as LLM_* env vars.
  const coderLlmConfig = resolveAgentLlmConfig('coder', overrides);
  const reviewer =
    reviewerEnabled && !dangerousDebug
      ? {
          llmConfig: resolveAgentLlmConfig('reviewer', overrides),
          scriptPath: join(getSaifRoot(), 'src', 'orchestrator', 'scripts', 'reviewer.sh'),
          argusBinaryPath: getArgusBinaryPath(),
        }
      : null;
  // Always exclude saifac/ and .git/hooks/ regardless of any additional caller-supplied rules.
  // saifac/: reward-hacking prevention (agent must not modify its own test specs).
  // .git/hooks/: prevents a malicious patch from installing hooks that execute on the host
  //   when the orchestrator runs `git commit` in applyPatchToHost.
  const saifExclude: PatchExcludeRule = { type: 'glob', pattern: `${saifDir}/**` };
  const gitHooksExclude: PatchExcludeRule = { type: 'glob', pattern: '.git/hooks/**' };
  const patchExclude: PatchExcludeRule[] = [
    saifExclude,
    gitHooksExclude,
    ...(opts.patchExclude ?? []),
  ];

  const testRunnerOpts = getTestRunnerOpts({
    feature,
    sandboxBasePath: sandbox.sandboxBasePath,
    testScript,
  });

  const task = buildInitialTask({ feature, saifDir });

  const cleanupAndSaveRun = async (input: { didSucceed: boolean }) => {
    const { didSucceed } = input;

    if (runStorage && !didSucceed && runContext && lastRunPatchDiff.trim()) {
      try {
        const { registry: _reg, runStorage: _rs, runContext: _rc, ...loopOpts } = opts;
        const artifact = buildRunArtifact({
          runId,
          baseCommitSha: runContext.baseCommitSha,
          basePatchDiff: runContext.basePatchDiff,
          runPatchDiff: lastRunPatchDiff,
          specRef: feature.relativePath,
          lastFeedback: lastErrorFeedback || undefined,
          status: didSucceed ? 'completed' : 'failed',
          opts: loopOpts,
        });
        await runStorage.saveRun(runId, artifact);
        console.log(`[orchestrator] Run state saved. Resume with: saifac run resume ${runId}`);
      } catch (err) {
        console.warn('[orchestrator] Failed to save run state:', err);
      }
    }
    if (!sandboxDestroyed) {
      destroySandbox(sandbox.sandboxBasePath);
    }
  };

  // Wrapper for the main loop so we can derive didSucceed from returned value and cleanup on error.
  const withCleanup = async (fn: () => Promise<OrchestratorResult>) => {
    let didSucceed = false;
    try {
      const result = await fn();
      didSucceed = result.success;
      return result;
    } finally {
      await cleanupAndSaveRun({ didSucceed });
    }
  };

  let errorFeedback = opts.initialErrorFeedback ?? '';
  let attempts = 0;
  let sandboxDestroyed = false;

  return await withCleanup(async () => {
    while (attempts < maxRuns) {
      attempts++;
      console.log(`\n[orchestrator] ===== ATTEMPT ${attempts}/${maxRuns} =====`);

      // 1. Run agent (fresh context every iteration — Ralph Wiggum)
      //    The coding provisioner sets up its network + compose services, runs the agent,
      //    then tears itself down, regardless of outcome.
      const codingRunId = `${sandbox.runId}-coding-${attempts}`;
      const codingProvisioner = createProvisioner(codingEnvironment);
      registry?.registerProvisioner(codingProvisioner, codingRunId);

      try {
        await codingProvisioner.setup({
          runId: codingRunId,
          projectName,
          featureName: feature.name,
          projectDir,
        });

        await codingProvisioner.runAgent({
          codePath: sandbox.codePath,
          sandboxBasePath: sandbox.sandboxBasePath,
          task,
          errorFeedback,
          llmConfig: coderLlmConfig,
          saifDir,
          feature,
          dangerousDebug,
          cedarPolicyPath,
          coderImage,
          gateRetries,
          startupPath: sandbox.startupPath,
          agentStartPath: sandbox.agentStartPath,
          agentPath: sandbox.agentPath,
          agentEnv,
          agentLogFormat,
          reviewer,
        });
      } finally {
        registry?.deregisterProvisioner(codingProvisioner);
        await codingProvisioner.teardown({ runId: codingRunId });
      }

      // 2. Extract the patch, stripping any excluded paths (reward-hacking prevention)
      const { patch: patchContent, patchPath }: { patch: string; patchPath: string } = extractPatch(
        sandbox.codePath,
        { exclude: patchExclude },
      );

      if (!patchContent.trim()) {
        console.warn('[orchestrator] OpenHands produced no changes (empty patch). Skipping tests.');
        errorFeedback =
          'No changes were made. Please implement the feature as described in the plan.';
        continue;
      }

      console.log(`[orchestrator] Extracted patch (${patchContent.length} bytes)`);

      // Re-apply the patch for tests (extractPatch resets to base state).
      // patchPath is outside codePath so git clean cannot have deleted it.
      execSync(`git apply "${patchPath}"`, { cwd: sandbox.codePath });

      // 3. Mutual Verification (with test retries for flaky environments)
      let testAttempts = 0;
      let lastRunId = '';
      let lastVagueSpecsCheckResult:
        | Awaited<ReturnType<typeof runVagueSpecsCheckerForFailure>>
        | undefined;

      while (testAttempts < testRetries) {
        testAttempts++;
        lastRunId = `${sandbox.runId}-${attempts}-${testAttempts}`;
        console.log(
          `\n[orchestrator] Test attempt ${testAttempts}/${testRetries} (outer attempt ${attempts}/${maxRuns})`,
        );

        const stagingProvisioner = createProvisioner(opts.stagingEnvironment);
        registry?.registerProvisioner(stagingProvisioner, lastRunId);
        await stagingProvisioner.setup({
          runId: lastRunId,
          projectName,
          featureName: feature.name,
          projectDir,
        });

        const result: TestsResult = await (async (): Promise<TestsResult> => {
          try {
            const stagingHandle = await stagingProvisioner.startStaging({
              sandboxProfileId,
              codePath: sandbox.codePath,
              projectDir,
              stagingEnvironment: opts.stagingEnvironment,
              feature,
              projectName,
              startupPath: sandbox.startupPath,
              stagePath: sandbox.stagePath,
            });

            return await stagingProvisioner.runTests({
              ...testRunnerOpts,
              stagingHandle,
              testImage,
              runId: lastRunId,
              feature,
              projectName,
              reportPath: join(sandbox.sandboxBasePath, 'results.xml'),
            });
          } finally {
            registry?.deregisterProvisioner(stagingProvisioner);
            await stagingProvisioner.teardown({ runId: lastRunId });
          }
        })();
        if (result.runnerError) {
          throw new Error(
            `Test runner error on attempt ${attempts}: ${result.runnerError}\n` +
              `Check that runner.spec.ts and tests.json are present and valid.\n` +
              `Stderr:\n${result.stderr}`,
          );
        }

        if (result.passed) {
          // 4. Success path
          console.log('\n[orchestrator] ✓ ALL TESTS PASSED — applying patch to host');
          await applyPatchToHost({
            codePath: sandbox.codePath,
            projectDir,
            feature,
            runId: lastRunId,
            push,
            pr,
            gitProvider,
            overrides,
          });
          destroySandbox(sandbox.sandboxBasePath);
          sandboxDestroyed = true;

          return {
            success: true,
            attempts,
            message: `Feature implemented successfully in ${attempts} attempt(s).`,
          };
        }

        // 5. Failure path - Check for spec ambiguity.
        //    If spec is ambiguous, the agent CANNOT faithfully completed the task
        //    to match the hidden tests.
        //    We use AI agent to determine if the spec is ambiguous:
        //    - yes, we ask the human (or AI) for clarification and update specs and tests.
        //    - no, we treat errors as genuine code errors and continue the loop.
        if (resolveAmbiguity !== 'off' && result.testSuites) {
          const VagueSpecsCheckResult = await runVagueSpecsCheckerForFailure({
            projectName,
            projectDir,
            feature,
            testSuites: result.testSuites,
            resolveAmbiguity,
            testProfile,
            overrides,
          });

          if (VagueSpecsCheckResult.ambiguityResolved) {
            // Spec was updated and tests regenerated — retry tests with updated suite.
            // Don't count this attempt against testRetries since the spec was at fault.
            console.log(
              '[orchestrator] Spec ambiguity resolved — retrying tests with updated tests.',
            );
            testAttempts--;
          } else {
            lastVagueSpecsCheckResult = VagueSpecsCheckResult;
          }
        }
      }

      // Exhausted test retries — treat as genunine failure and send feedback to the agent.
      // NOTE: Never mention tests - That's why we return the "sanitizedHint" - it's
      //       AI summarisation of the error(s) that avoids talking about the specifics
      //       of what was assessed.
      //       The error message is framed as something "external" that's out of reach for the agent
      //       (e.g. "An external service attempted to use this project and failed"),
      //       so the agent doesn't think it can fix the failure by changing tests.
      const base = 'An external service attempted to use this project and failed. ';
      const hint =
        lastVagueSpecsCheckResult?.sanitizedHint ??
        'Re-read the plan and specification, and fix the implementation.';
      errorFeedback = base + hint;

      console.log(
        `\n[orchestrator] Attempt ${attempts} FAILED (tests failed after ${testAttempts} run(s)).`,
      );

      // Reset sandbox to base state for next coder agent run
      execSync('git reset --hard HEAD', { cwd: sandbox.codePath });
      execSync('git clean -fd', { cwd: sandbox.codePath });
    }

    // Max attempts reached
    console.error(`\n[orchestrator] Max runs (${maxRuns}) reached without success.`);

    return {
      success: false,
      attempts,
      runId,
      message: `Failed after ${maxRuns} runs. Last error:\n${errorFeedback}`,
    };
  });
}

// ---------------------------------------------------------------------------
// Vague Specs Checker: check for ambiguity vs genuine failure on tests failures
// ---------------------------------------------------------------------------

interface RunVagueSpecsCheckerForFailureOpts {
  projectName: string;
  /** Absolute path to the project directory */
  projectDir: string;
  feature: Feature;
  testProfile: TestProfile;
  testSuites: AssertionSuiteResult[];
  /**
   * Decides action when tests fail due to ambiguous specs:
   * - `ai`: auto-append clarification to specs, regenerate tests, continue.
   * - `prompt`: pause and ask human to confirm/edit proposed clarification before updating.
   */
  resolveAmbiguity: 'prompt' | 'ai';
  /** CLI-level model overrides — forwarded to vague-specs-check and tests pipeline. */
  overrides: ModelOverrides;
}

interface VagueSpecsCheckerForFailureResult {
  /** True when the spec was genuinely ambiguous AND the ambiguity was resolved */
  ambiguityResolved: boolean;
  /** Sanitized behavioral hint for the agent (empty if ambiguityResolved=true) */
  sanitizedHint: string;
}

/**
 * Resolve how to continue after a failing test suite. Test failures may
 * be actually caused by ambiguous specs.
 *
 * In `ai` mode: if the spec is ambiguous, appends the proposed clarification
 * to specification.md and regenerates runner.spec.ts without human input.
 *
 * In `prompt` mode: shows the proposed clarification to the human and asks for
 * confirmation before updating the spec. If the human declines, treats the
 * failure as genuine.
 *
 * Returns `ambiguityResolved: true` when the spec was updated so the caller can
 * reset the attempt counter.
 */
export async function runVagueSpecsCheckerForFailure(
  opts: RunVagueSpecsCheckerForFailureOpts,
): Promise<VagueSpecsCheckerForFailureResult> {
  const { projectDir, feature, testSuites, resolveAmbiguity, testProfile, projectName, overrides } =
    opts;

  const specPath = join(feature.absolutePath, 'specification.md');
  const specContent = existsSync(specPath)
    ? readFileSync(specPath, 'utf8')
    : '(specification.md not found)';

  console.log('[vague-specs-check] Running ambiguity check...');

  // Stream vague-specs-check thinking in real-time (similar to [think]/[agent] style from OpenHands)
  let thinkBuf = '';
  const onVagueSpecsCheckThought = (delta: string) => {
    thinkBuf += delta;
    const lines = thinkBuf.split('\n');
    thinkBuf = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) process.stdout.write(`[vague-specs-check:think] ${trimmed.slice(0, 200)}\n`);
    }
  };
  const onVagueSpecsCheckEvent = (chunk: { type: string; payload: unknown }) => {
    if (chunk.type === 'tool-call') {
      const p = chunk.payload as { toolName?: string };
      process.stdout.write(`[vague-specs-check] tool: ${p.toolName ?? '?'}\n`);
    }
  };

  const verdict = await runVagueSpecsChecker({
    specContent,
    failingSuites: testSuites,
    overrides,
    onThought: onVagueSpecsCheckThought,
    onEvent: onVagueSpecsCheckEvent,
  });
  // Flush any remaining partial thought line
  if (thinkBuf.trim()) {
    process.stdout.write(`[vague-specs-check:think] ${thinkBuf.trim().slice(0, 200)}\n`);
  }

  console.log(`[vague-specs-check] isAmbiguous=${verdict.isAmbiguous}`);
  console.log(`[vague-specs-check] Reason: ${verdict.reason}`);

  if (!verdict.isAmbiguous) {
    return {
      ambiguityResolved: false,
      sanitizedHint: verdict.sanitizedHintForAgent,
    };
  }

  // --- Ambiguous spec detected ---
  console.log(`[vague-specs-check] Proposed spec addition:\n  "${verdict.proposedSpecAddition}"`);

  if (resolveAmbiguity === 'prompt') {
    console.log(`\n[vague-specs-check] Ambiguity detected. Reason: ${verdict.reason}`);
    console.log(
      `[vague-specs-check] Vague Specs Checker suggests: "${verdict.proposedSpecAddition}"`,
    );

    const answer = await text({
      message: 'What is the correct behavior? (describe it; we will add it to specification.md)',
      placeholder: verdict.proposedSpecAddition,
    });

    if (isCancel(answer) || !answer?.trim()) {
      console.log('[vague-specs-check] Human skipped — treating failure as genuine.');
      return {
        ambiguityResolved: false,
        sanitizedHint: verdict.sanitizedHintForAgent,
      };
    }

    // Override the proposed spec addition with what the human actually said
    verdict.proposedSpecAddition = answer.trim();
  }

  // Append clarification to specification.md
  if (existsSync(specPath)) {
    const addition = `\n\n<!-- Vague Specs Checker clarification (auto-added) -->\n${verdict.proposedSpecAddition}\n`;
    appendFileSync(specPath, addition, 'utf8');
    console.log(`[vague-specs-check] Appended clarification to ${specPath}`);
  } else {
    console.warn('[vague-specs-check] specification.md not found — cannot update spec.');
    return {
      ambiguityResolved: false,
      sanitizedHint: verdict.sanitizedHintForAgent,
    };
  }

  // Regenerate tests from the updated spec (design pipeline writes tests.json,
  // then scaffold generates the spec files via the coder agent).
  console.log('[vague-specs-check] Regenerating tests with updated spec...');
  try {
    await runDesignTests({
      feature,
      projectDir,
      testProfile,
      projectName,
      overrides,
    });
    await generateTests({ feature, testProfile, overrides });
    console.log('[vague-specs-check] Tests regenerated successfully.');
  } catch (err) {
    console.warn(`[vague-specs-check] Test regeneration failed (non-fatal): ${String(err)}`);
    return {
      ambiguityResolved: false,
      sanitizedHint: verdict.sanitizedHintForAgent,
    };
  }

  return { ambiguityResolved: true, sanitizedHint: '' };
}

// ---------------------------------------------------------------------------
// Success path: apply patch via git worktree → commit → push → PR
// ---------------------------------------------------------------------------

interface ApplyPatchOpts {
  /** Absolute path to the sandbox code directory (sandboxBasePath/code) */
  codePath: string;
  /** Absolute path to the project directory */
  projectDir: string;
  feature: Feature;
  /**
   * Unique run id used to construct the branch name (factory/<featureName>-<runId>),
   * ensuring parallel runs for different attempts never collide.
   */
  runId: string;
  /** Remote push target (URL, owner/repo slug, or named remote). Optional. */
  push: string | null;
  /** When true, open a Pull Request after pushing. Requires push + provider token env var. */
  pr: boolean;
  /** Git hosting provider. Default: GitHubProvider. */
  gitProvider: GitProvider;
  /** CLI-level model overrides forwarded to the PR summarizer agent. */
  overrides: ModelOverrides;
}

/**
 * Applies the winning patch to the host repository using a git worktree so that
 * the main working tree's checked-out branch is never modified — safe for parallel runs.
 *
 * Flow:
 *   1. Create a temporary worktree at <sandboxBasePath>/worktree on branch factory/<featureName>-<runId>
 *   2. Apply patch.diff and commit inside the worktree
 *   3. Optionally push the branch to the remote target
 *   4. Optionally open a Pull Request via the configured git provider
 *   5. Remove the worktree (branch remains in the main repo's git history)
 *
 * The worktree lives inside sandboxBasePath so it is cleaned up by destroySandbox after
 * this function returns. The worktree must be deregistered (step 6) before the directory
 * is deleted, otherwise git's internal worktree registry gets stale entries.
 */
export async function applyPatchToHost(opts: ApplyPatchOpts): Promise<void> {
  const { codePath, projectDir, feature, runId, push, pr, gitProvider, overrides } = opts;

  // patch.diff is written to sandboxBasePath (parent of codePath) by extractPatch,
  // deliberately outside the git working tree so `git clean -fd` cannot delete it.
  const sandboxBasePath = join(codePath, '..');
  const patchFile = join(sandboxBasePath, 'patch.diff');

  if (!existsSync(patchFile)) {
    console.warn('[orchestrator] No patch.diff found in sandbox; skipping host apply');
    return;
  }

  // Reject patches that touch .git/hooks/ — a hook injected here would run on the
  // host machine the next time any git operation triggers it.
  const patchContent = readFileSync(patchFile, 'utf8');
  if (/^diff --git.*\.git\/hooks\//m.test(patchContent)) {
    throw new Error(
      '[orchestrator] Patch rejected: contains changes to .git/hooks/. ' +
        'This is a security violation — the agent attempted to install a git hook on the host.',
    );
  }

  const branchName = `factory/${feature.name}-${runId}`;
  const wtPath = join(sandboxBasePath, 'worktree');

  const gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME ?? 'factory',
    GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL ?? 'factory@localhost',
    GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME ?? 'factory',
    GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL ?? 'factory@localhost',
  };

  // Capture the current branch for the PR base *before* touching anything
  let baseBranch = 'main';
  try {
    const current = execSync('git branch --show-current', { cwd: projectDir }).toString().trim();
    baseBranch = current || 'main';
  } catch {
    // fall back to 'main'
  }

  console.log(`[orchestrator] Creating worktree at ${wtPath} on branch ${branchName}...`);

  // 1. Create worktree + branch — main worktree HEAD is never touched
  execSync(`git worktree add "${wtPath}" -b "${branchName}"`, { cwd: projectDir, env: gitEnv });

  try {
    // 2. Apply patch inside the worktree
    execSync(`git apply "${patchFile}"`, { cwd: wtPath, env: gitEnv });
    execSync('git add .', { cwd: wtPath, env: gitEnv });
    execSync(`git commit -m "feat(${feature.name}): auto-generated implementation"`, {
      cwd: wtPath,
      env: gitEnv,
    });
    console.log(`[orchestrator] Committed patch on branch ${branchName}`);

    // 4. Push
    if (push) {
      const pushUrl = gitProvider.resolvePushUrl(push, projectDir);
      console.log(`[orchestrator] Pushing ${branchName} to remote...`);
      execSync(`git push "${pushUrl}" "${branchName}"`, { cwd: wtPath, env: gitEnv });
      console.log(`[orchestrator] Branch ${branchName} pushed.`);

      // 5. Create PR
      if (pr) {
        const repoSlug = gitProvider.extractRepoSlug(push, projectDir);

        // 5a. Generate AI title + body; fall back to generic strings on any error.
        let prTitle = `feat(${feature.name}): auto-generated implementation`;
        let prBody = `Automated implementation produced by the [SAIFAC](https://github.com/JuroOravec/safe-ai-factory) for feature \`${feature.name}\`.\n\nRun ID: \`${runId}\``;
        try {
          console.log(`[orchestrator] Generating AI PR summary for ${feature.name}...`);
          const summary = await generatePRSummary({
            feature,
            patchFile,
            overrides,
          });
          prTitle = summary.title;
          prBody = summary.body + `\n\n---\n_Run ID: \`${runId}\`_`;
          console.log(`[orchestrator] AI PR title: ${prTitle}`);
        } catch (err) {
          console.warn(
            `[orchestrator] PR summarizer failed (using generic title/body): ${String(err)}`,
          );
        }

        console.log(`[orchestrator] Creating Pull Request on ${repoSlug}...`);
        const prUrl = await gitProvider.createPullRequest({
          repoSlug,
          head: branchName,
          base: baseBranch,
          title: prTitle,
          body: prBody,
        });
        console.log(`[orchestrator] Pull Request created: ${prUrl}`);
      }
    } else {
      console.log(
        `[orchestrator] Branch "${branchName}" is ready locally. ` +
          `Use --push <target> to push it upstream.`,
      );
    }
  } finally {
    // 6. Deregister the worktree from git's registry before destroySandbox deletes the dir
    try {
      execSync(`git worktree remove --force "${wtPath}"`, { cwd: projectDir });
    } catch (err) {
      // If the directory is already gone somehow, prune stale entries
      try {
        execSync('git worktree prune', { cwd: projectDir });
      } catch {
        // best-effort
      }
      console.warn(`[orchestrator] git worktree remove warning: ${String(err)}`);
    }
  }
}

interface BuildInitialTaskOpts {
  feature: Feature;
  saifDir: string;
}

function buildInitialTask(opts: BuildInitialTaskOpts): string {
  const { feature, saifDir } = opts;
  const planPath = join(feature.absolutePath, 'plan.md');
  const specPath = join(feature.absolutePath, 'specification.md');

  const parts = [
    `Implement the feature '${feature.name}' as described in the plan below.`,
    `Write code in the /workspace directory. Do NOT modify files in the /${saifDir}/ directory.`,
    'When complete, ensure the code compiles and passes linting.',
  ];

  if (existsSync(planPath)) {
    parts.push('', '## Plan', '', readFileSync(planPath, 'utf8'));
  }

  if (existsSync(specPath)) {
    parts.push('', '## Specification', '', readFileSync(specPath, 'utf8'));
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Utilities (used by loop and by modes)
// ---------------------------------------------------------------------------

interface LoadCatalogOpts {
  feature: Feature;
}

export function loadCatalog(opts: LoadCatalogOpts) {
  const { feature } = opts;
  const testsJsonPath = join(feature.absolutePath, 'tests', 'tests.json');
  if (!existsSync(testsJsonPath)) {
    throw new Error(
      `tests.json not found at ${testsJsonPath}. Run 'saifac feat design -n ${feature.name}' first.`,
    );
  }
  const raw = JSON.parse(readFileSync(testsJsonPath, 'utf8')) as unknown;
  const result = TestCatalogSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `tests.json schema validation failed:\n${JSON.stringify(result.error.issues, null, 2)}`,
    );
  }
  return result.data;
}

interface GetTestRunnerOptsArgs {
  feature: Feature;
  /** Sandbox root — the test runner writes results.xml here (via /test-runner-output bind-mount). */
  sandboxBasePath: string;
  /**
   * Content of the test script (default or custom). Always written to
   * `{sandboxBasePath}/test.sh` and bind-mounted at /usr/local/bin/test.sh
   * inside the Test Runner container (read-only).
   */
  testScript: string;
}

/**
 * Prepares the test runner filesystem inputs for a feature run.
 *
 * Returns `testsDir` (the tests/ directory for the feature), `reportDir` (sandbox root,
 * so that `runTests` can find results.xml at `{sandboxRoot}/results.xml`), and
 * `testScriptPath` (always set — written from DEFAULT_TEST_SCRIPT or a custom override).
 *
 * Spec files are expected to already exist — generated by `saifac feat design`.
 */
export function getTestRunnerOpts({
  feature,
  sandboxBasePath,
  testScript,
}: GetTestRunnerOptsArgs): Pick<RunTestsOpts, 'testsDir' | 'reportDir' | 'testScriptPath'> {
  const testsDir = join(feature.absolutePath, 'tests');

  const testScriptPath = join(sandboxBasePath, 'test.sh');
  writeFileSync(testScriptPath, testScript, { encoding: 'utf8', mode: 0o755 });
  console.log(`[orchestrator] test.sh written to ${testScriptPath}`);

  return { testsDir, reportDir: sandboxBasePath, testScriptPath };
}
