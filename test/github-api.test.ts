import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { createGitHubActions } from "../src/github.ts";
import { decryptSensitiveFacts } from "../src/sensitive-facts.ts";

type Call = { url: string; method: string; body: unknown; headers: Headers };

const debugTargets = {
  "tsrv/linux": { workflow: "linux.yml", defaultInputs: { access_profile: "mini", session_profile: "developer" } },
  "tsrv/windows": { workflow: "windows.yml", defaultInputs: { session_profile: "developer", enable_wsl: "false" } },
};

const encryptedPassword = "enc:v2:AQIDBAUGBwgJCgsMDQ4PEA:ERITFBUWFxgZGhsc:Shap0xyfNasoDIc5tPqGpuH_Muzis2PBzP3gu_A";
const locatorDocument = `## Locators\n- SSH: runner@100.64.0.10\n\n## Sensitive Facts\n- Session Password: ${encryptedPassword}\n`;

function githubWith(
  handler: (call: Call) => Response | Promise<Response>,
  targets: Record<string, { workflow: string; displayTitle?: string; defaultInputs?: Record<string, string> }> = debugTargets,
) {
  const calls: Call[] = [];
  const github = createGitHubActions({
    token: "gh-token",
    repo: "autoactions/tsrv",
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
  it("reads a run-scoped Locator Artifact before a live job exposes output or logs", async () => {
    const archive = zipSync({
      "session-deck-output.md": strToU8(locatorDocument),
    });
    const { github, calls } = githubWith((call) => {
      if (call.url.endsWith("/actions/runs/88/artifacts?name=session-deck-locators&per_page=100")) {
        return Response.json({
          artifacts: [
            {
              id: 501,
              name: "session-deck-locators",
              expired: false,
              size_in_bytes: archive.byteLength,
              workflow_run: { id: 88 },
            },
          ],
        });
      }
      if (call.url.endsWith("/actions/artifacts/501/zip")) {
        if (call.headers.get("accept") !== "application/vnd.github+json") {
          return Response.json(
            { message: "Unsupported 'Accept' header", status: "415" },
            { status: 415 },
          );
        }
        return new Response(archive, { headers: { "content-length": String(archive.byteLength) } });
      }
      if (call.url.endsWith("/jobs")) {
        return Response.json({ jobs: [{ id: 7 }] });
      }
      if (call.url.endsWith("/actions/jobs/7/logs")) {
        return new Response("not available", { status: 404 });
      }
      return new Response("unexpected request", { status: 500 });
    });

    const output = await github.observerOutput?.("tsrv/linux", 88);
    expect(output).toContain("- SSH: runner@100.64.0.10");
    await expect(decryptSensitiveFacts(output ?? "", "shared-session-password")).resolves.toMatchObject({
      valid: true,
      facts: [{ label: "Session Password", value: "private-value" }],
    });
    expect(calls.map((call) => call.url)).toEqual([
      "https://api.github.com/repos/autoactions/tsrv/actions/runs/88/artifacts?name=session-deck-locators&per_page=100",
      "https://api.github.com/repos/autoactions/tsrv/actions/artifacts/501/zip",
    ]);
  });

  it("reads a Locator Artifact after GitHub redirects to a signed URL that rejects GitHub credentials", async () => {
    const archive = zipSync({
      "session-deck-output.md": strToU8(locatorDocument),
    });
    const signedUrl = "https://productionresultssa16.blob.core.windows.net/actions-results/run/artifact.zip?sig=1";
    const { github, calls } = githubWith((call) => {
      if (call.url.endsWith("/actions/runs/88/artifacts?name=session-deck-locators&per_page=100")) {
        return Response.json({
          artifacts: [
            {
              id: 501,
              name: "session-deck-locators",
              expired: false,
              size_in_bytes: archive.byteLength,
              workflow_run: { id: 88 },
            },
          ],
        });
      }
      if (call.url.endsWith("/actions/artifacts/501/zip")) {
        return new Response(null, {
          status: 302,
          headers: { Location: signedUrl },
        });
      }
      if (call.url === signedUrl) {
        if (call.headers.has("authorization")) {
          return new Response(
            "<Error><Code>InvalidAuthenticationInfo</Code></Error>",
            { status: 401 },
          );
        }
        return new Response(archive, { headers: { "content-length": String(archive.byteLength) } });
      }
      return new Response("unexpected request", { status: 500 });
    });

    const output = await github.observerOutput?.("tsrv/linux", 88);
    expect(output).toContain("- SSH: runner@100.64.0.10");
    expect(calls.map((call) => call.url)).toEqual([
      "https://api.github.com/repos/autoactions/tsrv/actions/runs/88/artifacts?name=session-deck-locators&per_page=100",
      "https://api.github.com/repos/autoactions/tsrv/actions/artifacts/501/zip",
      signedUrl,
    ]);
    expect(calls[1]?.headers.has("authorization")).toBe(true);
    expect(calls[2]?.headers.has("authorization")).toBe(false);
  });

  it("reads a Locator Artifact that contains only public Locators", async () => {
    const document = "## Locators\n- Session Address: https://session-test.trycloudflare.com\n";
    const archive = zipSync({
      "session-deck-output.md": strToU8(document),
    });
    const { github } = githubWith((call) => {
      if (call.url.includes("/actions/runs/88/artifacts?")) {
        return Response.json({
          artifacts: [{
            id: 501,
            name: "session-deck-locators",
            expired: false,
            size_in_bytes: archive.byteLength,
            workflow_run: { id: 88 },
          }],
        });
      }
      if (call.url.endsWith("/actions/artifacts/501/zip")) return new Response(archive);
      return new Response("unexpected request", { status: 500 });
    }, {
      "tsvc/chrome": { workflow: "tsvc.yml", displayTitle: "service:chrome", defaultInputs: { service: "chrome" } },
    });

    await expect(github.observerOutput?.("tsvc/chrome", 88)).resolves.toBe(document);
  });

  it.each([
    ["expired", { expired: true }],
    ["wrongly named", { name: "other" }],
    ["owned by another run", { workflow_run: { id: 89 } }],
    ["over the archive limit", { size_in_bytes: 65 * 1024 }],
  ])("rejects a %s Locator Artifact without reading legacy output", async (_label, override) => {
    const { github, calls } = githubWith((call) => {
      if (call.url.includes("/actions/runs/88/artifacts?")) {
        return Response.json({
          artifacts: [{
            id: 501,
            name: "session-deck-locators",
            expired: false,
            size_in_bytes: 200,
            workflow_run: { id: 88 },
            ...override,
          }],
        });
      }
      return new Response("legacy output must not be read", { status: 500 });
    });

    await expect(github.observerOutput?.("tsrv/linux", 88)).resolves.toBeNull();
    expect(calls).toHaveLength(1);
  });

  it.each([
    ["damaged ZIP", strToU8("not a zip")],
    ["wrong filename", zipSync({ "other.md": strToU8(locatorDocument) })],
    ["extra file", zipSync({
      "session-deck-output.md": strToU8(locatorDocument),
      "extra.txt": strToU8("unexpected"),
    })],
    ["invalid document", zipSync({
      "session-deck-output.md": strToU8("## Locators\n- SSH: runner@100.64.0.10\n\n## Sensitive Facts\n- Session Password: plaintext\n"),
    })],
    ["oversized document", zipSync({
      "session-deck-output.md": strToU8(`## Locators\n- SSH: ${"x".repeat(17 * 1024)}\n\n## Sensitive Facts\n- Session Password: ${encryptedPassword}\n`),
    })],
  ])("rejects a Locator Artifact with %s", async (_label, archive) => {
    const { github } = githubWith((call) => {
      if (call.url.includes("/actions/runs/88/artifacts?")) {
        return Response.json({
          artifacts: [{
            id: 501,
            name: "session-deck-locators",
            expired: false,
            size_in_bytes: archive.byteLength,
            workflow_run: { id: 88 },
          }],
        });
      }
      if (call.url.endsWith("/actions/artifacts/501/zip")) return new Response(archive);
      return new Response("unexpected request", { status: 500 });
    });

    await expect(github.observerOutput?.("tsrv/linux", 88)).resolves.toBeNull();
  });

  it("reads the latest linux workflow run", async () => {
    const { github, calls } = githubWith(() =>
      Response.json({
        workflow_runs: [
          {
            id: 88,
            status: "in_progress",
            conclusion: null,
            html_url: "https://github.com/autoactions/tsrv/actions/runs/88",
            run_started_at: "2026-08-18T10:00:00Z",
            actor: { login: "octo" },
          },
        ],
      }),
    );

    expect(await github.latestRun("tsrv/linux")).toEqual({
      id: 88,
      status: "in_progress",
      conclusion: null,
      htmlUrl: "https://github.com/autoactions/tsrv/actions/runs/88",
      startedAt: "2026-08-18T10:00:00Z",
      openedBy: "octo",
    });
    expect(calls[0]).toMatchObject({
      method: "GET",
      url: "https://api.github.com/repos/autoactions/tsrv/actions/workflows/linux.yml/runs?per_page=1",
    });
    expect(calls[0].headers.get("Authorization")).toBe("Bearer gh-token");
  });

  it("dispatches linux with the default access and session profiles", async () => {
    const { github, calls } = githubWith(() => new Response(null, { status: 204 }));
    await github.dispatch("tsrv/linux");
    expect(calls[0]).toMatchObject({
      method: "POST",
      url: "https://api.github.com/repos/autoactions/tsrv/actions/workflows/linux.yml/dispatches",
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
    await github.dispatch("tsrv/windows");
    expect(calls[0]).toMatchObject({
      method: "POST",
      url: "https://api.github.com/repos/autoactions/tsrv/actions/workflows/windows.yml/dispatches",
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
    await github.dispatch("tsrv/linux", { access_profile: "full", session_profile: "core" });
    expect(calls[0].body).toEqual({
      ref: "main",
      inputs: { access_profile: "full", session_profile: "core" },
    });
  });

  it("cancels a workflow run", async () => {
    const { github, calls } = githubWith(() => new Response(null, { status: 202 }));
    await github.cancel("tsrv/linux", 99);
    expect(calls[0]).toMatchObject({
      method: "POST",
      url: "https://api.github.com/repos/autoactions/tsrv/actions/runs/99/cancel",
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
      if (call.url.includes("/actions/runs/88/artifacts?")) {
        return Response.json({ artifacts: [] });
      }
      if (call.url.endsWith("/jobs")) {
        return Response.json({
          jobs: [{ id: 7, check_run_url: "https://api.github.com/repos/autoactions/tsrv/check-runs/9" }],
        });
      }
      if (call.url.includes("/check-runs/9")) {
        return Response.json({
          output: { summary: "## Locators\n- Session Address: https://ready.trycloudflare.com\n" },
        });
      }
      return new Response("unused", { status: 200 });
    });

    expect(await github.observerOutput?.("tsrv/linux", 88)).toContain("## Locators");
    expect(calls.map((call) => call.url)).toEqual([
      "https://api.github.com/repos/autoactions/tsrv/actions/runs/88/artifacts?name=session-deck-locators&per_page=100",
      "https://api.github.com/repos/autoactions/tsrv/actions/runs/88/jobs",
      "https://api.github.com/repos/autoactions/tsrv/check-runs/9",
    ]);
  });
});
