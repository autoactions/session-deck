export type SlotId = "linux" | "windows";

export type WorkflowRun = {
  id: number;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
};

export type DispatchInputs = Record<string, string>;

export type GitHubActions = {
  latestRun(slot: SlotId): Promise<WorkflowRun | null>;
  dispatch(slot: SlotId, inputs?: DispatchInputs): Promise<void>;
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

export const DISPATCH_INPUTS: Record<SlotId, DispatchInputs> = {
  linux: { access_profile: "mini", session_profile: "developer" },
  windows: { session_profile: "developer", enable_wsl: "false" },
};

export function buildDispatchInputs(
  slot: SlotId,
  raw: unknown,
): { ok: true; inputs: DispatchInputs } | { ok: false; error: string } {
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const session = readString(body.session_profile) ?? DISPATCH_INPUTS[slot].session_profile;
  if (session !== "core" && session !== "developer") {
    return { ok: false, error: "invalid session_profile" };
  }

  if (slot === "linux") {
    const access = readString(body.access_profile) ?? DISPATCH_INPUTS.linux.access_profile;
    if (access !== "mini" && access !== "full") {
      return { ok: false, error: "invalid access_profile" };
    }
    return { ok: true, inputs: { access_profile: access, session_profile: session } };
  }

  const wsl = readFlag(body.enable_wsl) ?? DISPATCH_INPUTS.windows.enable_wsl;
  if (wsl !== "true" && wsl !== "false") {
    return { ok: false, error: "invalid enable_wsl" };
  }
  return { ok: true, inputs: { session_profile: session, enable_wsl: wsl } };
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readFlag(value: unknown): string | undefined {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  return undefined;
}

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

    async dispatch(slot, inputs = DISPATCH_INPUTS[slot]) {
      await githubFetch(`/actions/workflows/${WORKFLOW[slot]}/dispatches`, {
        method: "POST",
        body: JSON.stringify({ ref: config.ref, inputs }),
      });
    },

    async cancel(runId) {
      await githubFetch(`/actions/runs/${runId}/cancel`, { method: "POST" });
    },
  };
}
