import type { SlotId, WorkflowRun } from "./github.ts";
import { SLOTS } from "./github.ts";
import type { SlotIntents } from "./intents.ts";
import type { JoinStatus } from "./tailscale.ts";

export type SlotState = "off" | "starting" | "on" | "stopping" | "failed";

export const SESSION_DEADLINE_MINUTES = 330;

export type SlotView = {
  id: SlotId;
  hostname: string;
  state: SlotState;
  runUrl: string | null;
  startedAt: string | null;
  openedBy: string | null;
  ssh: string;
  address: string | null;
};

export function hostnameFor(slot: SlotId): string {
  return slot === "linux" ? "debug-session-linux" : "debug-session-windows";
}

export function sshFor(slot: SlotId): string {
  return slot === "linux" ? "runner@debug-session-linux" : "runneradmin@debug-session-windows";
}

export function stateFromRun(run: WorkflowRun | null, join: JoinStatus["join"] = "unknown"): SlotState {
  if (!run) return "off";
  if (run.status === "queued" || run.status === "waiting" || run.status === "requested" || run.status === "pending") {
    return "starting";
  }
  if (run.status !== "completed") {
    return join === "absent" ? "starting" : "on";
  }
  if (run.conclusion === "failure" || run.conclusion === "timed_out" || run.conclusion === "startup_failure") {
    return "failed";
  }
  return "off";
}

const UNKNOWN_JOIN: JoinStatus = { join: "unknown", address: null };

export function viewSlot(
  id: SlotId,
  run: WorkflowRun | null,
  intents?: SlotIntents,
  net: JoinStatus = UNKNOWN_JOIN,
): SlotView {
  let state = stateFromRun(run, net.join);
  let runUrl = run?.htmlUrl ?? null;
  let startedAt = run?.startedAt ?? null;
  let openedBy = run?.openedBy ?? null;

  if (run && isActive(state) && intents?.isStopping(run.id)) {
    state = "stopping";
  } else if (isActive(state)) {
    intents?.clearStarting(id);
  } else if (intents?.isStarting(id)) {
    state = "starting";
    runUrl = null;
    startedAt = null;
    openedBy = null;
  }

  return {
    id,
    hostname: hostnameFor(id),
    state,
    runUrl,
    startedAt,
    openedBy,
    ssh: sshFor(id),
    address: state === "on" && net.join === "present" ? net.address : null,
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
  tailscale?: { status(hostname: string): Promise<JoinStatus> },
): Promise<SlotView[]> {
  return Promise.all(
    SLOTS.map(async (id) =>
      viewSlot(id, await github.latestRun(id), intents, tailscale ? await tailscale.status(hostnameFor(id)) : undefined),
    ),
  );
}
