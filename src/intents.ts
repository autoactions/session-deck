import type { SlotId } from "./github.ts";

export type AccessProfile = "mini" | "full";

export type SlotIntents = {
  markStarting(slot: SlotId): void;
  markStopping(runId: number): void;
  isStarting(slot: SlotId): boolean;
  isStopping(runId: number): boolean;
  clearStarting(slot: SlotId): void;
  rememberAccess(slot: SlotId, access: AccessProfile): void;
  accessFor(slot: SlotId): AccessProfile | null;
  forgetAccess(slot: SlotId): void;
};

export function memorySlotIntents(): SlotIntents {
  const starting = new Set<SlotId>();
  const stopping = new Set<number>();
  const access = new Map<SlotId, AccessProfile>();
  return {
    markStarting(slot) {
      starting.add(slot);
    },
    markStopping(runId) {
      stopping.add(runId);
    },
    isStarting(slot) {
      return starting.has(slot);
    },
    isStopping(runId) {
      return stopping.has(runId);
    },
    clearStarting(slot) {
      starting.delete(slot);
    },
    rememberAccess(slot, profile) {
      access.set(slot, profile);
    },
    accessFor(slot) {
      return access.get(slot) ?? null;
    },
    forgetAccess(slot) {
      access.delete(slot);
    },
  };
}
