import type { GitHubActions } from "./github.ts";
import { buildDispatchInputs, isSlotId } from "./github.ts";
import type { SlotIntents } from "./intents.ts";
import { memorySlotIntents } from "./intents.ts";
import { MARK_SVG, renderPage } from "./page.ts";
import { hostnameFor, isActive, listSlots, viewSlot } from "./slots.ts";
import type { TailscaleNet } from "./tailscale.ts";
import { unknownTailscale } from "./tailscale.ts";

export type WorkerDeps = {
  adminToken: string;
  github: GitHubActions;
  intents?: SlotIntents;
  tailscale?: TailscaleNet;
};

export function createWorker(deps: WorkerDeps): typeof fetch {
  const intents = deps.intents ?? memorySlotIntents();
  const tailscale = deps.tailscale ?? unknownTailscale();
  return async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    try {
      return await route(request, { ...deps, tailscale }, intents);
    } catch (error) {
      const message = error instanceof Error ? error.message : "upstream error";
      return json({ error: message }, 502);
    }
  };
}

async function route(
  request: Request,
  deps: WorkerDeps & { tailscale: TailscaleNet },
  intents: SlotIntents,
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/") {
    return new Response(renderPage(), {
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

  if (request.method === "GET" && url.pathname === "/api/slots") {
    return json({ slots: await listSlots(deps.github, intents, deps.tailscale) });
  }

  const slotMatch = url.pathname.match(/^\/api\/slots\/([^/]+)(?:\/(start|stop))?$/);
  if (slotMatch) {
    const slot = slotMatch[1];
    const action = slotMatch[2];
    if (!isSlotId(slot)) {
      return json({ error: "not found" }, 404);
    }

    if (request.method === "GET" && !action) {
      return json(
        viewSlot(slot, await deps.github.latestRun(slot), intents, await deps.tailscale.status(hostnameFor(slot))),
      );
    }

    if (request.method === "POST" && action === "start") {
      const current = viewSlot(
        slot,
        await deps.github.latestRun(slot),
        intents,
        await deps.tailscale.status(hostnameFor(slot)),
      );
      if (isActive(current.state)) return json(current);
      const body = await readJson(request);
      if (!body.ok) return json({ error: "invalid json" }, 400);
      const parsed = buildDispatchInputs(slot, body.value);
      if (!parsed.ok) return json({ error: parsed.error }, 400);
      await deps.github.dispatch(slot, parsed.inputs);
      intents.markStarting(slot);
      if (slot === "linux" && (parsed.inputs.access_profile === "mini" || parsed.inputs.access_profile === "full")) {
        intents.rememberAccess(slot, parsed.inputs.access_profile);
      }
      return json(
        viewSlot(slot, await deps.github.latestRun(slot), intents, await deps.tailscale.status(hostnameFor(slot))),
      );
    }

    if (request.method === "POST" && action === "stop") {
      const run = await deps.github.latestRun(slot);
      const current = viewSlot(slot, run, intents, await deps.tailscale.status(hostnameFor(slot)));
      if (!isActive(current.state) || !run) return json(current);
      await deps.github.cancel(run.id);
      intents.markStopping(run.id);
      return json(viewSlot(slot, run, intents, await deps.tailscale.status(hostnameFor(slot))));
    }
  }

  return new Response("Not found", { status: 404 });
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
