# TAXIPRO / MONIT2 — מדריך הפעלה (Wave Mongo)

> **מרכז שליטה** + **אפליקציית נסיעה** · **Mongo = מקור האמת** · Firebase Realtime זמני · WhatsApp Bridge  
> Sheets/GAS — deprecated (נספח מעבר בלבד)
>
> **התחלה ממוספרת ל-noma:** [`START.md`](./START.md) · ארכיטקטורה: [`ARCHITECTURE.md`](./ARCHITECTURE.md)

---

## 1. שני המסכים

| מסך | קובץ | פקודה | URL מקומי |
|-----|------|--------|-----------|
| מרכז שליטה (Ops) | `admin.html` | `npm run dev:ops` | http://localhost:5275/admin.html |
| אפליקציית נסיעה | `app.html` | `npm run dev:app` | http://localhost:5273/app.html |

- שיגור: `#/station-order` (גם `#/station`, `#/dispatch`)
- App: בחירת תפקיד · «החלף תפקיד» · `#/passenger` / `#/driver`
- API מקומי: http://localhost:4000 (`VITE_WEBAPP_URL`)

---

## 2. לחיצה אחת (Windows)

### START-MONGO.bat
מפעיל Mongo מקומי (`127.0.0.1:27017` / DB `taxipro`). אם נחסם — UAC / שירות MongoDB כמנהל, או השתמשו ב-Atlas (ראו START.md).

### SETUP.bat
1. מפעיל Mongo (`START-MONGO.bat`)
2. מעתיק תבניות `.env` / `server/.env` / `bridge/.env` אם חסרות
3. `npm install` (root + bridge + `server/` אם קיים)
4. מריץ API על `:4000` כש-`server/` קיים (`npm run dev:api` / `START-API.bat`)
5. מפעיל `dev:ops` + `dev:app` ופותח URLs
6. Health API: http://localhost:4000/health

### START-ALL.bat
הרצה חוזרת של 2 המסכים (או SETUP אם אין `node_modules`).

### SETUP-BRIDGE.bat
WhatsApp Bridge בנפרד — sessions ב-Mongo.

---

## 3. הרצה ידנית

```bash
# Mongo רץ (START-MONGO.bat או Atlas)

copy .env.example .env
copy server\.env.example server\.env
copy bridge\.env.example bridge\.env
# מלאו MONGODB_URI + VITE_WEBAPP_URL=http://localhost:4000 + VITE_FIREBASE_*

npm install
cd bridge && npm install && cd ..
cd server && npm install && npm run dev   # :4000
# או מהשורש: npm run dev:api   / START-API.bat
# טרמינלים נוספים:
npm run dev:ops
npm run dev:app
```

בנייה:

```bash
npm run typecheck
npm run build:unify
```

---

## 4. WhatsApp Bridge

```cmd
SETUP-BRIDGE.bat
```

```bash
npm run bridge
curl http://localhost:3000/health
```

QR: `http://localhost:3000/qr?role=dispatcher&key=YOUR_API_KEY`  
`BRIDGE_API_KEY` ↔ `VITE_BRIDGE_API_KEY` · אותו `MONGODB_URI` כמו ב-server.

---

## 5. תשתית ופריסה

| רכיב | הערה |
|------|------|
| Mongo | מקור האמת — מקומי או Atlas |
| `server/` | Express+Mongo מחליף GAS — פורט 4000 |
| Firebase | זמני ל-Realtime עד Phase 2 |
| Sheets/GAS | בלי פיצ'רים חדשים |
| פרודקשן UI | 2× Vercel — [`DEPLOY.md`](./DEPLOY.md) |

אל תדחפו `.env` / `server/.env` / `bridge/.env`.

---

## 6. פתרון בעיות

| בעיה | מה לעשות |
|------|-----------|
| Mongo לא עולה | `START-MONGO.bat` · UAC · Atlas · או `docker run -d --name taxipro-mongo -p 27017:27017 mongo:7` |
| API :4000 לא עונה | `npm run dev:api` / `START-API.bat` · בדקו `MONGODB_URI` |
| כניסת אדמין מקומית | stubs: `admin@taxi.co.il` / `123456` · OTP `123456` (רק DEV) |
| Login / כתובת שרת | `.env`: `VITE_WEBAPP_URL=http://localhost:4000` · נקו `taxi_app_script_url` ב-Local Storage |
| Bridge בלי session | אותו `MONGODB_URI` ב-`bridge/.env` |
| Vite שבור | מחקו `node_modules` / `dist` / `.vite` · `SETUP.bat` |

---

## צוות

[`PROJECT_PROTOCOL.md`](./PROJECT_PROTOCOL.md) · [`STATUS.md`](./STATUS.md) · [`TASKS.md`](./TASKS.md) · [`MICROCOPY.md`](./MICROCOPY.md) · [`START.md`](./START.md)

---

*TAXIPRO / MONIT2 — START-MONGO · SETUP · START-ALL · SETUP-BRIDGE*
