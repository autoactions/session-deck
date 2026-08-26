import type { Target } from "../src/catalog.ts";

const RUN_ON = "on = GitHub run is in progress";
const ADDRESS_ON = "on = Locator Block is published";

export const linuxTarget: Target = {
  id: "tsrv/linux",
  label: "Linux",
  repo: "autoactions/tsrv",
  workflow: "linux.yml",
  defaultInputs: { access_profile: "mini", session_profile: "developer" },
  inputs: [
    { name: "access_profile", type: "choice", options: ["mini", "full"], default: "mini" },
    { name: "session_profile", type: "choice", options: ["core", "developer"], default: "developer" },
  ],
  ready: { kind: "github-run" },
  onCaption: RUN_ON,
};

export const windowsTarget: Target = {
  id: "tsrv/windows",
  label: "Windows",
  repo: "autoactions/tsrv",
  workflow: "windows.yml",
  defaultInputs: { session_profile: "developer", enable_wsl: "false" },
  inputs: [
    { name: "session_profile", type: "choice", options: ["core", "developer"], default: "developer" },
    { name: "enable_wsl", type: "boolean", default: "false" },
  ],
  ready: { kind: "github-run" },
  onCaption: RUN_ON,
};

export const chromeTarget: Target = {
  id: "chrome",
  label: "Chrome",
  repo: "autoactions/tsvc",
  workflow: "tsvc.yml",
  displayTitle: "service:chrome",
  defaultInputs: { service: "chrome" },
  inputs: [],
  ready: { kind: "github-output" },
  onCaption: ADDRESS_ON,
};

export const motrixTarget: Target = { ...chromeTarget, id: "motrix", label: "Motrix", displayTitle: "service:motrix", defaultInputs: { service: "motrix" } };
export const openlistTarget: Target = { ...chromeTarget, id: "openlist", label: "OpenList", displayTitle: "service:openlist", defaultInputs: { service: "openlist" } };

export const DEBUG_CATALOG: Target[] = [linuxTarget, windowsTarget];
export const SERVICE_CATALOG: Target[] = [chromeTarget, motrixTarget, openlistTarget];
