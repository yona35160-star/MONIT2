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

---
## Wave Mongo UI order-flow (Windows) — 2026-09-15 22:10 Asia/Jerusalem

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Bridge health `:3000` | **PASS** | `dispatcher.connected=true` (health sessions.dispatcher) |
| 2 | Control Center Login → UI create order | **PASS** | Login → לוח בקרה → `שדר הזמנה` → API `createOrder` 200 → **TAXI-1004** (QA-UI-FLOW / 0501112299 / תל אביב→ירושלים). Mongo verified. |
| 3 | Ride app role picker | **PASS** | `:5273/app.html` נוסע/נהג מוצגים (מסך נוסע דורש OTP לפני הזמנה מלאה) |
| 4 | ERR_CONNECTION_REFUSED / MIME | **PASS** (P3) | רעש קיים; **לא שובר** נתיב קריטי (login/dashboard/create) |
| 5 | WhatsApp group | **N/A** | אין קבוצת נהגים / JID — לא FAIL לפי PM. הזמנה ל-Mongo = PASS. |

### Order
- **TAXI-1004** — QA-UI-FLOW, 0501112299, תל אביב → ירושלים

### Blocking bugs
- **None**

### Screenshots
- `qa-screenshots/win-login.png`
- `qa-screenshots/win-dashboard.png`
- `qa-screenshots/win-order-form.png`
- `qa-screenshots/win-order-filled.png`
- `qa-screenshots/win-order-toast.png`
- `qa-screenshots/win-ride-picker.png`

---
## Group WA check — 2026-09-15 22:12 Asia/Jerusalem

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Toast | **PASS** | `הזמנה נוצרה ונשלחה לקבוצה וללקוח` |
| 2 | Bridge `POST /new-order` group | **PASS** | `success:true`, `ok:true`, WA msg id returned (JID redacted) |
| 3 | Customer phone notify | **PASS** | second `/new-order` `ok:true` to customer JID |
| 4 | Order | **PASS** | `TAXI-1005` (QA-GROUP-WA / תל אביב→חיפה / ₪130) |

Blocking: **none**
Screenshots: `qa-screenshots/wa-dashboard.png`, `wa-order-form.png`, `wa-toast.png`

---
## DS v2.1 dark/light smoke — 2026-09-15 22:14 Asia/Jerusalem

| App | Dark | Light | ThemeToggle | Crash | Result |
|-----|------|-------|-------------|-------|--------|
| Control Center `:5275` | bg `#0d1117` (GitHub) | bg `#eaeded` (Amazon-ish) | PASS (toggle + reverse) | none | **PASS** |
| Ride `:5273` (after נוסע → RoleShell) | bg `#0d1117` | bg `#eaeded` | PASS | none | **PASS** |

### Notes (non-blocking P2)
- RolePicker landing page has **no** ThemeToggle (import present, unused) — toggle only appears in `RoleShell` after role select. Hardcoded dark gradient on picker.
- No pageerrors.

### Screenshots
- `qa-screenshots/ds-ops-dark.png` / `ds-ops-light.png`
- `qa-screenshots/ds-ride-shell-dark.png` / `ds-ride-shell-light.png`
