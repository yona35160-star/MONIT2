# Health Checks & Security Notes — TAXIPRO / MONIT2

Wave 2 DevOps review (local copy `C:\Users\Pc\MONIT2-sync`).

## Bridge — `GET /health`

- File: `bridge/multi-bot.js`
- Auth: **none** (intentional for Render healthCheckPath + keep-alive)
- Response shape:
  ```json
  { "status": "ok", "uptime": 123, "sessions": { "<role>": { "connected": true, "queueDepth": 0 } } }
  ```
- Local smoke: `curl http://localhost:3000/health` after `npm run bridge`
- Render: `healthCheckPath: /health` in `bridge/render.yaml` + cron keep-alive

## Firebase RTDB rules — `database.rules.json`

| Path | Read | Write | Notes |
|------|------|-------|-------|
| `/` | deny | deny | default locked |
| `active_orders` | auth | admin (driver_location: assigned driver/admin) | OK |
| `drivers` / `location` | auth | self or admin | OK |
| `notifications/$driverId` | self/admin | admin | OK |
| `order_messages` | auth | admin only | clients talk via GAS — intentional |
| `dashboard_stats` | auth | admin | OK |
| `system/health` | auth | admin | OK |
| `admin_config` | admin | admin | OK |

**Findings:** no public unauthenticated access. Keep deploying rules only after review. Wave 2: no rule changes required.

## Frontend preview readiness

- Plan: 3× Vercel projects per `DEPLOY.md`
- Blocker for live preview: platform env vars + GitHub push after QA green
- Secrets: `.env` ignored; no `.env` / `.env.local` present on sync copy

## Git push gate

- Remote: `origin` → `https://github.com/yona35160-star/MONIT2.git`
- Do **not** push until QA Wave 1 green (PM gate) unless noma overrides
- Pre-push checklist: `git status` clean of secrets, `npm run typecheck`, prefer `build:all` green
