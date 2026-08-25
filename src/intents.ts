export type AccessProfile = "mini" | "full";

export type TargetIntents = {
  markStarting(id: string): void;
  markStopping(runId: number): void;
  isStarting(id: string): boolean;
  isStopping(runId: number): boolean;
  clearStarting(id: string): void;
  rememberAccess(id: string, access: AccessProfile): void;
  accessFor(id: string): AccessProfile | null;
  forgetAccess(id: string): void;
};

export function memoryTargetIntents(): TargetIntents {
  const starting = new Set<string>();
  const stopping = new Set<number>();
  const access = new Map<string, AccessProfile>();
  return {
    markStarting(id) {
      starting.add(id);
    },
    markStopping(runId) {
      stopping.add(runId);
    },
    isStarting(id) {
      return starting.has(id);
    },
    isStopping(runId) {
      return stopping.has(runId);
    },
    clearStarting(id) {
      starting.delete(id);
    },
    rememberAccess(id, profile) {
      access.set(id, profile);
    },
    accessFor(id) {
      return access.get(id) ?? null;
    },
    forgetAccess(id) {
      access.delete(id);
    },
  };
}
