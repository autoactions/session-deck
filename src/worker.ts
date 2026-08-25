import type { Target } from "./catalog.ts";
import { buildDispatchInputs, targetById } from "./catalog.ts";
import type { GitHubActions } from "./github.ts";
import type { TargetIntents } from "./intents.ts";
import { memoryTargetIntents } from "./intents.ts";
import { MARK_SVG, renderPage } from "./page.ts";
import { isActive, listTargets, readyStatus, viewTarget } from "./targets.ts";
import type { TailscaleNet } from "./tailscale.ts";
import { unknownTailscale } from "./tailscale.ts";

export type WorkerDeps = {
  adminToken: string;
  github: GitHubActions;
  catalog?: Target[];
  repos?: string[];
  intents?: TargetIntents;
  tailscale?: TailscaleNet;
};

export function createWorker(deps: WorkerDeps): typeof fetch {
  const catalog = deps.catalog ?? [];
  const repos = deps.repos ?? [...new Set(catalog.map((target) => target.repo))];
  const intents = deps.intents ?? memoryTargetIntents();
  const tailscale = deps.tailscale ?? unknownTailscale();
  return async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    try {
      return await route(request, { ...deps, catalog, repos, tailscale }, intents);
    } catch (error) {
      const message = error instanceof Error ? error.message : "upstream error";
      return json({ error: message }, 502);
    }
  };
}

async function route(
  request: Request,
  deps: WorkerDeps & { catalog: Target[]; repos: string[]; tailscale: TailscaleNet },
  intents: TargetIntents,
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/") {
    return new Response(renderPage(deps.repos), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  if (request.method === "GET" && url.pathname === "/assets/mark.svg") {
    return new Response(MARK_SVG, {
      headers: { "content-type": "image/svg+xml; charset=utf-8" },
    });
  }

  if (url.pathname.startsWith("/api/")) {
    if (!deps.adminToken || !hasAdminToken(request, deps.adminToken)) {
      return json({ error: "unauthorized" }, 401);
    }
  }

  if (request.method === "GET" && url.pathname === "/api/targets") {
    return json({ targets: await listTargets(deps.catalog, deps.github, intents, deps.tailscale) });
  }

  const targetMatch = matchTargetPath(url.pathname);
  if (targetMatch) {
    const found = targetById(deps.catalog, targetMatch.id);
    const action = targetMatch.action;
    if (!found) {
      return json({ error: "not found" }, 404);
    }
    const target = found;

    async function shown() {
      const run = await deps.github.latestRun(target.id);
      return viewTarget(target, run, intents, await readyStatus(target, run, deps.github, deps.tailscale));
    }

    if (request.method === "GET" && !action) {
      return json(await shown());
    }

    if (request.method === "POST" && action === "start") {
      const current = await shown();
      if (isActive(current.state)) return json(current);
      const body = await readJson(request);
      if (!body.ok) return json({ error: "invalid json" }, 400);
      const parsed = buildDispatchInputs(target, body.value);
      if (!parsed.ok) return json({ error: parsed.error }, 400);
      await deps.github.dispatch(target.id, parsed.inputs);
      intents.markStarting(target.id);
      if (parsed.inputs.access_profile === "mini" || parsed.inputs.access_profile === "full") {
        intents.rememberAccess(target.id, parsed.inputs.access_profile);
      }
      return json(await shown());
    }

    if (request.method === "POST" && action === "stop") {
      const run = await deps.github.latestRun(target.id);
      const current = viewTarget(
        target,
        run,
        intents,
        await readyStatus(target, run, deps.github, deps.tailscale),
      );
      if (!isActive(current.state) || !run) return json(current);
      await deps.github.cancel(target.id, run.id);
      intents.markStopping(run.id);
      return json(
        viewTarget(target, run, intents, await readyStatus(target, run, deps.github, deps.tailscale)),
      );
    }
  }

  return new Response("Not found", { status: 404 });
}

function matchTargetPath(pathname: string): { id: string; action?: string } | null {
  const startStop = pathname.match(/^\/api\/targets\/(.+)\/(start|stop)$/);
  if (startStop) return { id: startStop[1], action: startStop[2] };
  const one = pathname.match(/^\/api\/targets\/(.+)$/);
  if (one?.[1]) return { id: one[1] };
  return null;
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function hasAdminToken(request: Request, adminToken: string): boolean {
  const header = request.headers.get("Authorization");
  return header === `Bearer ${adminToken}`;
}

async function readJson(request: Request): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const text = await request.text();
  if (!text.trim()) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}
