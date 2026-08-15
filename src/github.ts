export type SlotId = "linux" | "windows";

export type WorkflowRun = {
  id: number;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
};

export type GitHubActions = {
  latestRun(slot: SlotId): Promise<WorkflowRun | null>;
  dispatch(slot: SlotId): Promise<void>;
  cancel(runId: number): Promise<void>;
};

export const SLOTS: SlotId[] = ["linux", "windows"];

export function isSlotId(value: string): value is SlotId {
  return value === "linux" || value === "windows";
}

const WORKFLOW: Record<SlotId, string> = {
  linux: "linux.yml",
  windows: "windows.yml",
};

const DISPATCH_INPUTS: Record<SlotId, Record<string, string>> = {
  linux: { access_profile: "mini", session_profile: "developer" },
  windows: { session_profile: "developer", enable_wsl: "false" },
};

export type GitHubActionsConfig = {
  token: string;
  repo: string;
  ref: string;
  fetch?: typeof fetch;
};

export function createGitHubActions(config: GitHubActionsConfig): GitHubActions {
  const fetchImpl = config.fetch ?? fetch;
  const base = `https://api.github.com/repos/${config.repo}`;

  async function githubFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${config.token}`);
    headers.set("Accept", "application/vnd.github+json");
    headers.set("User-Agent", "debug-session-control");
    if (init.body) headers.set("Content-Type", "application/json");
    const response = await fetchImpl(`${base}${path}`, { ...init, headers });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`GitHub ${init.method ?? "GET"} ${path} failed: ${response.status} ${detail}`);
    }
    return response;
  }

  return {
    async latestRun(slot) {
      const response = await githubFetch(
        `/actions/workflows/${WORKFLOW[slot]}/runs?per_page=1`,
      );
      const body = (await response.json()) as {
        workflow_runs: Array<{
          id: number;
          status: string;
          conclusion: string | null;
          html_url: string;
        }>;
      };
      const run = body.workflow_runs?.[0];
      if (!run) return null;
      return {
        id: run.id,
        status: run.status,
        conclusion: run.conclusion,
        htmlUrl: run.html_url,
      };
    },

    async dispatch(slot) {
      await githubFetch(`/actions/workflows/${WORKFLOW[slot]}/dispatches`, {
        method: "POST",
        body: JSON.stringify({ ref: config.ref, inputs: DISPATCH_INPUTS[slot] }),
      });
    },

    async cancel(runId) {
      await githubFetch(`/actions/runs/${runId}/cancel`, { method: "POST" });
    },
  };
}
