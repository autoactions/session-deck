import { describe, expect, it } from "vitest";
import { createWorker } from "../src/worker.ts";
import { FakeGitHub } from "./fake-github.ts";
import { DEBUG_CATALOG, SERVICE_CATALOG, linuxTarget, windowsTarget } from "./fixtures.ts";

const linuxOff = {
  id: "linux",
  label: "Linux",
  repo: "autoactions/debug-session",
  state: "off",
  runUrl: null,
  startedAt: null,
  openedBy: null,
  facts: [],
  onCaption: linuxTarget.onCaption,
  inputs: linuxTarget.inputs,
};

const windowsOff = {
  id: "windows",
  label: "Windows",
  repo: "autoactions/debug-session",
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

describe("target API auth", () => {
  const routes = [
    ["GET", "/api/targets"],
    ["GET", "/api/targets/linux"],
    ["POST", "/api/targets/linux/start"],
    ["POST", "/api/targets/linux/stop"],
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
  it("lists debug-session targets as off when GitHub has no runs", async () => {
    const { fetch } = worker();
    const response = await api(fetch, "/api/targets");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ targets: [linuxOff, windowsOff] });
  });

  it("reads one target from its latest GitHub run", async () => {
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
    const response = await api(fetch, "/api/targets/linux");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...linuxOff,
      state: "on",
      runUrl: "https://github.com/autoactions/debug-session/actions/runs/42",
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
    const response = await api(fetch, "/api/targets");
    const body = (await response.json()) as { targets: { id: string; state: string }[] };
    expect(body.targets).toEqual([
      expect.objectContaining({ id: "linux", state: "starting" }),
      expect.objectContaining({ id: "windows", state: "failed" }),
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
    const opened = await api(fetchImpl, "/api/targets/linux/start", { method: "POST" });
    expect(await opened.json()).toMatchObject({ id: "linux", state: "starting", facts: [] });
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
    await api(fetchImpl, "/api/targets/linux/start", { method: "POST" });
    const again = await api(fetchImpl, "/api/targets/linux/start", { method: "POST" });
    expect(dispatches).toBe(1);
    expect(await again.json()).toMatchObject({ id: "linux", state: "starting" });
  });

  it("opens an off linux target and then shows starting", async () => {
    const { fetch } = worker();
    const opened = await api(fetch, "/api/targets/linux/start", { method: "POST" });
    expect(opened.status).toBe(200);
    expect(await opened.json()).toEqual({
      ...linuxOff,
      state: "starting",
      runUrl: "https://github.com/autoactions/debug-session/actions/runs/1",
    });
  });

  it("does not open a second run when the target is already on", async () => {
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
    const opened = await api(fetch, "/api/targets/linux/start", { method: "POST" });
    expect(await opened.json()).toMatchObject({ id: "linux", state: "on", runUrl: github.runs.linux.htmlUrl });
    expect(github.runs.linux?.id).toBe(7);
  });

  it("closes an open target", async () => {
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
    const closed = await api(fetch, "/api/targets/windows/stop", { method: "POST" });
    expect(await closed.json()).toMatchObject({ id: "windows", state: "stopping" });
    const listed = await api(fetch, "/api/targets/windows");
    expect(await listed.json()).toMatchObject({ id: "windows", state: "stopping" });
  });

  it("opens linux with default Access and Session profiles", async () => {
    const { fetch, github } = worker();
    await api(fetch, "/api/targets/linux/start", { method: "POST" });
    expect(github.lastInputs.linux).toEqual({
      access_profile: "mini",
      session_profile: "developer",
    });
  });

  it("opens linux with Access Profile and Session Profile from the body", async () => {
    const { fetch, github } = worker();
    const opened = await api(fetch, "/api/targets/linux/start", {
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
    const opened = await api(fetch, "/api/targets/windows/start", {
      method: "POST",
      body: JSON.stringify({ session_profile: "core", enable_wsl: true }),
    });
    expect(github.lastInputs.windows).toEqual({
      session_profile: "core",
      enable_wsl: "true",
    });
  });

  it("rejects an unknown Session Profile", async () => {
    const { fetch } = worker();
    const opened = await api(fetch, "/api/targets/linux/start", {
      method: "POST",
      body: JSON.stringify({ session_profile: "plan" }),
    });
    expect(opened.status).toBe(400);
    expect(await opened.json()).toEqual({ error: "invalid session_profile" });
  });

  it("treats closing an already off target as success", async () => {
    const { fetch } = worker();
    const closed = await api(fetch, "/api/targets/windows/stop", { method: "POST" });
    expect(closed.status).toBe(200);
    expect(await closed.json()).toMatchObject({ id: "windows", state: "off" });
  });
});

describe("GitHub run observer", () => {
  it("reports an in-progress debug session on without Locator facts", async () => {
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
    const response = await api(fetch, "/api/targets/linux");
    expect(await response.json()).toMatchObject({
      id: "linux",
      label: "Linux",
      repo: "autoactions/debug-session",
      state: "on",
      runUrl: "https://github.com/autoactions/debug-session/actions/runs/42",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
      facts: [],
    });
  });

  it("shows Locator Block facts when the debug session publishes them", async () => {
    const github = new FakeGitHub();
    github.runs.linux = {
      id: 42,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/debug-session/actions/runs/42",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
    };
    github.outputs[42] = "## Locators\n- SSH: runner@100.64.0.10\n- RDP: 100.64.0.10:3389\n";
    const { fetch } = worker(github);
    const response = await api(fetch, "/api/targets/linux");
    expect(await response.json()).toMatchObject({
      id: "linux",
      state: "on",
      facts: [
        { label: "SSH", value: "runner@100.64.0.10" },
        { label: "RDP", value: "100.64.0.10:3389" },
      ],
    });
  });

  it("decrypts a tsrv Session Password without exposing its envelope", async () => {
    const github = new FakeGitHub();
    github.runs.linux = {
      id: 43,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/debug-session/actions/runs/43",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
    };
    const encrypted = "enc:v1:AQIDBAUGBwgJCgsMDQ4PEA:ERITFBUWFxgZGhsc:8XYgVKM3GYZMpY15qf4NG8huLDN3f-XD3WdOmQw";
    github.outputs[43] = `## Locators\n- SSH: runner@100.64.0.10\n\n## Sensitive Facts\n- Session Password: ${encrypted}\n`;
    const { fetch } = worker(github);
    const response = await api(fetch, "/api/targets/linux");
    const body = await response.json();
    expect(body).toMatchObject({
      state: "on",
      facts: [
        { label: "SSH", value: "runner@100.64.0.10" },
        { label: "Session Password", value: "private-value" },
      ],
    });
    expect(JSON.stringify(body)).not.toContain(encrypted);
  });

  it("stays starting while the GitHub run is queued", async () => {
    const github = new FakeGitHub();
    github.runs.linux = {
      id: 3,
      status: "queued",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/debug-session/actions/runs/3",
      startedAt: null,
      openedBy: "octo",
    };
    const { fetch } = worker(github);
    const response = await api(fetch, "/api/targets/linux");
    expect(await response.json()).toMatchObject({ id: "linux", state: "starting", facts: [] });
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
      facts: [{ label: "Session Address", value: "https://session-test.trycloudflare.com" }],
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
    const encrypted = "enc:v1:AQIDBAUGBwgJCgsMDQ4PEA:ERITFBUWFxgZGhsc:7mosD7YqEc4XsI5nqewgkCdIzdOxiAbQcjVX31Ks";
    github.outputs[16] = `## Locators\n- Session Address: https://session-test.trycloudflare.com\n\n## Sensitive Facts\n- Motrix Operator Token: ${encrypted}\n`;
    const valid = worker(github, SERVICE_CATALOG, "shared-session-password");
    expect(await (await api(valid.fetch, "/api/targets/motrix")).json()).toMatchObject({
      state: "on",
      facts: [
        { label: "Session Address", value: "https://session-test.trycloudflare.com" },
        { label: "Motrix Operator Token", value: "one-time-token" },
      ],
    });

    const invalid = worker(github, SERVICE_CATALOG, "wrong-password");
    const invalidBody = await (await api(invalid.fetch, "/api/targets/motrix", {
      headers: { Authorization: "Bearer wrong-password" },
    })).json();
    expect(invalidBody).toMatchObject({ state: "starting", facts: [] });
    expect(JSON.stringify(invalidBody)).not.toContain(encrypted);

    github.outputs[16] = `## Sensitive Facts\n- Motrix Operator Token: ${encrypted}\n`;
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
