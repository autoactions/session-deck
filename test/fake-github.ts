import type { GitHubActions, WorkflowRun } from "../src/github.ts";

const REPOS: Record<string, string> = {
  "tsrv/linux": "autoactions/tsrv",
  "tsrv/windows": "autoactions/tsrv",
  chrome: "autoactions/tsvc",
  motrix: "autoactions/tsvc",
  openlist: "autoactions/tsvc",
};

export class FakeGitHub implements GitHubActions {
  runs: Record<string, WorkflowRun | null> = {
    "tsrv/linux": null,
    "tsrv/windows": null,
    chrome: null,
    motrix: null,
    openlist: null,
  };
  lastInputs: Record<string, Record<string, string> | null> = {
    "tsrv/linux": null,
    "tsrv/windows": null,
    chrome: null,
    motrix: null,
    openlist: null,
  };
  outputs: Record<number, string> = {};

  async latestRun(id: string): Promise<WorkflowRun | null> {
    return this.runs[id] ?? null;
  }

  async dispatch(id: string, inputs?: Record<string, string>): Promise<void> {
    this.lastInputs[id] = inputs ?? null;
    const current = this.runs[id];
    const runId = (current?.id ?? 0) + 1;
    this.runs[id] = {
      id: runId,
      status: "queued",
      conclusion: null,
      htmlUrl: `https://github.com/${REPOS[id] ?? "example/repo"}/actions/runs/${runId}`,
      startedAt: null,
      openedBy: null,
    };
  }

  async cancel(_id: string, runId: number): Promise<void> {
    for (const id of Object.keys(this.runs)) {
      const run = this.runs[id];
      if (run?.id === runId) this.runs[id] = { ...run };
    }
  }

  async observerOutput(_id: string, runId: number): Promise<string | null> {
    return this.outputs[runId] ?? null;
  }
}
