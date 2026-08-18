import { describe, expect, it } from "vitest";
import { createGitHubActions } from "../src/github.ts";

type Call = { url: string; method: string; body: unknown; headers: Headers };

function githubWith(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const github = createGitHubActions({
    token: "gh-token",
    repo: "autoactions/debug-session",
    ref: "main",
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const call: Call = {
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: request.headers.get("content-type")?.includes("json")
          ? await request.json()
          : null,
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
    await github.cancel(99);
    expect(calls[0]).toMatchObject({
      method: "POST",
      url: "https://api.github.com/repos/autoactions/debug-session/actions/runs/99/cancel",
    });
  });
});
