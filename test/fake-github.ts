import type { GitHubActions, SlotId, WorkflowRun } from "../src/github.ts";

export class FakeGitHub implements GitHubActions {
  runs: Record<SlotId, WorkflowRun | null> = { linux: null, windows: null };

  async latestRun(slot: SlotId): Promise<WorkflowRun | null> {
    return this.runs[slot];
  }

  async dispatch(slot: SlotId): Promise<void> {
    const id = (this.runs[slot]?.id ?? 0) + 1;
    this.runs[slot] = {
      id,
      status: "queued",
      conclusion: null,
      htmlUrl: `https://github.com/autoactions/debug-session/actions/runs/${id}`,
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
