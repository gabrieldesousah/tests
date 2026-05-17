# AGENTS.md

## Cursor Cloud specific instructions

This is a **WhatsApp Embedded Signup + Partner-Led Business Verification (PLBV)** starter app. Single Node.js/Express server serving a vanilla HTML/CSS/JS frontend.

### Project layout

- `whatsapp-plbv-starter/` — the entire application
  - `server/index.js` — Express server (all routes)
  - `public/` — static frontend (no build step)
  - `.env` — runtime config (not committed; copy from `.env.example`)

### Running the dev server

```bash
cd whatsapp-plbv-starter
npm run dev          # uses node --watch for auto-reload
```

Server listens on `http://localhost:3000`. The frontend is served as static files from `public/`.

### Key endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Health check (works without credentials) |
| `GET /api/config` | Returns app config (needs `META_APP_ID`, `META_EMBEDDED_SIGNUP_CONFIG_ID`) |
| `POST /api/exchange-code` | Exchanges OAuth code for token (needs `META_APP_ID`, `META_APP_SECRET`) |
| `GET /api/waba/:id` | Fetches WABA info using client token |
| `POST /api/plbv/submit` | Submits PLBV docs (needs `PARTNER_*` env vars) |
| `GET /webhook` | Meta webhook verification |
| `POST /webhook` | Meta webhook event receiver |

### Important notes

- No database, no Docker, no build step required.
- All Meta Graph API calls require real credentials in `.env`. With placeholder values, the server starts and serves the frontend but API calls to Meta will fail with OAuthException errors — this is expected.
- The `.env` file must exist before starting the server (copy from `.env.example`).
- No lint or test scripts are defined in `package.json`. The project has no automated tests.
- `node --watch` (used by `npm run dev`) restarts the server on file changes to `server/index.js`.
