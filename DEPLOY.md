# DEPLOY — TAXIPRO / MONIT2

Frontend על **Vercel** (או Netlify). WhatsApp Bridge על **Render** בלבד (לא Vercel).

## A) Frontend — 3 פרויקטי Vercel (אותו ריפו)

| פרויקט Vercel | Root Directory | Build Command | Output | Framework |
|---------------|----------------|---------------|--------|-----------|
| taxipro-passenger | `.` | `npm run build:passenger` | `dist` | Vite |
| taxipro-driver | `.` | `npm run build:driver` | `dist` | Vite |
| taxipro-admin | `.` | `npm run build:admin` | `dist` | Vite |

### Environment Variables (בכל 3 הפרויקטים)
העתיקו מ-`.env.example` ללוח Vercel (Production + Preview):
- כל `VITE_FIREBASE_*`
- `VITE_WEBAPP_URL`
- `VITE_GEMINI_API_KEY` (אופציונלי; בעיקר Admin)
- `VITE_TELEGRAM_*` (אופציונלי)
- `VITE_WHATSAPP_BRIDGE_URL` / `VITE_BRIDGE_API_KEY` / `VITE_WHATSAPP_RENDER_URL`
- אחרי deploy ראשון: `VITE_SITE_URL`, `VITE_DRIVER_SITE_URL`, `VITE_ADMIN_SITE_URL` → Redeploy

### SPA rewrites
בכל פרויקט Vercel → Settings → Rewrites: `/(.*) → /index.html` (או קובץ `vercel.json` per-project אם תרצו).  
הערה: כל mode בונה entry HTML שונה (`passenger.html` / `driver.html` / `admin.html`) — ודאו שה-Output כולל את קובץ ה-HTML הנכון מ-Vite.

### חלופה
קיים `netlify.toml` — אפשר Netlify באותה חלוקה ל-3 אתרים.

## B) WhatsApp Bridge — Render

קובץ מוכן: `bridge/render.yaml`

1. Render → New → Blueprint → בחרו את הריפו, root `bridge/` או ייבוא ה-yaml
2. מלאו secrets ב-Dashboard (לא בריפו):
   - `BRIDGE_API_KEY`
   - `GAS_SCRIPT_URL`
   - `MONGODB_URI` (מומלץ ל-sessions)
   - `CORS_ORIGINS` (דומייני Vercel/GAS)
   - `RENDER_URL` (URL של השירות עצמו ל-self-ping)
3. Health: `GET /health`
4. Free tier נרדם — cron `keep-alive-ping` ב-yaml + UptimeRobot מומלץ

## C) CI קיים

`.github/workflows/deploy.yml`:
- `npm ci` + `npm run build` על push
- GAS via clasp (דורש `CLASP_TOKEN`)
- Firebase Hosting (אופציונלי, דורש `FIREBASE_SERVICE_ACCOUNT`)

מומלץ להוסיף שלב `npm run typecheck` לפני build (Wave 1: typecheck מקומי עבר).

## D) אבטחה
- לא לדחוף `.env` / `.env.local`
- רק `.env.example` ו-`bridge/.env.example` בריפו
- מחכים לחיבור GitHub מלא לפני דחיפה גדולה

## E) בדיקות מקומיות (בוצעו Wave 1)
- `npm install` (root) ✅
- `cd bridge && npm install` ✅
- `npm run typecheck` ✅
