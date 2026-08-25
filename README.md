# Debug Session Control

Cloudflare Worker that opens and closes GitHub-hosted session Targets. Attach a session project by naming its GitHub repository here; the Catalog in this repo lists what can be started. The page and API are the switch; GitHub-hosted jobs are still the machines.

## Setup

```bash
cp .dev.vars.example .dev.vars
```

Set `ADMIN_TOKEN` (shared secret for the page and API) and `GITHUB_TOKEN` (a PAT that can read workflows, dispatch, and cancel on every repo in `GITHUB_REPO`). `GITHUB_REPO` is a comma-separated `owner/repo` list. The Worker lists each repo's active `workflow_dispatch` workflows and shows those as Targets. `GITHUB_REF` is optional and defaults to `main`. The Tailscale OAuth client (`TAILSCALE_OAUTH_CLIENT_ID` / `TAILSCALE_OAUTH_CLIENT_SECRET`, `devices:core`) is the Observer when a workflow sets `TAILSCALE_HOSTNAME`. Without it, those Targets fall back to “GitHub run in progress.”

A later session project attaches the same way: add its `owner/repo` to `GITHUB_REPO`. Session repos do not implement a plugin. Any extra `workflow_dispatch` workflow in those repos will appear on the page.

```bash
npm install
npm test
npx wrangler dev
```

```bash
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put TAILSCALE_OAUTH_CLIENT_ID
npx wrangler secret put TAILSCALE_OAUTH_CLIENT_SECRET
npm run deploy
```

## API

All `/api/*` routes need `Authorization: Bearer <ADMIN_TOKEN>`.

- `GET /api/targets`
- `GET /api/targets/{id}`
- `POST /api/targets/{id}/start` — optional JSON for Debug Session Targets: Linux `{ "access_profile": "mini"|"full", "session_profile": "core"|"developer" }`, Windows `{ "session_profile": "core"|"developer", "enable_wsl": true|false }`
- `POST /api/targets/{id}/stop`

`on` means the Target's Observer found a live Locator (Tailscale Join, or a published Locator Block). After ready, the panel copies labeled rows from the session job's `## Locators` block. Session repos decide the labels; this plane does not keep per-target match rules. Secrets stay in the session repo.
