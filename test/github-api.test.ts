import { describe, expect, it } from "vitest";
import { createGitHubActions } from "../src/github.ts";

type Call = { url: string; method: string; body: unknown; headers: Headers };

const debugTargets = {
  linux: { workflow: "linux.yml", defaultInputs: { access_profile: "mini", session_profile: "developer" } },
  windows: { workflow: "windows.yml", defaultInputs: { session_profile: "developer", enable_wsl: "false" } },
};

function githubWith(
  handler: (call: Call) => Response | Promise<Response>,
  targets: Record<string, { workflow: string; displayTitle?: string; defaultInputs?: Record<string, string> }> = debugTargets,
) {
  const calls: Call[] = [];
  const github = createGitHubActions({
    token: "gh-token",
    repo: "autoactions/debug-session",
    ref: "main",
    targets,
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const call: Call = {
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: request.headers.get("content-type")?.includes("json") ? await request.json() : null,
      };
      calls.push(call);
      return handler(call);
    },
  });
  return { github, calls };
}

describe("GitHub Actions adapter", () => {
  it("reads the latest linux workflow run", async () => {
    const { github, calls } = githubWith(() =>
      Response.json({
        workflow_runs: [
          {
            id: 88,
            status: "in_progress",
            conclusion: null,
            html_url: "https://github.com/autoactions/debug-session/actions/runs/88",
            run_started_at: "2026-08-18T10:00:00Z",
            actor: { login: "octo" },
          },
        ],
      }),
    );

    expect(await github.latestRun("linux")).toEqual({
      id: 88,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/debug-session/actions/runs/88",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
    });
    expect(calls[0]).toMatchObject({
      method: "GET",
      url: "https://api.github.com/repos/autoactions/debug-session/actions/workflows/linux.yml/runs?per_page=1",
    });
    expect(calls[0].headers.get("Authorization")).toBe("Bearer gh-token");
  });

  it("dispatches linux with the default access and session profiles", async () => {
    const { github, calls } = githubWith(() => new Response(null, { status: 204 }));
    await github.dispatch("linux");
    expect(calls[0]).toMatchObject({
      method: "POST",
      url: "https://api.github.com/repos/autoactions/debug-session/actions/workflows/linux.yml/dispatches",
      body: {
        ref: "main",
        inputs: {
          access_profile: "mini",
          session_profile: "developer",
        },
      },
    });
  });

  it("dispatches windows with developer profile and WSL off", async () => {
    const { github, calls } = githubWith(() => new Response(null, { status: 204 }));
    await github.dispatch("windows");
    expect(calls[0]).toMatchObject({
      method: "POST",
      url: "https://api.github.com/repos/autoactions/debug-session/actions/workflows/windows.yml/dispatches",
      body: {
        ref: "main",
        inputs: {
          session_profile: "developer",
          enable_wsl: "false",
        },
      },
    });
  });

  it("dispatches linux with an override Access Profile", async () => {
    const { github, calls } = githubWith(() => new Response(null, { status: 204 }));
    await github.dispatch("linux", { access_profile: "full", session_profile: "core" });
    expect(calls[0].body).toEqual({
      ref: "main",
      inputs: { access_profile: "full", session_profile: "core" },
    });
  });

  it("cancels a workflow run", async () => {
    const { github, calls } = githubWith(() => new Response(null, { status: 202 }));
    await github.cancel("linux", 99);
    expect(calls[0]).toMatchObject({
      method: "POST",
      url: "https://api.github.com/repos/autoactions/debug-session/actions/runs/99/cancel",
    });
  });

  it("filters shared-workflow runs by display title", async () => {
    const { github, calls } = githubWith(
      () =>
        Response.json({
          workflow_runs: [
            {
              id: 1,
              status: "in_progress",
              conclusion: null,
              html_url: "https://github.com/autoactions/tsvc/actions/runs/1",
              display_title: "service:motrix",
            },
            {
              id: 2,
              status: "in_progress",
              conclusion: null,
              html_url: "https://github.com/autoactions/tsvc/actions/runs/2",
              display_title: "service:chrome",
            },
          ],
        }),
      {
        chrome: {
          workflow: "tsvc.yml",
          displayTitle: "service:chrome",
          defaultInputs: { service: "chrome" },
        },
      },
    );

    expect(await github.latestRun("chrome")).toMatchObject({ id: 2 });
    expect(calls[0].url).toContain("tsvc.yml/runs?per_page=30");
  });

  it("stops at the job summary once a Locator Block is present", async () => {
    const { github, calls } = githubWith((call) => {
      if (call.url.endsWith("/jobs")) {
        return Response.json({
          jobs: [{ id: 7, check_run_url: "https://api.github.com/repos/autoactions/debug-session/check-runs/9" }],
        });
      }
      if (call.url.includes("/check-runs/9")) {
        return Response.json({
          output: { summary: "## Locators\n- Session Address: https://ready.trycloudflare.com\n" },
        });
      }
      return new Response("unused", { status: 200 });
    });

    expect(await github.jobOutput?.("linux", 88)).toContain("## Locators");
    expect(calls.map((call) => call.url)).toEqual([
      "https://api.github.com/repos/autoactions/debug-session/actions/runs/88/jobs",
      "https://api.github.com/repos/autoactions/debug-session/check-runs/9",
    ]);
  });
});
