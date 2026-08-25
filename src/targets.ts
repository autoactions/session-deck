import type { InputSpec, Target } from "./catalog.ts";
import type { GitHubActions, WorkflowRun } from "./github.ts";
import type { TargetIntents } from "./intents.ts";
import { parseLocatorBlock, type LocatorFact } from "./locators.ts";

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

async function locatorsFrom(target: Target, run: WorkflowRun | null, github: GitHubActions): Promise<LocatorFact[]> {
  if (!run || isPending(run) || run.status === "completed") return [];
  try {
    return parseLocatorBlock((await github.jobOutput?.(target.id, run.id)) ?? "");
  } catch {
    return [];
  }
}

export async function readyStatus(
  target: Target,
  run: WorkflowRun | null,
  github: GitHubActions,
): Promise<Observed> {
  const facts = await locatorsFrom(target, run, github);
  if (target.ready.kind === "github-run") {
    return { ready: true, facts };
  }
  if (!run || isPending(run) || run.status === "completed") {
    return { ready: false, facts: [] };
  }
  return { ready: facts.length > 0, facts };
}

export async function listTargets(
  catalog: Target[],
  github: GitHubActions,
  intents?: TargetIntents,
): Promise<TargetView[]> {
  return Promise.all(
    catalog.map(async (target) => {
      const run = await github.latestRun(target.id);
      return viewTarget(target, run, intents, await readyStatus(target, run, github));
    }),
  );
}
