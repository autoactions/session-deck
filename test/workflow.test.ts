import { describe, expect, it } from "vitest";
import { targetsFromWorkflow } from "../src/workflow.ts";

const linux = `name: Debug Session - Linux
on:
  workflow_dispatch:
    inputs:
      access_profile:
        type: choice
        options:
          - mini
          - full
        default: mini
      session_profile:
        type: choice
        options:
          - core
          - developer
        default: developer
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
        options:
          - chrome
          - motrix
          - openlist
`;

const ci = `name: CI
on:
  push:
    branches: [main]
`;

describe("targetsFromWorkflow", () => {
  it("maps a Tailscale workflow to a GitHub run observer", () => {
    expect(targetsFromWorkflow("autoactions/tsrv", ".github/workflows/linux.yml", linux)).toEqual([
      expect.objectContaining({
        id: "tsrv/linux",
        label: "Linux",
        repo: "autoactions/tsrv",
        workflow: "linux.yml",
        ready: { kind: "github-run" },
        defaultInputs: { access_profile: "mini", session_profile: "developer" },
      }),
    ]);
  });

  it("expands a run-name choice into one target per option", () => {
    const targets = targetsFromWorkflow("autoactions/tsvc", ".github/workflows/tsvc.yml", tsvc);
    expect(targets.map((target) => target.id)).toEqual(["tsvc/chrome", "tsvc/motrix", "tsvc/openlist"]);
    expect(targets[0]).toMatchObject({
      label: "Chrome",
      displayTitle: "service:chrome",
      defaultInputs: { service: "chrome" },
      inputs: [],
      ready: { kind: "github-output" },
    });
  });

  it("titleizes hyphenated and underscored options and stems", () => {
    const custom = `name: tsvc
run-name: service:\${{ inputs.service }}
on:
  workflow_dispatch:
    inputs:
      service:
        type: choice
        options:
          - code-server
          - test_service
`;
    const targets = targetsFromWorkflow("autoactions/tsvc", ".github/workflows/tsvc.yml", custom);
    expect(targets.map((target) => target.label)).toEqual(["Code-Server", "Test_Service"]);
  });

  it("ignores workflows without workflow_dispatch", () => {
    expect(targetsFromWorkflow("autoactions/tsvc", ".github/workflows/ci.yml", ci)).toEqual([]);
  });
});
