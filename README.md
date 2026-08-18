# Debug Session Control

Cloudflare Worker that opens and closes Debug Sessions in [autoactions/debug-session](https://github.com/autoactions/debug-session). The page and API are the switch; GitHub-hosted runners are still the machines.

## Setup

```bash
cp .dev.vars.example .dev.vars
```

Set `ADMIN_TOKEN` (shared secret for the page and API), `GITHUB_TOKEN` (a PAT that can dispatch and cancel workflows on `autoactions/debug-session`), and the Tailscale OAuth client (`TAILSCALE_OAUTH_CLIENT_ID` / `TAILSCALE_OAUTH_CLIENT_SECRET`, `devices:core`) so `on` can mean the reserved hostname is on the tailnet. Without those two, `on` falls back to “GitHub run in progress.”

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

- `GET /api/slots`
- `GET /api/slots/{linux|windows}`
- `POST /api/slots/{linux|windows}/start` — optional JSON: Linux `{ "access_profile": "mini"|"full", "session_profile": "core"|"developer" }`, Windows `{ "session_profile": "core"|"developer", "enable_wsl": true|false }`
- `POST /api/slots/{linux|windows}/stop`
