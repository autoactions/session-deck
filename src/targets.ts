import type { InputSpec, Target } from "./catalog.ts";
import type { GitHubActions, WorkflowRun } from "./github.ts";
import type { TargetIntents } from "./intents.ts";
import { parseLocatorBlock, type LocatorFact } from "./locators.ts";
import { decryptSensitiveFacts } from "./sensitive-facts.ts";

export type TargetState = "off" | "starting" | "on" | "stopping" | "failed";

export const SESSION_DEADLINE_MINUTES = 330;

export type TargetView = {
  id: string;
  label: string;
  repo: string;
  state: TargetState;
  runUrl: string | null;
  startedAt: string | null;
  openedBy: string | null;
  facts: LocatorFact[];
  onCaption: string;
  inputs: InputSpec[];
};

export type Observed = {
  ready: boolean;
  facts: LocatorFact[];
};

const READY: Observed = { ready: true, facts: [] };

export function stateFromRun(run: WorkflowRun | null, ready = true): TargetState {
  if (!run) return "off";
  if (run.status === "queued" || run.status === "waiting" || run.status === "requested" || run.status === "pending") {
    return "starting";
  }
  if (run.status !== "completed") {
    return ready ? "on" : "starting";
  }
  if (run.conclusion === "failure" || run.conclusion === "timed_out" || run.conclusion === "startup_failure") {
    return "failed";
  }
  return "off";
}

export function viewTarget(
  target: Target,
  run: WorkflowRun | null,
  intents?: TargetIntents,
  observed: Observed = READY,
): TargetView {
  let state = stateFromRun(run, observed.ready);
  let runUrl = run?.htmlUrl ?? null;
  let startedAt = run?.startedAt ?? null;
  let openedBy = run?.openedBy ?? null;

  if (run && isActive(state) && intents?.isStopping(run.id)) {
    state = "stopping";
  } else if (isActive(state)) {
    intents?.clearStarting(target.id);
  } else if (intents?.isStarting(target.id)) {
    state = "starting";
    runUrl = null;
    startedAt = null;
    openedBy = null;
  } else {
    intents?.forgetAccess(target.id);
  }

  return {
    id: target.id,
    label: target.label,
    repo: target.repo,
    state,
    runUrl,
    startedAt,
    openedBy,
    facts: state === "on" || state === "stopping" ? observed.facts : [],
    onCaption: target.onCaption,
    inputs: target.inputs,
  };
}

export function isActive(state: TargetState): boolean {
  return state === "starting" || state === "on" || state === "stopping";
}

function isPending(run: WorkflowRun): boolean {
  return run.status === "queued" || run.status === "waiting" || run.status === "requested" || run.status === "pending";
}

async function observedOutput(
  target: Target,
  run: WorkflowRun | null,
  github: GitHubActions,
  sessionPassword: string,
): Promise<{ facts: LocatorFact[]; hasLocators: boolean; sensitiveValid: boolean }> {
  if (!run || isPending(run) || run.status === "completed") {
    return { facts: [], hasLocators: false, sensitiveValid: true };
  }
  try {
    const output = (await github.observerOutput?.(target.id, run.id)) ?? "";
    const locators = parseLocatorBlock(output);
    const sensitive = await decryptSensitiveFacts(output, sessionPassword);
    return {
      facts: [...locators, ...(sensitive.valid ? sensitive.facts : [])],
      hasLocators: locators.length > 0,
      sensitiveValid: sensitive.valid,
    };
  } catch {
    return { facts: [], hasLocators: false, sensitiveValid: false };
  }
}

export async function readyStatus(
  target: Target,
  run: WorkflowRun | null,
  github: GitHubActions,
  sessionPassword = "",
): Promise<Observed> {
  const observed = await observedOutput(target, run, github, sessionPassword);
  if (target.ready.kind === "github-run") {
    return { ready: true, facts: observed.facts };
  }
  if (!run || isPending(run) || run.status === "completed") {
    return { ready: false, facts: [] };
  }
  return { ready: observed.hasLocators && observed.sensitiveValid, facts: observed.facts };
}

export async function listTargets(
  catalog: Target[],
  github: GitHubActions,
  intents?: TargetIntents,
  sessionPassword = "",
): Promise<TargetView[]> {
  return Promise.all(
    catalog.map(async (target) => {
      const run = await github.latestRun(target.id);
      return viewTarget(target, run, intents, await readyStatus(target, run, github, sessionPassword));
    }),
  );
}
