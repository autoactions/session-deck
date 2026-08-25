import type { DispatchInputs } from "./catalog.ts";
import { hasLocatorBlock } from "./locators.ts";

export type { DispatchInputs };

export type WorkflowRun = {
  id: number;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  startedAt: string | null;
  openedBy: string | null;
};

export type GitHubTargetSpec = {
  workflow: string;
  displayTitle?: string;
  defaultInputs?: DispatchInputs;
};

export type GitHubActions = {
  latestRun(id: string): Promise<WorkflowRun | null>;
  dispatch(id: string, inputs?: DispatchInputs): Promise<void>;
  cancel(id: string, runId: number): Promise<void>;
  jobOutput?(id: string, runId: number): Promise<string | null>;
};

export type GitHubRepoClient = GitHubActions & { has(id: string): boolean };

export type WorkflowListing = {
  path: string;
  name: string;
  state: string;
};

export type GitHubRepoAccess = {
  repo: string;
  listWorkflows(): Promise<WorkflowListing[]>;
  readFile(path: string): Promise<string | null>;
};

type RawRun = {
  id: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  display_title?: string;
  run_started_at?: string | null;
  actor?: { login?: string } | null;
};

export type GitHubActionsConfig = {
  token: string;
  repo: string;
  ref: string;
  fetch?: typeof fetch;
  targets?: Record<string, GitHubTargetSpec>;
};

export function createGitHubRepoAccess(config: GitHubActionsConfig): GitHubRepoAccess {
  const { authed, githubFetch } = githubHttp(config);
  return {
    repo: config.repo,
    async listWorkflows() {
      const response = await githubFetch("/actions/workflows?per_page=100");
      const body = (await response.json()) as { workflows?: Array<{ path?: string; name?: string; state?: string }> };
      return (body.workflows ?? [])
        .filter((workflow) => typeof workflow.path === "string" && workflow.path.includes(".github/workflows/"))
        .map((workflow) => ({
          path: workflow.path!,
          name: typeof workflow.name === "string" ? workflow.name : workflow.path!,
          state: typeof workflow.state === "string" ? workflow.state : "active",
        }));
    },
    async readFile(path) {
      const encoded = path
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");
      const response = await authed(`${baseUrl(config)}/contents/${encoded}?ref=${encodeURIComponent(config.ref)}`);
      if (response.status === 404) return null;
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GitHub GET /contents/${path} failed: ${response.status} ${detail}`);
      }
      const body = (await response.json()) as { encoding?: string; content?: string };
      if (body.encoding !== "base64" || typeof body.content !== "string") return null;
      return atob(body.content.replace(/\n/g, ""));
    },
  };
}

export function createGitHubActions(config: GitHubActionsConfig): GitHubRepoClient {
  const { authed, githubFetch } = githubHttp(config);
  const base = baseUrl(config);
  const targets = config.targets ?? {};

  function spec(id: string): GitHubTargetSpec {
    const target = targets[id];
    if (!target) throw new Error(`unknown target ${id}`);
    return target;
  }

  return {
    has(id) {
      return Object.hasOwn(targets, id);
    },

    async latestRun(id) {
      const target = spec(id);
      const perPage = target.displayTitle ? 30 : 1;
      const response = await githubFetch(`/actions/workflows/${target.workflow}/runs?per_page=${perPage}`);
      const body = (await response.json()) as { workflow_runs?: RawRun[] };
      const runs = body.workflow_runs ?? [];
      const run = target.displayTitle
        ? runs.find((candidate) => titlesMatch(candidate.display_title, target.displayTitle))
        : runs[0];
      if (!run) return null;
      return toWorkflowRun(run);
    },

    async dispatch(id, inputs) {
      const target = spec(id);
      await githubFetch(`/actions/workflows/${target.workflow}/dispatches`, {
        method: "POST",
        body: JSON.stringify({ ref: config.ref, inputs: inputs ?? target.defaultInputs ?? {} }),
      });
    },

    async cancel(_id, runId) {
      await githubFetch(`/actions/runs/${runId}/cancel`, { method: "POST" });
    },

    async jobOutput(_id, runId) {
      const response = await githubFetch(`/actions/runs/${runId}/jobs`);
      const body = (await response.json()) as {
        jobs?: Array<{ id: number; check_run_url?: string }>;
      };
      const chunks: string[] = [];
      for (const job of body.jobs ?? []) {
        if (job.check_run_url) {
          const check = await authed(job.check_run_url);
          if (check.ok) {
            const json = (await check.json()) as { output?: { summary?: string | null; text?: string | null } };
            chunks.push(json.output?.summary ?? "", json.output?.text ?? "");
          }
        }
        if (hasLocatorBlock(chunks.join("\n"))) return chunks.join("\n");
        const logs = await authed(`${base}/actions/jobs/${job.id}/logs`, {
          headers: { Accept: "*/*" },
        });
        if (logs.ok) chunks.push(await logs.text());
      }
      const text = chunks.join("\n").trim();
      return text || null;
    },
  };
}

export function combineGitHub(clients: GitHubRepoClient[]): GitHubActions {
  function client(id: string): GitHubRepoClient | undefined {
    return clients.find((entry) => entry.has(id));
  }

  return {
    async latestRun(id) {
      return (await client(id)?.latestRun(id)) ?? null;
    },
    async dispatch(id, inputs) {
      const found = client(id);
      if (!found) throw new Error(`unknown target ${id}`);
      await found.dispatch(id, inputs);
    },
    async cancel(id, runId) {
      const found = client(id);
      if (!found) throw new Error(`unknown target ${id}`);
      await found.cancel(id, runId);
    },
    async jobOutput(id, runId) {
      return (await client(id)?.jobOutput?.(id, runId)) ?? null;
    },
  };
}

function toWorkflowRun(run: RawRun): WorkflowRun {
  return {
    id: run.id,
    status: run.status,
    conclusion: run.conclusion,
    htmlUrl: run.html_url,
    startedAt: typeof run.run_started_at === "string" ? run.run_started_at : null,
    openedBy: typeof run.actor?.login === "string" ? run.actor.login : null,
  };
}

function titlesMatch(displayTitle: string | undefined, expected: string | undefined): boolean {
  if (!displayTitle || !expected) return false;
  return displayTitle === expected || displayTitle.startsWith(`${expected} `);
}

function baseUrl(config: GitHubActionsConfig): string {
  return `https://api.github.com/repos/${config.repo}`;
}

function githubHttp(config: GitHubActionsConfig) {
  const fetchImpl = config.fetch ?? fetch;
  const base = baseUrl(config);

  async function authed(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${config.token}`);
    if (!headers.has("Accept")) headers.set("Accept", "application/vnd.github+json");
    headers.set("User-Agent", "session-deck");
    if (init.body) headers.set("Content-Type", "application/json");
    return fetchImpl(url, { ...init, headers });
  }

  async function githubFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const response = await authed(`${base}${path}`, init);
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`GitHub ${init.method ?? "GET"} ${path} failed: ${response.status} ${detail}`);
    }
    return response;
  }

  return { authed, githubFetch };
}
