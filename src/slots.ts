import type { SlotId, WorkflowRun } from "./github.ts";
import { SLOTS } from "./github.ts";
import type { SlotIntents } from "./intents.ts";

export type SlotState = "off" | "starting" | "on" | "stopping" | "failed";

export type SlotView = {
  id: SlotId;
  hostname: string;
  state: SlotState;
  runUrl: string | null;
};

export function hostnameFor(slot: SlotId): string {
  return slot === "linux" ? "debug-session-linux" : "debug-session-windows";
}

export function stateFromRun(run: WorkflowRun | null): SlotState {
  if (!run) return "off";
  if (run.status === "queued" || run.status === "waiting" || run.status === "requested" || run.status === "pending") {
    return "starting";
  }
  if (run.status !== "completed") return "on";
  if (run.conclusion === "failure" || run.conclusion === "timed_out" || run.conclusion === "startup_failure") {
    return "failed";
  }
  return "off";
}

export function viewSlot(id: SlotId, run: WorkflowRun | null, intents?: SlotIntents): SlotView {
  let state = stateFromRun(run);
  let runUrl = run?.htmlUrl ?? null;

  if (run && isActive(state) && intents?.isStopping(run.id)) {
    state = "stopping";
  } else if (isActive(state)) {
    intents?.clearStarting(id);
  } else if (intents?.isStarting(id)) {
    state = "starting";
    runUrl = null;
  }

  return {
    id,
    hostname: hostnameFor(id),
    state,
    runUrl,
  };
}

export function isActive(state: SlotState): boolean {
  return state === "starting" || state === "on" || state === "stopping";
}

export async function listSlots(
  github: {
    latestRun(slot: SlotId): Promise<WorkflowRun | null>;
  },
  intents?: SlotIntents,
): Promise<SlotView[]> {
  return Promise.all(SLOTS.map(async (id) => viewSlot(id, await github.latestRun(id), intents)));
}
