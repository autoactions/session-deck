export type DispatchInputs = Record<string, string>;

export type InputSpec = {
  name: string;
  type: "choice" | "boolean" | "string";
  options?: string[];
  default?: string;
};

export type Target = {
  id: string;
  label: string;
  repo: string;
  workflow: string;
  displayTitle?: string;
  defaultInputs: DispatchInputs;
  inputs: InputSpec[];
  ready: { kind: "github-run" } | { kind: "github-output" };
  onCaption: string;
};

export function targetById(catalog: Target[], id: string): Target | undefined {
  return catalog.find((target) => target.id === id);
}

export function parseRepoList(value: string | undefined): string[] {
  if (!value) return [];
  const repos: string[] = [];
  const seen = new Set<string>();
  for (const part of value.split(",")) {
    const repo = part.trim();
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) || seen.has(repo)) continue;
    seen.add(repo);
    repos.push(repo);
  }
  return repos;
}

export function githubRef(value: string | undefined): string {
  const ref = value?.trim();
  return ref || "main";
}

export function targetsForRepo(catalog: Target[], repo: string): Target[] {
  return catalog.filter((target) => target.repo === repo);
}

export function githubSpec(target: Target): {
  workflow: string;
  displayTitle?: string;
  defaultInputs: DispatchInputs;
} {
  return {
    workflow: target.workflow,
    displayTitle: target.displayTitle,
    defaultInputs: target.defaultInputs,
  };
}

export function githubTargets(
  catalog: Target[],
  repo: string,
): Record<string, { workflow: string; displayTitle?: string; defaultInputs: DispatchInputs }> {
  return Object.fromEntries(targetsForRepo(catalog, repo).map((target) => [target.id, githubSpec(target)]));
}

export function buildDispatchInputs(
  target: Target,
  raw: unknown,
): { ok: true; inputs: DispatchInputs } | { ok: false; error: string } {
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const inputs: DispatchInputs = { ...target.defaultInputs };
  for (const spec of target.inputs) {
    const value =
      spec.type === "boolean"
        ? (readFlag(body[spec.name]) ?? inputs[spec.name] ?? spec.default ?? "false")
        : (readString(body[spec.name]) ?? inputs[spec.name] ?? spec.default ?? "");
    if (spec.type === "choice" && spec.options && !spec.options.includes(value)) {
      return { ok: false, error: `invalid ${spec.name}` };
    }
    if (spec.type === "boolean" && value !== "true" && value !== "false") {
      return { ok: false, error: `invalid ${spec.name}` };
    }
    inputs[spec.name] = value;
  }
  return { ok: true, inputs };
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readFlag(value: unknown): string | undefined {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  return undefined;
}
