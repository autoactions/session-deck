import { createGitHubActions } from "./github.ts";
import { createWorker } from "./worker.ts";

export type Env = {
  ADMIN_TOKEN: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  GITHUB_REF: string;
};

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return createWorker({
      adminToken: env.ADMIN_TOKEN,
      github: createGitHubActions({
        token: env.GITHUB_TOKEN,
        repo: env.GITHUB_REPO,
        ref: env.GITHUB_REF,
      }),
    })(request);
  },
};
