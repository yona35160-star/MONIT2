# QA-REPORT — TAXIPRO/MONIT2 (Wave Mongo live smoke)

**Date:** 2026-09-15 21:49 Asia/Jerusalem  
**Machine:** DESKTOP-54EVA7N (C:\Users\Pc\MONIT2-sync)  
**Env:** Mongo Atlas (server/.env), API `http://localhost:4000`, `VITE_WEBAPP_URL=http://localhost:4000`  
**Stub:** `admin@taxi.co.il` / `123456`

## Results

| # | Check | Result | Notes |
|---|--------|--------|-------|
| 1 | `GET /health` | **PASS** | `{"ok":true,"service":"taxipro-api","mongo":true,"port":4000}` |
| 2 | `loginAdmin` API | **PASS** | Token issued; wrong password rejected |
| 3 | Login UI → Control Center | **PASS** | GAS field empty; login → `#/dashboard`; no crash / pageerrors |
| 4 | Basic ride order | **PASS** | API `createOrder` → `TAXI-1002` (UI order flow not fully exercised; API path OK) |
| 5 | No secrets in logs/Git | **PASS** | `.env` / `server/.env` / `bridge/.env` gitignored & untracked; no credential dumps in scanned logs |

## UI extras
- Ride app `:5273/app.html` role picker: **PASS** (נוסע / נהג)

## Screenshots
- `qa-screenshots/noma-login.png`
- `qa-screenshots/noma-dashboard.png`
- `qa-screenshots/noma-app.png`

## Blocking bugs
None found in this smoke.

## Notes for PM
- Started `dev:ops` (:5275) and `dev:app` (:5273) for the run (were down).
- Local Mongo `:27017` closed — Atlas via `MONGODB_URI` is what `/health` used (`mongo:true`).

## Follow-up (dashboard settle)
- After wait: dashboard **fully loaded** (נהגים בזמן אמת / הזמנות פעילות / לוח בקרה). First screenshot was mid-spinner only.
- Non-blocking console noise: `ERR_CONNECTION_REFUSED` (likely Firebase/bridge) + script MIME `text/html` — P3, not smoke-blocking.
- Screenshot: `qa-screenshots/noma-dashboard-final.png`
