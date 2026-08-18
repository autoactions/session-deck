import type { GitHubActions, SlotId, WorkflowRun } from "../src/github.ts";

export class FakeGitHub implements GitHubActions {
  runs: Record<SlotId, WorkflowRun | null> = { linux: null, windows: null };
  lastInputs: Record<SlotId, Record<string, string> | null> = { linux: null, windows: null };

  async latestRun(slot: SlotId): Promise<WorkflowRun | null> {
    return this.runs[slot];
  }

  async dispatch(slot: SlotId, inputs?: Record<string, string>): Promise<void> {
    this.lastInputs[slot] = inputs ?? null;
    const id = (this.runs[slot]?.id ?? 0) + 1;
    this.runs[slot] = {
      id,
      status: "queued",
      conclusion: null,
      htmlUrl: `https://github.com/autoactions/debug-session/actions/runs/${id}`,
      startedAt: null,
      openedBy: null,
    };
  }

  async cancel(runId: number): Promise<void> {
    for (const slot of ["linux", "windows"] as const) {
      const run = this.runs[slot];
      if (run?.id === runId) {
        this.runs[slot] = { ...run };
      }
    }
  }
}
