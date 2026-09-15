# DEPLOY — TAXIPRO / MONIT2 (Wave Unify)

**2 frontends only** + WhatsApp Bridge on Render.

## A) Frontend — 2 Vercel projects (same repo)

| Vercel project | Build Command | Output | Open |
|----------------|---------------|--------|------|
| taxipro-ops | `npm run build:ops` | `dist` | `/admin.html` (Ops Center) |
| taxipro-app | `npm run build:app` | `dist` | `/app.html` (Ride App + role picker) |

Env: copy from `.env.example` into each project (Production + Preview). After first deploy set:
- `VITE_OPS_SITE_URL`
- `VITE_APP_SITE_URL`
then Redeploy.

SPA rewrite: `/(.*) → /index.html` (see `vercel.json`).

## B) Bridge — Render

Use `bridge/render.yaml`. Secrets only in Dashboard. Health: `GET /health`.

## C) Local one-click

```bat
SETUP.bat
```

Does: `npm i` (root+bridge), copies env templates if missing, starts **Ops + Ride App** (no prompts).

```bat
START-ALL.bat
```

Starts the 2 screens (calls `SETUP.bat` if `node_modules` is missing).

```bat
SETUP-BRIDGE.bat
```

WhatsApp bridge separately (new bot / QR).

## D) Security

Never commit `.env` / `bridge/.env`. Templates only: `.env.example`, `bridge/.env.example`.
