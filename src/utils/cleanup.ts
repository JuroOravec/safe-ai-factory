// ---------------------------------------------------------------------------
// Cleanup registry — tracks live provisioners for graceful shutdown
// ---------------------------------------------------------------------------

import { consola } from '../logger.js';
import { destroySandbox } from '../orchestrator/sandbox.js';

/** Minimal provisioner interface used by CleanupRegistry (avoids circular deps). */
export interface ProvisionerRef {
  teardown(opts: { runId: string }): Promise<void>;
}

/**
 * Tracks all provisioners created during a run so that
 * SIGINT/SIGTERM handlers can tear them down even if the mode function is
 * mid-await when the signal fires.
 *
 * Mode functions call `register` immediately after each resource is created.
 * The signal handler calls `cleanup()` which tears down everything in reverse order.
 */
export class CleanupRegistry {
  private provisioners: Array<{ provisioner: ProvisionerRef; runId: string }> = [];
  private beforeCleanupHook?: () => Promise<void>;
  /**
   * Sandbox dir to remove on SIGINT/SIGTERM. The iterative loop normally destroys the sandbox in
   * its own `finally`, but the signal handler calls `process.exit` before that runs — without this,
   * Disposable sandbox dirs under the sandbox base (e.g. `/tmp/saifac/sandboxes/...`) accumulate after every interrupted run.
   */
  private emergencySandboxPath?: string;

  /** Optional hook run before teardown (e.g. save run state on Ctrl+C) */
  setBeforeCleanup(hook: () => Promise<void>): void {
    this.beforeCleanupHook = hook;
  }

  /** Register a sandbox directory to delete when the registry runs signal cleanup. */
  setEmergencySandboxPath(path: string): void {
    this.emergencySandboxPath = path;
  }

  /** Call when the sandbox was already removed (success/abort paths) so signal cleanup is a no-op. */
  clearEmergencySandboxPath(): void {
    this.emergencySandboxPath = undefined;
  }

  /** Register a provisioner so it is torn down on SIGINT/SIGTERM. */
  registerProvisioner(provisioner: ProvisionerRef, runId: string): void {
    this.provisioners.push({ provisioner, runId });
  }

  /** Deregister a provisioner after it has been explicitly torn down. */
  deregisterProvisioner(provisioner: ProvisionerRef): void {
    this.provisioners = this.provisioners.filter((p) => p.provisioner !== provisioner);
  }

  async cleanup(): Promise<void> {
    if (this.beforeCleanupHook) {
      try {
        await this.beforeCleanupHook();
      } catch (err) {
        consola.warn('[orchestrator] Before-cleanup hook error:', err);
      }
    }
    const provisionersToDown = [...this.provisioners];
    this.provisioners = [];

    for (const { provisioner, runId } of provisionersToDown) {
      await provisioner.teardown({ runId });
    }

    if (this.emergencySandboxPath) {
      const path = this.emergencySandboxPath;
      this.emergencySandboxPath = undefined;
      try {
        await destroySandbox(path);
      } catch (err) {
        consola.warn('[orchestrator] Emergency sandbox cleanup error:', err);
      }
    }
  }
}
