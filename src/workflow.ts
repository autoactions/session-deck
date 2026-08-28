import { parse } from "yaml";
import type { DispatchInputs, InputSpec, Target } from "./catalog.ts";

const RUN_ON = "on = GitHub run is in progress";
const ADDRESS_ON = "on = Locator Block is published";
const RUN_NAME = /^([^:]+):\$\{\{\s*inputs\.([A-Za-z_][\w-]*)\s*\}\}$/;
const HOSTNAME = /^\s*TAILSCALE_HOSTNAME:\s*([A-Za-z0-9][A-Za-z0-9._-]*)\s*$/m;

export function targetsFromWorkflow(repo: string, path: string, yamlText: string): Target[] {
  let doc: unknown;
  try {
    doc = parse(yamlText);
  } catch {
    return [];
  }
  const dispatch = dispatchSpec(doc);
  if (!dispatch) return [];

  const filename = path.split("/").pop() || path;
  const stem = filename.replace(/\.(ya?ml)$/i, "");
  const repoName = repo.split("/")[1] || repo;
  const hasHostname = literalHostname(yamlText) !== null;
  const ready = hasHostname
    ? ({ kind: "github-run" } as const)
    : ({ kind: "github-output" } as const);
  const onCaption = hasHostname ? RUN_ON : ADDRESS_ON;
  const inputs = inputSpecs(dispatch);
  const record = doc && typeof doc === "object" ? (doc as Record<string, unknown>) : {};
  const runName = typeof record["run-name"] === "string" ? record["run-name"].trim() : "";
  const expanded = RUN_NAME.exec(runName);
  const expandInput = expanded ? inputs.find((input) => input.name === expanded[2] && input.type === "choice") : undefined;

  if (expanded && expandInput?.options?.length) {
    const rest = inputs.filter((input) => input.name !== expandInput.name);
    return expandInput.options.map((option) => ({
      id: `${repoName}/${option}`,
      label: titleize(option),
      repo,
      workflow: filename,
      displayTitle: `${expanded[1]}:${option}`,
      defaultInputs: { [expandInput.name]: option },
      inputs: rest,
      ready,
      onCaption,
    }));
  }

  return [
    {
      id: `${repoName}/${stem}`,
      label: workflowLabel(record.name, stem),
      repo,
      workflow: filename,
      defaultInputs: defaultsFrom(inputs),
      inputs,
      ready,
      onCaption,
    },
  ];
}

function dispatchSpec(doc: unknown): Record<string, unknown> | null {
  if (!doc || typeof doc !== "object") return null;
  const on = (doc as Record<string, unknown>).on;
  if (on === "workflow_dispatch") return {};
  if (Array.isArray(on) && on.includes("workflow_dispatch")) return {};
  if (!on || typeof on !== "object" || Array.isArray(on)) return null;
  if (!Object.hasOwn(on, "workflow_dispatch")) return null;
  const spec = (on as Record<string, unknown>).workflow_dispatch;
  if (spec == null) return {};
  if (typeof spec === "object" && !Array.isArray(spec)) return spec as Record<string, unknown>;
  return {};
}

function inputSpecs(dispatch: Record<string, unknown>): InputSpec[] {
  const raw = dispatch.inputs;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const specs: InputSpec[] = [];
  for (const [name, value] of Object.entries(raw)) {
    const spec = asInput(name, value);
    if (spec) specs.push(spec);
  }
  return specs;
}

function asInput(name: string, value: unknown): InputSpec | null {
  if (!name) return null;
  const body = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const type = body.type === "boolean" || body.type === "choice" || body.type === "string" ? body.type : "string";
  const options =
    type === "choice" && Array.isArray(body.options)
      ? body.options.filter((option): option is string => typeof option === "string" && option.length > 0)
      : undefined;
  if (type === "choice" && !options?.length) return null;
  const fallback = type === "boolean" ? "false" : (options?.[0] ?? "");
  return {
    name,
    type,
    options,
    default: stringifyDefault(body.default) ?? fallback,
  };
}

function stringifyDefault(value: unknown): string | undefined {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

function defaultsFrom(inputs: InputSpec[]): DispatchInputs {
  return Object.fromEntries(inputs.map((input) => [input.name, input.default ?? ""]));
}

function literalHostname(yamlText: string): string | null {
  const match = yamlText.match(HOSTNAME);
  if (!match || match[1].includes("${{")) return null;
  return match[1];
}

function workflowLabel(name: unknown, stem: string): string {
  if (typeof name === "string" && name.trim()) {
    const parts = name.split(" - ");
    return parts[parts.length - 1]!.trim() || titleize(stem);
  }
  return titleize(stem);
}

function titleize(value: string): string {
  if (!value) return "";
  return value
    .split(/([-_ ])/)
    .map((part) => (part === "-" || part === "_" || part === " " ? part : part.slice(0, 1).toUpperCase() + part.slice(1)))
    .join("");
}
