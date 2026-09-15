# Status

## מצב נוכחי
- Wave Mongo — Express + Mongo API הוא מקור האמת ל-auth / הזמנות / נהגים
- Frontend ממשיך `sendToBackend` → `VITE_WEBAPP_URL=http://localhost:4000`
- Firebase נשאר זמנית ל-realtime בלבד (לא נקרע)
- DS v2.0 משולב (ענבר #F5A524 על charcoal #0B0F14, Heebo ב-`body` / `font-sans`)

## עדכון אחרון
- **מתכנת:** `server/` (Express + mongodb) עם חוזה GAS `{ action, payload, authToken }`; Login מקבל localhost; dashboard לא קורס כש-settings=null; QA-11b `SETUP-BRIDGE.bat`; QA-14 Heebo ב-body
- **תיעוד:** START.md / `.env.example` מצביעים ל-Mongo API

## הצעד הבא
1. @סוכן בדיקות — smoke: START-MONGO → `npm run dev:api` → Login Test + הזמנה
2. @סוכן DevOps — דחיפה אם QA ירוק
