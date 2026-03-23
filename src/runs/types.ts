/**
 * Run storage types for persisting agent run artifacts.
 *
 * Used when a run fails (or is aborted) so it can be resumed later via `saifac run resume <runId>`.
 */

import type { SerializedLoopOpts } from './utils/serialize.js';

export type RunStatus = 'failed' | 'completed';

export interface RunArtifact {
  runId: string;
  taskId?: string;

  /** Git commit SHA when the run started */
  baseCommitSha: string;
  /** Uncommitted changes at run start (git diff + git diff --cached) */
  basePatchDiff?: string;
  /** Agent work (from extractPatch) */
  runPatchDiff: string;

  /** Feature path, e.g. saifac/features/feat-stripe-webhooks */
  specRef: string;
  /** Sanitized test failure summary for Ralph Wiggum feedback */
  lastFeedback?: string;

  /** Serialized CLI config used for this run */
  config: SerializedLoopOpts;

  status: RunStatus;
  startedAt: string;
  updatedAt: string;
}

/** Domain interface for run storage. Implemented by RunsStorage. */
export interface RunStorage {
  /** The URI used to create this storage instance (e.g. "local", "s3://bucket/prefix"). */
  readonly uri: string;
  saveRun(runId: string, artifact: RunArtifact): Promise<void>;
  getRun(runId: string): Promise<RunArtifact | null>;
  listRuns(filter?: { taskId?: string; status?: RunStatus }): Promise<RunArtifact[]>;
  deleteRun(runId: string): Promise<void>;
  clearRuns(filter?: { taskId?: string; status?: RunStatus }): Promise<void>;
}
