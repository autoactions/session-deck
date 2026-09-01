import { describe, expect, it } from "vitest";
import { clearDiscoveryCache, discoverTargets } from "../src/discover.ts";
import type { GitHubRepoAccess } from "../src/github.ts";

const linux = `name: Debug Session - Linux
on:
  workflow_dispatch:
    inputs:
      access_profile:
        type: choice
        options: [mini, full]
        default: mini
jobs:
  tsrv:
    env:
      TAILSCALE_HOSTNAME: tsrv-linux
`;

const tsvc = `name: tsvc
run-name: service:\${{ inputs.service }}
on:
  workflow_dispatch:
    inputs:
      service:
        type: choice
        options: [chrome, motrix, openlist]
`;

function access(repo: string, files: Record<string, string>): GitHubRepoAccess {
  return {
    repo,
    async listWorkflows() {
      return Object.keys(files).map((path) => ({ path, name: path, state: "active" }));
    },
    async readFile(path) {
      return files[path] ?? null;
    },
  };
}

describe("discoverTargets", () => {
  it("discovers linux and tsvc targets from listed repos without a hardcoded catalog", async () => {
    clearDiscoveryCache();
    const files: Record<string, Record<string, string>> = {
      "autoactions/tsrv": { ".github/workflows/linux.yml": linux },
      "autoactions/tsvc": { ".github/workflows/tsvc.yml": tsvc },
    };
    const targets = await discoverTargets(Object.keys(files), (repo) => access(repo, files[repo]));
    expect(targets.map((target) => target.id)).toEqual([
      "tsrv/linux",
      "tsvc/chrome",
      "tsvc/motrix",
      "tsvc/openlist",
    ]);
  });

  it("reuses the catalog within the discovery TTL", async () => {
    clearDiscoveryCache();
    let lists = 0;
    const listed = await discoverTargets(["autoactions/tsrv"], (repo) => {
      const client = access(repo, { ".github/workflows/linux.yml": linux });
      return {
        ...client,
        async listWorkflows() {
          lists += 1;
          return client.listWorkflows();
        },
      };
    });
    const cached = await discoverTargets(["autoactions/tsrv"], () => {
      throw new Error("discovery cache missed");
    });
    expect(lists).toBe(1);
    expect(cached.map((target) => target.id)).toEqual(listed.map((target) => target.id));
  });
});
