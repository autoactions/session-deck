import { githubRef, githubTargets, parseRepoList } from "./catalog.ts";
import { discoverTargets } from "./discover.ts";
import { combineGitHub, createGitHubActions, createGitHubRepoAccess } from "./github.ts";
import { createTailscale } from "./tailscale.ts";
import { createWorker } from "./worker.ts";

export type Env = {
  ADMIN_TOKEN: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  GITHUB_REF?: string;
  TAILSCALE_OAUTH_CLIENT_ID?: string;
  TAILSCALE_OAUTH_CLIENT_SECRET?: string;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const repos = parseRepoList(env.GITHUB_REPO);
    const ref = githubRef(env.GITHUB_REF);
    const url = new URL(request.url);
    const pageOnly =
      request.method === "GET" && (url.pathname === "/" || url.pathname === "/assets/mark.svg");
    if (pageOnly) {
      return createWorker({
        adminToken: env.ADMIN_TOKEN,
        repos,
        catalog: [],
        github: combineGitHub([]),
      })(request);
    }

    const catalog = env.GITHUB_TOKEN
      ? await discoverTargets(repos, (repo) =>
          createGitHubRepoAccess({ token: env.GITHUB_TOKEN, repo, ref }),
        )
      : [];
    const clients = env.GITHUB_TOKEN
      ? repos.map((repo) =>
          createGitHubActions({
            token: env.GITHUB_TOKEN,
            repo,
            ref,
            targets: githubTargets(catalog, repo),
          }),
        )
      : [];
    return createWorker({
      adminToken: env.ADMIN_TOKEN,
      catalog,
      repos,
      github: combineGitHub(clients),
      tailscale:
        env.TAILSCALE_OAUTH_CLIENT_ID && env.TAILSCALE_OAUTH_CLIENT_SECRET
          ? createTailscale({
              clientId: env.TAILSCALE_OAUTH_CLIENT_ID,
              clientSecret: env.TAILSCALE_OAUTH_CLIENT_SECRET,
            })
          : undefined,
    })(request);
  },
};
