import type { Target } from "./catalog.ts";
import type { GitHubRepoAccess } from "./github.ts";
import { targetsFromWorkflow } from "./workflow.ts";

const TTL_MS = 5 * 60_000;

const cache = new Map<string, { at: number; targets: Target[] }>();

export async function discoverTargets(
  repos: string[],
  accessFor: (repo: string) => GitHubRepoAccess,
): Promise<Target[]> {
  const key = repos.join(",");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.targets;
  const targets = (await Promise.all(repos.map((repo) => discoverRepo(accessFor(repo))))).flat();
  cache.set(key, { at: Date.now(), targets });
  return targets;
}

export function clearDiscoveryCache(): void {
  cache.clear();
}

async function discoverRepo(access: GitHubRepoAccess): Promise<Target[]> {
  const listed = await access.listWorkflows();
  const active = listed.filter((workflow) => workflow.state === "active");
  const groups = await Promise.all(
    active.map(async (workflow) => {
      const yaml = await access.readFile(workflow.path);
      return yaml ? targetsFromWorkflow(access.repo, workflow.path, yaml) : [];
    }),
  );
  return groups.flat();
}
