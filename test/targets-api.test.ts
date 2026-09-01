import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearObserverCache, OBSERVER_WAITING_TTL_MS } from "../src/targets.ts";
import { createWorker } from "../src/worker.ts";
import { FakeGitHub } from "./fake-github.ts";
import { DEBUG_CATALOG, SERVICE_CATALOG, linuxTarget, windowsTarget } from "./fixtures.ts";

const linuxOff = {
  id: "tsrv/linux",
  label: "Linux",
  repo: "autoactions/tsrv",
  state: "off",
  runUrl: null,
  startedAt: null,
  openedBy: null,
  facts: [],
  onCaption: linuxTarget.onCaption,
  inputs: linuxTarget.inputs,
};

const windowsOff = {
  id: "tsrv/windows",
  label: "Windows",
  repo: "autoactions/tsrv",
  state: "off",
  runUrl: null,
  startedAt: null,
  openedBy: null,
  facts: [],
  onCaption: windowsTarget.onCaption,
  inputs: windowsTarget.inputs,
};

const sessionPassword = "shared-session-password";

function worker(github = new FakeGitHub(), catalog = DEBUG_CATALOG, password = sessionPassword) {
  return { github, fetch: createWorker({ sessionPassword: password, github, catalog }) };
}

function api(
  fetchImpl: typeof fetch,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${sessionPassword}`);
  }
  return fetchImpl(new Request(`https://control.test${path}`, { ...init, headers }));
}

beforeEach(() => {
  clearObserverCache();
});

