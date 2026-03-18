// ---------------------------------------------------------------------------
// Cleanup registry — tracks live provisioners for graceful shutdown
// ---------------------------------------------------------------------------

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

  /** Optional hook run before teardown (e.g. save run state on Ctrl+C) */
  setBeforeCleanup(hook: () => Promise<void>): void {
    this.beforeCleanupHook = hook;
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
        console.warn('[orchestrator] Before-cleanup hook error:', err);
      }
    }
    const provisionersToDown = [...this.provisioners];
    this.provisioners = [];

    for (const { provisioner, runId } of provisionersToDown) {
      await provisioner.teardown({ runId });
    }
  }
}
