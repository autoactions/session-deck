import type { GitHubActions } from "./github.ts";
import { isSlotId } from "./github.ts";
import type { SlotIntents } from "./intents.ts";
import { memorySlotIntents } from "./intents.ts";
import { renderPage } from "./page.ts";
import { isActive, listSlots, viewSlot } from "./slots.ts";

export type WorkerDeps = {
  adminToken: string;
  github: GitHubActions;
  intents?: SlotIntents;
};

export function createWorker(deps: WorkerDeps): typeof fetch {
  const intents = deps.intents ?? memorySlotIntents();
  return async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    try {
      return await route(request, deps, intents);
    } catch (error) {
      const message = error instanceof Error ? error.message : "upstream error";
      return Response.json({ error: message }, { status: 502 });
    }
  };
}

async function route(request: Request, deps: WorkerDeps, intents: SlotIntents): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/") {
    return new Response(renderPage(), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  if (url.pathname.startsWith("/api/")) {
    if (!deps.adminToken || !hasAdminToken(request, deps.adminToken)) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  if (request.method === "GET" && url.pathname === "/api/slots") {
    return Response.json({ slots: await listSlots(deps.github, intents) });
  }

  const slotMatch = url.pathname.match(/^\/api\/slots\/([^/]+)(?:\/(start|stop))?$/);
  if (slotMatch) {
    const slot = slotMatch[1];
    const action = slotMatch[2];
    if (!isSlotId(slot)) {
      return Response.json({ error: "not found" }, { status: 404 });
    }

    if (request.method === "GET" && !action) {
      return Response.json(viewSlot(slot, await deps.github.latestRun(slot), intents));
    }

    if (request.method === "POST" && action === "start") {
      const current = viewSlot(slot, await deps.github.latestRun(slot), intents);
      if (isActive(current.state)) return Response.json(current);
      await deps.github.dispatch(slot);
      intents.markStarting(slot);
      return Response.json(viewSlot(slot, await deps.github.latestRun(slot), intents));
    }

    if (request.method === "POST" && action === "stop") {
      const run = await deps.github.latestRun(slot);
      const current = viewSlot(slot, run, intents);
      if (!isActive(current.state) || !run) return Response.json(current);
      await deps.github.cancel(run.id);
      intents.markStopping(run.id);
      return Response.json(viewSlot(slot, run, intents));
    }
  }

  return new Response("Not found", { status: 404 });
}

function hasAdminToken(request: Request, adminToken: string): boolean {
  const header = request.headers.get("Authorization");
  return header === `Bearer ${adminToken}`;
}
