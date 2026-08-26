import { githubRef, githubTargets, parseRepoList } from "./catalog.ts";
import { discoverTargets } from "./discover.ts";
import { combineGitHub, createGitHubActions, createGitHubRepoAccess } from "./github.ts";
import { createWorker } from "./worker.ts";

export type Env = {
  GITHUB_TOKEN: string;
  SESSION_PASSWORD: string;
  GITHUB_REPO: string;
  GITHUB_REF?: string;
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
        sessionPassword: env.SESSION_PASSWORD,
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
      sessionPassword: env.SESSION_PASSWORD,
      catalog,
      repos,
      github: combineGitHub(clients),
    })(request);
  },
};
