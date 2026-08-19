import { describe, expect, it } from "vitest";
import { createWorker } from "../src/worker.ts";
import { FakeGitHub } from "./fake-github.ts";
import { FakeTailscale } from "./fake-tailscale.ts";

const linuxFacts = {
  startedAt: null,
  openedBy: null,
  ssh: "runner@debug-session-linux",
  rdp: null,
  address: null,
};

const windowsFacts = {
  startedAt: null,
  openedBy: null,
  ssh: "runneradmin@debug-session-windows",
  rdp: "debug-session-windows:3389",
  address: null,
};

const adminToken = "test-admin-token";

function worker(github = new FakeGitHub(), tailscale?: FakeTailscale) {
  return { github, fetch: createWorker({ adminToken, github, tailscale }) };
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
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      slots: [
        {
          id: "linux",
          hostname: "debug-session-linux",
          state: "off",
          runUrl: null,
          ...linuxFacts,
        },
        {
          id: "windows",
          hostname: "debug-session-windows",
          state: "off",
          runUrl: null,
          ...windowsFacts,
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
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
    };
    const { fetch } = worker(github);
    const response = await api(fetch, "/api/slots/linux");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      id: "linux",
      hostname: "debug-session-linux",
      state: "on",
      runUrl: "https://github.com/autoactions/debug-session/actions/runs/42",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
      ssh: "runner@debug-session-linux",
      rdp: null,
      address: null,
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
      startedAt: null,
      openedBy: null,
    };
    github.runs.windows = {
      id: 2,
      status: "completed",
      conclusion: "failure",
      htmlUrl: "https://github.com/autoactions/debug-session/actions/runs/2",
      startedAt: "2026-08-18T09:00:00Z",
      openedBy: "octo",
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
      ssh: "runner@debug-session-linux",
      rdp: null,
      address: null,
      startedAt: null,
      openedBy: null,
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
    expect(opened.headers.get("Cache-Control")).toBe("no-store");
    expect(await opened.json()).toEqual({
      id: "linux",
      hostname: "debug-session-linux",
      state: "starting",
      runUrl: "https://github.com/autoactions/debug-session/actions/runs/1",
      ...linuxFacts,
    });
  });

  it("does not open a second run when the slot is already on", async () => {
    const github = new FakeGitHub();
    github.runs.linux = {
      id: 7,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/debug-session/actions/runs/7",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
    };
    const { fetch } = worker(github);
    const opened = await api(fetch, "/api/slots/linux/start", { method: "POST" });
    expect(await opened.json()).toEqual({
      id: "linux",
      hostname: "debug-session-linux",
      state: "on",
      runUrl: "https://github.com/autoactions/debug-session/actions/runs/7",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
      ssh: "runner@debug-session-linux",
      rdp: null,
      address: null,
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
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
    };
    const { fetch } = worker(github);
    const closed = await api(fetch, "/api/slots/windows/stop", { method: "POST" });
    expect(closed.status).toBe(200);
    expect(closed.headers.get("Cache-Control")).toBe("no-store");
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
    expect(await opened.json()).toMatchObject({
      id: "linux",
      state: "starting",
      rdp: "debug-session-linux:3389",
    });
  });

  it("keeps linux RDP after a full session joins the tailnet", async () => {
    const github = new FakeGitHub();
    const tailscale = new FakeTailscale();
    const { fetch } = worker(github, tailscale);
    await api(fetch, "/api/slots/linux/start", {
      method: "POST",
      body: JSON.stringify({ access_profile: "full" }),
    });
    github.runs.linux = {
      id: 12,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/debug-session/actions/runs/12",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
    };
    tailscale.online["debug-session-linux"] = "100.64.0.10";
    const response = await api(fetch, "/api/slots/linux");
    expect(await response.json()).toMatchObject({
      id: "linux",
      state: "on",
      rdp: "debug-session-linux:3389",
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

describe("Join", () => {
  it("keeps an in-progress run starting until the reserved hostname is online", async () => {
    const github = new FakeGitHub();
    github.runs.linux = {
      id: 42,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/debug-session/actions/runs/42",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
    };
    const tailscale = new FakeTailscale();
    const { fetch } = worker(github, tailscale);
    const response = await api(fetch, "/api/slots/linux");
    expect(await response.json()).toMatchObject({
      id: "linux",
      state: "starting",
      address: null,
    });
  });

  it("reports on with the tailnet address when the reserved hostname is online", async () => {
    const github = new FakeGitHub();
    github.runs.linux = {
      id: 42,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/debug-session/actions/runs/42",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
    };
    const tailscale = new FakeTailscale();
    tailscale.online["debug-session-linux"] = "100.64.0.10";
    const { fetch } = worker(github, tailscale);
    const response = await api(fetch, "/api/slots/linux");
    expect(await response.json()).toEqual({
      id: "linux",
      hostname: "debug-session-linux",
      state: "on",
      runUrl: "https://github.com/autoactions/debug-session/actions/runs/42",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
      ssh: "runner@debug-session-linux",
      rdp: null,
      address: "100.64.0.10",
    });
  });

  it("stays starting while queued even if a leftover device is still online", async () => {
    const github = new FakeGitHub();
    github.runs.linux = {
      id: 3,
      status: "queued",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/debug-session/actions/runs/3",
      startedAt: null,
      openedBy: "octo",
    };
    const tailscale = new FakeTailscale();
    tailscale.online["debug-session-linux"] = "100.64.0.10";
    const { fetch } = worker(github, tailscale);
    const response = await api(fetch, "/api/slots/linux");
    expect(await response.json()).toMatchObject({
      id: "linux",
      state: "starting",
      address: null,
    });
  });

  it("stays starting after open when a leftover device is still online", async () => {
    const github = {
      latestRun: async () => null,
      dispatch: async () => {},
      cancel: async () => {},
    };
    const tailscale = new FakeTailscale();
    tailscale.online["debug-session-linux"] = "100.64.0.10";
    const fetchImpl = createWorker({ adminToken, github, tailscale });
    const opened = await api(fetchImpl, "/api/slots/linux/start", { method: "POST" });
    expect(await opened.json()).toMatchObject({
      id: "linux",
      state: "starting",
      address: null,
    });
  });

  it("still reports stopping while the hostname is online", async () => {
    const github = new FakeGitHub();
    github.runs.windows = {
      id: 9,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/debug-session/actions/runs/9",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
    };
    const tailscale = new FakeTailscale();
    tailscale.online["debug-session-windows"] = "100.64.0.11";
    const { fetch } = worker(github, tailscale);
    const closed = await api(fetch, "/api/slots/windows/stop", { method: "POST" });
    expect(await closed.json()).toMatchObject({
      id: "windows",
      state: "stopping",
      address: null,
    });
  });
});