describe("target API auth", () => {
  const routes = [
    ["GET", "/api/targets"],
    ["GET", "/api/targets/tsrv/linux"],
    ["POST", "/api/targets/tsrv/linux/start"],
    ["POST", "/api/targets/tsrv/linux/stop"],
  ] as const;

  it.each(routes)("rejects %s %s without a Session Password", async (method, path) => {
    const { fetch } = worker();
    const response = await fetch(new Request(`https://control.test${path}`, { method }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it.each(routes)("rejects %s %s with the wrong Session Password", async (method, path) => {
    const github = new FakeGitHub();
    github.latestRun = async () => { throw new Error("GitHub must not be queried"); };
    github.dispatch = async () => { throw new Error("GitHub must not be dispatched"); };
    github.cancel = async () => { throw new Error("GitHub must not be cancelled"); };
    const { fetch } = worker(github);
    const response = await fetch(new Request(`https://control.test${path}`, {
      method,
      headers: { Authorization: "Bearer wrong-password" },
    }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });
});

describe("reading targets", () => {
  it("lists tsrv targets as off when GitHub has no runs", async () => {
    const { fetch } = worker();
    const response = await api(fetch, "/api/targets");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ targets: [linuxOff, windowsOff] });
  });

  it("reads one target from its latest GitHub run", async () => {
    const github = new FakeGitHub();
    github.runs["tsrv/linux"] = {
      id: 42,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/tsrv/actions/runs/42",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
    };
    const { fetch } = worker(github);
    const response = await api(fetch, "/api/targets/tsrv/linux");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...linuxOff,
      state: "on",
      runUrl: "https://github.com/autoactions/tsrv/actions/runs/42",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
    });
  });

  it("returns 404 for an unknown target", async () => {
    const { fetch } = worker();
    const response = await api(fetch, "/api/targets/macos");
    expect(response.status).toBe(404);
  });

  it("maps queued runs to starting and failed conclusions to failed", async () => {
    const github = new FakeGitHub();
    github.runs["tsrv/linux"] = {
      id: 1,
      status: "queued",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/tsrv/actions/runs/1",
      startedAt: null,
      openedBy: null,
    };
    github.runs["tsrv/windows"] = {
      id: 2,
      status: "completed",
      conclusion: "failure",
      htmlUrl: "https://github.com/autoactions/tsrv/actions/runs/2",
      startedAt: "2026-08-18T09:00:00Z",
      openedBy: "octo",
    };
    const { fetch } = worker(github);
    const response = await api(fetch, "/api/targets");
    const body = (await response.json()) as { targets: { id: string; state: string }[] };
    expect(body.targets).toEqual([
      expect.objectContaining({ id: "tsrv/linux", state: "starting" }),
      expect.objectContaining({ id: "tsrv/windows", state: "failed" }),
    ]);
  });
});

describe("opening and closing targets", () => {
  it("reports starting after open even when GitHub has not listed the new run", async () => {
    const github = {
      latestRun: async () => null,
      dispatch: async () => {},
      cancel: async () => {},
    };
    const fetchImpl = createWorker({ sessionPassword, github, catalog: DEBUG_CATALOG });
    const opened = await api(fetchImpl, "/api/targets/tsrv/linux/start", { method: "POST" });
    expect(await opened.json()).toMatchObject({ id: "tsrv/linux", state: "starting", facts: [] });
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
    const fetchImpl = createWorker({ sessionPassword, github, catalog: DEBUG_CATALOG });
    await api(fetchImpl, "/api/targets/tsrv/linux/start", { method: "POST" });
    const again = await api(fetchImpl, "/api/targets/tsrv/linux/start", { method: "POST" });
    expect(dispatches).toBe(1);
    expect(await again.json()).toMatchObject({ id: "tsrv/linux", state: "starting" });
  });

  it("opens an off linux target and then shows starting", async () => {
    const { fetch } = worker();
    const opened = await api(fetch, "/api/targets/tsrv/linux/start", { method: "POST" });
    expect(opened.status).toBe(200);
    expect(await opened.json()).toEqual({
      ...linuxOff,
      state: "starting",
      runUrl: "https://github.com/autoactions/tsrv/actions/runs/1",
    });
  });

  it("does not open a second run when the target is already on", async () => {
    const github = new FakeGitHub();
    github.runs["tsrv/linux"] = {
      id: 7,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/tsrv/actions/runs/7",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
    };
    const { fetch } = worker(github);
    const opened = await api(fetch, "/api/targets/tsrv/linux/start", { method: "POST" });
    expect(await opened.json()).toMatchObject({ id: "tsrv/linux", state: "on", runUrl: github.runs["tsrv/linux"].htmlUrl });
    expect(github.runs["tsrv/linux"]?.id).toBe(7);
  });

  it("closes an open target", async () => {
    const github = new FakeGitHub();
    github.runs["tsrv/windows"] = {
      id: 9,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/tsrv/actions/runs/9",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
    };
    const { fetch } = worker(github);
    const closed = await api(fetch, "/api/targets/tsrv/windows/stop", { method: "POST" });
    expect(await closed.json()).toMatchObject({ id: "tsrv/windows", state: "stopping" });
    const listed = await api(fetch, "/api/targets/tsrv/windows");
    expect(await listed.json()).toMatchObject({ id: "tsrv/windows", state: "stopping" });
  });

  it("opens linux with default Access and Session profiles", async () => {
    const { fetch, github } = worker();
    await api(fetch, "/api/targets/tsrv/linux/start", { method: "POST" });
    expect(github.lastInputs["tsrv/linux"]).toEqual({
      access_profile: "mini",
      session_profile: "developer",
    });
  });

  it("opens linux with Access Profile and Session Profile from the body", async () => {
    const { fetch, github } = worker();
    const opened = await api(fetch, "/api/targets/tsrv/linux/start", {
      method: "POST",
      body: JSON.stringify({ access_profile: "full", session_profile: "core" }),
    });
    expect(opened.status).toBe(200);
    expect(github.lastInputs["tsrv/linux"]).toEqual({
      access_profile: "full",
      session_profile: "core",
    });
  });

  it("opens windows with Session Profile and WSL from the body", async () => {
    const { fetch, github } = worker();
    const opened = await api(fetch, "/api/targets/tsrv/windows/start", {
      method: "POST",
      body: JSON.stringify({ session_profile: "core", enable_wsl: true }),
    });
    expect(github.lastInputs["tsrv/windows"]).toEqual({
      session_profile: "core",
      enable_wsl: "true",
    });
  });

  it("rejects an unknown Session Profile", async () => {
    const { fetch } = worker();
    const opened = await api(fetch, "/api/targets/tsrv/linux/start", {
      method: "POST",
      body: JSON.stringify({ session_profile: "plan" }),
    });
    expect(opened.status).toBe(400);
    expect(await opened.json()).toEqual({ error: "invalid session_profile" });
  });

  it("treats closing an already off target as success", async () => {
    const { fetch } = worker();
    const closed = await api(fetch, "/api/targets/tsrv/windows/stop", { method: "POST" });
    expect(closed.status).toBe(200);
    expect(await closed.json()).toMatchObject({ id: "tsrv/windows", state: "off" });
  });
});

describe("GitHub run observer", () => {
  it("keeps an active target readable when Observer output is unavailable", async () => {
    const run = {
      id: 44,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/tsrv/actions/runs/44",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
    };
    const github = {
      latestRun: async () => run,
      dispatch: async () => {},
      cancel: async () => {},
      observerOutput: async () => { throw new Error("Artifact is not available"); },
    };
    const fetchImpl = createWorker({ sessionPassword, github, catalog: [linuxTarget] });
    const response = await api(fetchImpl, "/api/targets/tsrv/linux");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "tsrv/linux", state: "on", facts: [] });
  });

  it("reports an in-progress debug session on without Locator facts", async () => {
    const github = new FakeGitHub();
    github.runs["tsrv/linux"] = {
      id: 42,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/tsrv/actions/runs/42",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
    };
    const { fetch } = worker(github);
    const response = await api(fetch, "/api/targets/tsrv/linux");
    expect(await response.json()).toMatchObject({
      id: "tsrv/linux",
      label: "Linux",
      repo: "autoactions/tsrv",
      state: "on",
      runUrl: "https://github.com/autoactions/tsrv/actions/runs/42",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
      facts: [],
    });
  });

  it("reuses Observer output for the same live run", async () => {
    const run = {
      id: 42,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/tsrv/actions/runs/42",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
    };
    let calls = 0;
    const github = {
      latestRun: async () => run,
      dispatch: async () => {},
      cancel: async () => {},
      observerOutput: async () => {
        calls += 1;
        return "## Locators\n- SSH: runner@100.64.0.10\n";
      },
    };
    const fetchImpl = createWorker({ sessionPassword, github, catalog: [linuxTarget] });
    const first = await (await api(fetchImpl, "/api/targets/tsrv/linux")).json();
    const second = (await (await api(fetchImpl, "/api/targets")).json()) as { targets: unknown[] };
    expect(first).toMatchObject({
      state: "on",
      facts: [{ label: "SSH", value: "runner@100.64.0.10", sensitive: false }],
    });
    expect(second.targets[0]).toMatchObject(first as object);
    expect(calls).toBe(1);
  });

  it("shows Locator Block facts when the debug session publishes them", async () => {
    const github = new FakeGitHub();
    github.runs["tsrv/linux"] = {
      id: 42,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/tsrv/actions/runs/42",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
    };
    github.outputs[42] = "## Locators\n- SSH: runner@100.64.0.10\n- RDP: 100.64.0.10:3389\n";
    const { fetch } = worker(github);
    const response = await api(fetch, "/api/targets/tsrv/linux");
    expect(await response.json()).toMatchObject({
      id: "tsrv/linux",
      state: "on",
      facts: [
        { label: "SSH", value: "runner@100.64.0.10", sensitive: false },
        { label: "RDP", value: "100.64.0.10:3389", sensitive: false },
      ],
    });
  });

  it("keeps public Locator facts on a debug session when Sensitive Facts cannot be decrypted", async () => {
    const github = new FakeGitHub();
    github.runs["tsrv/linux"] = {
      id: 46,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/tsrv/actions/runs/46",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
    };
    const encrypted = "enc:v2:AQIDBAUGBwgJCgsMDQ4PEA:ERITFBUWFxgZGhsc:Shap0xyfNasoDIc5tPqGpuH_Muzis2PBzP3gu_A";
    github.outputs[46] = `## Locators\n- SSH: runner@100.64.0.10\n\n## Sensitive Facts\n- Session Password: ${encrypted}\n`;
    const { fetch } = worker(github, DEBUG_CATALOG, "other-session-password");
    const response = await api(fetch, "/api/targets/tsrv/linux", {
      headers: { Authorization: "Bearer other-session-password" },
    });
    const body = await response.json();
    expect(body).toMatchObject({
      state: "on",
      facts: [{ label: "SSH", value: "runner@100.64.0.10" }],
    });
    expect(JSON.stringify(body)).not.toContain(encrypted);
  });

  it("decrypts a tsrv Session Password without exposing its envelope", async () => {
    const github = new FakeGitHub();
    github.runs["tsrv/linux"] = {
      id: 43,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/tsrv/actions/runs/43",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
    };
    const encrypted = "enc:v2:AQIDBAUGBwgJCgsMDQ4PEA:ERITFBUWFxgZGhsc:Shap0xyfNasoDIc5tPqGpuH_Muzis2PBzP3gu_A";
    github.outputs[43] = `## Locators\n- SSH: runner@100.64.0.10\n\n## Sensitive Facts\n- Session Password: ${encrypted}\n`;
    const { fetch } = worker(github);
    const response = await api(fetch, "/api/targets/tsrv/linux");
    const body = await response.json();
    expect(body).toMatchObject({
      state: "on",
      facts: [
        { label: "SSH", value: "runner@100.64.0.10", sensitive: false },
        { label: "Session Password", value: "private-value", sensitive: true },
      ],
    });
    expect(JSON.stringify(body)).not.toContain(encrypted);
  });

  it("recovers facts on the next refresh after the Locator Artifact appears", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const github = new FakeGitHub();
      github.runs["tsrv/linux"] = {
        id: 45,
        status: "in_progress",
        conclusion: null,
        htmlUrl: "https://github.com/autoactions/tsrv/actions/runs/45",
        startedAt: "2026-08-18T10:00:00Z",
        openedBy: "octo",
      };
      const { fetch } = worker(github);
      const before = await api(fetch, "/api/targets/tsrv/linux");
      expect(await before.json()).toMatchObject({ state: "on", facts: [] });

      github.outputs[45] = "## Locators\n- SSH: runner@100.64.0.10\n";
      vi.advanceTimersByTime(OBSERVER_WAITING_TTL_MS);
      const after = await api(fetch, "/api/targets/tsrv/linux");
      expect(await after.json()).toMatchObject({
        state: "on",
        facts: [{ label: "SSH", value: "runner@100.64.0.10" }],
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("stays starting while the GitHub run is queued", async () => {
    const github = new FakeGitHub();
    github.runs["tsrv/linux"] = {
      id: 3,
      status: "queued",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/tsrv/actions/runs/3",
      startedAt: null,
      openedBy: "octo",
    };
    const { fetch } = worker(github);
    const response = await api(fetch, "/api/targets/tsrv/linux");
    expect(await response.json()).toMatchObject({ id: "tsrv/linux", state: "starting", facts: [] });
  });
});

describe("temporary service targets", () => {
  it("lists chrome, motrix, and openlist", async () => {
    const { fetch } = worker(new FakeGitHub(), SERVICE_CATALOG);
    const response = await api(fetch, "/api/targets");
    const body = (await response.json()) as { targets: { id: string; state: string }[] };
    expect(body.targets.map((target) => target.id)).toEqual(["chrome", "motrix", "openlist"]);
  });

  it("dispatches chrome with service=chrome", async () => {
    const { fetch, github } = worker(new FakeGitHub(), SERVICE_CATALOG);
    await api(fetch, "/api/targets/chrome/start", { method: "POST" });
    expect(github.lastInputs.chrome).toEqual({ service: "chrome" });
  });

  it("keeps chrome starting until a Locator Block is observed", async () => {
    const github = new FakeGitHub();
    github.runs.chrome = {
      id: 15,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/tsvc/actions/runs/15",
      startedAt: "2026-08-25T10:00:00Z",
      openedBy: "octo",
    };
    const { fetch } = worker(github, SERVICE_CATALOG);
    const response = await api(fetch, "/api/targets/chrome");
    expect(await response.json()).toMatchObject({ id: "chrome", state: "starting", facts: [] });
  });

  it("reports chrome on with facts from the Locator Block", async () => {
    const github = new FakeGitHub();
    github.runs.chrome = {
      id: 15,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/tsvc/actions/runs/15",
      startedAt: "2026-08-25T10:00:00Z",
      openedBy: "octo",
    };
    github.outputs[15] = "## Locators\n- Session Address: https://session-test.trycloudflare.com\n";
    const { fetch } = worker(github, SERVICE_CATALOG);
    const response = await api(fetch, "/api/targets/chrome");
    expect(await response.json()).toMatchObject({
      id: "chrome",
      label: "Chrome",
      repo: "autoactions/tsvc",
      state: "on",
      runUrl: "https://github.com/autoactions/tsvc/actions/runs/15",
      startedAt: "2026-08-25T10:00:00Z",
      openedBy: "octo",
      facts: [{ label: "Session Address", value: "https://session-test.trycloudflare.com", sensitive: false }],
    });
  });

  it("requires a valid encrypted fact before reporting a service target on", async () => {
    const github = new FakeGitHub();
    github.runs.motrix = {
      id: 16,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/tsvc/actions/runs/16",
      startedAt: "2026-08-25T10:00:00Z",
      openedBy: "octo",
    };
    const encrypted = "enc:v2:AQIDBAUGBwgJCgsMDQ4PEA:ERITFBUWFxgZGhsc:VQqliAmCPeNzGYQntK9gCv1aF11urOp12WcrMSpu";
    github.outputs[16] = `## Locators\n- Session Address: https://session-test.trycloudflare.com\n\n## Sensitive Facts\n- Motrix Operator Token: ${encrypted}\n`;
    const valid = worker(github, SERVICE_CATALOG, "shared-session-password");
    expect(await (await api(valid.fetch, "/api/targets/motrix")).json()).toMatchObject({
      state: "on",
      facts: [
        { label: "Session Address", value: "https://session-test.trycloudflare.com", sensitive: false },
        { label: "Motrix Operator Token", value: "one-time-token", sensitive: true },
      ],
    });

    const invalid = worker(github, SERVICE_CATALOG, "wrong-password");
    const invalidBody = await (await api(invalid.fetch, "/api/targets/motrix", {
      headers: { Authorization: "Bearer wrong-password" },
    })).json();
    expect(invalidBody).toMatchObject({ state: "starting", facts: [] });
    expect(JSON.stringify(invalidBody)).not.toContain(encrypted);

    github.outputs[16] = `## Sensitive Facts\n- Motrix Operator Token: ${encrypted}\n`;
    clearObserverCache();
    const missingLocator = worker(github, SERVICE_CATALOG, "shared-session-password");
    expect(await (await api(missingLocator.fetch, "/api/targets/motrix")).json())
      .toMatchObject({ state: "starting", facts: [] });
  });

  it("does not start a second openlist run while one is active", async () => {
    const github = new FakeGitHub();
    github.runs.openlist = {
      id: 21,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/tsvc/actions/runs/21",
      startedAt: "2026-08-25T10:00:00Z",
      openedBy: "octo",
    };
    const { fetch } = worker(github, SERVICE_CATALOG);
    const opened = await api(fetch, "/api/targets/openlist/start", { method: "POST" });
    expect(github.lastInputs.openlist).toBeNull();
    expect(await opened.json()).toMatchObject({ id: "openlist", state: "starting" });
  });
});
