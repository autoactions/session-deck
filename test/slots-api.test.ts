import { describe, expect, it } from "vitest";
import { createWorker } from "../src/worker.ts";
import { FakeGitHub } from "./fake-github.ts";

const adminToken = "test-admin-token";

function worker(github = new FakeGitHub()) {
  return { github, fetch: createWorker({ adminToken, github }) };
}

function api(
  fetchImpl: typeof fetch,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${adminToken}`);
  }
  return fetchImpl(new Request(`https://control.test${path}`, { ...init, headers }));
}

describe("slot API auth", () => {
  it("rejects slot reads without an Admin Token", async () => {
    const { fetch } = worker();
    const response = await fetch(new Request("https://control.test/api/slots"));
    expect(response.status).toBe(401);
  });

  it("rejects slot reads with the wrong Admin Token", async () => {
    const { fetch } = worker();
    const response = await fetch(
      new Request("https://control.test/api/slots", {
        headers: { Authorization: "Bearer nope" },
      }),
    );
    expect(response.status).toBe(401);
  });
});

describe("reading slots", () => {
  it("lists both slots as off when GitHub has no runs", async () => {
    const { fetch } = worker();
    const response = await api(fetch, "/api/slots");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      slots: [
        {
          id: "linux",
          hostname: "debug-session-linux",
          state: "off",
          runUrl: null,
        },
        {
          id: "windows",
          hostname: "debug-session-windows",
          state: "off",
          runUrl: null,
        },
      ],
    });
  });

  it("reads one slot from its latest GitHub run", async () => {
    const github = new FakeGitHub();
    github.runs.linux = {
      id: 42,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/debug-session/actions/runs/42",
    };
    const { fetch } = worker(github);
    const response = await api(fetch, "/api/slots/linux");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "linux",
      hostname: "debug-session-linux",
      state: "on",
      runUrl: "https://github.com/autoactions/debug-session/actions/runs/42",
    });
  });

  it("returns 404 for an unknown slot", async () => {
    const { fetch } = worker();
    const response = await api(fetch, "/api/slots/macos");
    expect(response.status).toBe(404);
  });

  it("maps queued runs to starting and failed conclusions to failed", async () => {
    const github = new FakeGitHub();
    github.runs.linux = {
      id: 1,
      status: "queued",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/debug-session/actions/runs/1",
    };
    github.runs.windows = {
      id: 2,
      status: "completed",
      conclusion: "failure",
      htmlUrl: "https://github.com/autoactions/debug-session/actions/runs/2",
    };
    const { fetch } = worker(github);
    const response = await api(fetch, "/api/slots");
    const body = (await response.json()) as {
      slots: { id: string; state: string }[];
    };
    expect(body.slots).toEqual([
      expect.objectContaining({ id: "linux", state: "starting" }),
      expect.objectContaining({ id: "windows", state: "failed" }),
    ]);
  });
});

describe("opening and closing slots", () => {
  it("reports starting after open even when GitHub has not listed the new run", async () => {
    const github = {
      latestRun: async () => null,
      dispatch: async () => {},
      cancel: async () => {},
    };
    const fetchImpl = createWorker({ adminToken, github });
    const opened = await api(fetchImpl, "/api/slots/linux/start", { method: "POST" });
    expect(await opened.json()).toMatchObject({
      id: "linux",
      state: "starting",
      hostname: "debug-session-linux",
    });
  });

  it("does not dispatch again while a start is already in flight", async () => {
    let dispatches = 0;
    const github = {
      latestRun: async () => null,
      dispatch: async () => {
        dispatches += 1;
      },
      cancel: async () => {},
    };
    const fetchImpl = createWorker({ adminToken, github });
    await api(fetchImpl, "/api/slots/linux/start", { method: "POST" });
    const again = await api(fetchImpl, "/api/slots/linux/start", { method: "POST" });
    expect(dispatches).toBe(1);
    expect(await again.json()).toMatchObject({ id: "linux", state: "starting" });
  });

  it("opens an off linux slot and then shows starting", async () => {
    const { fetch } = worker();
    const opened = await api(fetch, "/api/slots/linux/start", { method: "POST" });
    expect(opened.status).toBe(200);
    expect(await opened.json()).toEqual({
      id: "linux",
      hostname: "debug-session-linux",
      state: "starting",
      runUrl: "https://github.com/autoactions/debug-session/actions/runs/1",
    });
  });

  it("does not open a second run when the slot is already on", async () => {
    const github = new FakeGitHub();
    github.runs.linux = {
      id: 7,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/debug-session/actions/runs/7",
    };
    const { fetch } = worker(github);
    const opened = await api(fetch, "/api/slots/linux/start", { method: "POST" });
    expect(await opened.json()).toEqual({
      id: "linux",
      hostname: "debug-session-linux",
      state: "on",
      runUrl: "https://github.com/autoactions/debug-session/actions/runs/7",
    });
    expect(github.runs.linux?.id).toBe(7);
  });

  it("closes an open slot", async () => {
    const github = new FakeGitHub();
    github.runs.windows = {
      id: 9,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/debug-session/actions/runs/9",
    };
    const { fetch } = worker(github);
    const closed = await api(fetch, "/api/slots/windows/stop", { method: "POST" });
    expect(closed.status).toBe(200);
    expect(await closed.json()).toMatchObject({
      id: "windows",
      state: "stopping",
      runUrl: "https://github.com/autoactions/debug-session/actions/runs/9",
    });
    const listed = await api(fetch, "/api/slots/windows");
    expect(await listed.json()).toMatchObject({ id: "windows", state: "stopping" });
  });

  it("opens an off linux slot with default Access and Session profiles", async () => {
    const { fetch, github } = worker();
    await api(fetch, "/api/slots/linux/start", { method: "POST" });
    expect(github.lastInputs.linux).toEqual({
      access_profile: "mini",
      session_profile: "developer",
    });
  });

  it("opens linux with Access Profile and Session Profile from the body", async () => {
    const { fetch, github } = worker();
    const opened = await api(fetch, "/api/slots/linux/start", {
      method: "POST",
      body: JSON.stringify({ access_profile: "full", session_profile: "core" }),
    });
    expect(opened.status).toBe(200);
    expect(github.lastInputs.linux).toEqual({
      access_profile: "full",
      session_profile: "core",
    });
  });

  it("opens windows with Session Profile and WSL from the body", async () => {
    const { fetch, github } = worker();
    const opened = await api(fetch, "/api/slots/windows/start", {
      method: "POST",
      body: JSON.stringify({ session_profile: "core", enable_wsl: true }),
    });
    expect(opened.status).toBe(200);
    expect(github.lastInputs.windows).toEqual({
      session_profile: "core",
      enable_wsl: "true",
    });
  });

  it("rejects an unknown Session Profile", async () => {
    const { fetch } = worker();
    const opened = await api(fetch, "/api/slots/linux/start", {
      method: "POST",
      body: JSON.stringify({ session_profile: "plan" }),
    });
    expect(opened.status).toBe(400);
    expect(await opened.json()).toEqual({ error: "invalid session_profile" });
  });

  it("treats closing an already off slot as success", async () => {
    const { fetch } = worker();
    const closed = await api(fetch, "/api/slots/windows/stop", { method: "POST" });
    expect(closed.status).toBe(200);
    expect(await closed.json()).toMatchObject({ id: "windows", state: "off" });
  });
});
