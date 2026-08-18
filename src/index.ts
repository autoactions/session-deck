import { createGitHubActions } from "./github.ts";
import { createTailscale } from "./tailscale.ts";
import { createWorker } from "./worker.ts";

export type Env = {
  ADMIN_TOKEN: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  GITHUB_REF: string;
  TAILSCALE_OAUTH_CLIENT_ID?: string;
  TAILSCALE_OAUTH_CLIENT_SECRET?: string;
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
