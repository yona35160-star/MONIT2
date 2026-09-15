# Status

## מצב נוכחי
- גל: **Wave Mongo** — Mongo = SoR; Express API על `:4000`; GAS/Sheets החוצה בהדרגה; Firebase זמני ל-Realtime
- Frontend: `sendToBackend` → `VITE_WEBAPP_URL=http://localhost:4000`

## עדכון אחרון
- **מתכנת:** `server/` Express + mongodb עם חוזה GAS `{ action, payload, authToken }`; Login מקבל localhost; dashboard לא קורס כש-settings=null
- **DevOps:** `START-MONGO.bat`, `SETUP.bat` (Mongo→install→API→2 apps), `ARCHITECTURE.md`, `.env.example`
- **QA-11b / QA-14:** `SETUP-BRIDGE.bat` · Heebo ב-`body` / `font-sans`

## הצעד הבא
1. @סוכן בדיקות — smoke: START-MONGO → `npm run dev:api` → Login Test + הזמנה
2. Firebase עדיין נדרש למפת realtime; WhatsApp עדיין `SETUP-BRIDGE.bat`
