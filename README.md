# Session Deck

Cloudflare Worker that opens and closes GitHub-hosted session Targets. Attach a session project by naming its GitHub repository here; the Catalog in this repo lists what can be started. The page and API are the switch; GitHub-hosted jobs are still the machines.

## Setup

```bash
cp .dev.vars.example .dev.vars
```

Set `SESSION_PASSWORD` and `GITHUB_TOKEN`. The Session Password is the shared secret for the page and API and must match the GitHub Secret used by every attached session project; those projects use it to encrypt operator-facing Sensitive Facts, and this Worker uses the same value to authorize the protected API and decrypt those facts. `GITHUB_TOKEN` is a PAT that can read workflows, dispatch, and cancel on every repo in `GITHUB_REPO`. `GITHUB_REPO` is a comma-separated `owner/repo` list. The Worker lists each repo's active `workflow_dispatch` workflows and shows those as Targets. `GITHUB_REF` is optional and defaults to `main`. Workflows that set `TAILSCALE_HOSTNAME` use the GitHub run as their Observer; other workflows wait for a published Locator Block.

A later session project attaches the same way: add its `owner/repo` to `GITHUB_REPO`. Session repos do not implement a plugin. Any extra `workflow_dispatch` workflow in those repos will appear on the page.

```bash
npm install
npm test
npx wrangler dev
```

```bash
npx wrangler secret put SESSION_PASSWORD
npx wrangler secret put GITHUB_TOKEN
npm run deploy
```

## API

All `/api/*` routes need `Authorization: Bearer <SESSION_PASSWORD>`.

- `GET /api/targets`
- `GET /api/targets/{id}`
- `POST /api/targets/{id}/start` — optional JSON for Debug Session Targets: Linux `{ "access_profile": "mini"|"full", "session_profile": "core"|"developer" }`, Windows `{ "session_profile": "core"|"developer", "enable_wsl": true|false }`
- `POST /api/targets/{id}/stop`

`on` means a Debug Session's GitHub run is in progress, or a Temporary Service Session has published a Locator Block. The panel copies public rows from `## Locators` and decrypts authenticated `enc:v1` rows from `## Sensitive Facts`. Session repos decide the labels; this plane does not keep per-target match rules. Plaintext Sensitive Facts never enter GitHub output.
