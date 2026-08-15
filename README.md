# Debug Session Control

Cloudflare Worker that opens and closes Debug Sessions in [autoactions/debug-session](https://github.com/autoactions/debug-session). The page and API are the switch; GitHub-hosted runners are still the machines.

## Setup

```bash
cp .dev.vars.example .dev.vars
```

Set `ADMIN_TOKEN` (shared secret for the page and API) and `GITHUB_TOKEN` (a PAT that can dispatch and cancel workflows on `autoactions/debug-session`).

```bash
npm install
npm test
npx wrangler dev
```

```bash
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put GITHUB_TOKEN
npm run deploy
```

## API

All `/api/*` routes need `Authorization: Bearer <ADMIN_TOKEN>`.

- `GET /api/slots`
- `GET /api/slots/{linux|windows}`
- `POST /api/slots/{linux|windows}/start`
- `POST /api/slots/{linux|windows}/stop`
