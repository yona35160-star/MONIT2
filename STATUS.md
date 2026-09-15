# Status

## מצב נוכחי
- גל: **Wave Mongo** — Mongo = SoR; GAS/Sheets החוצה בהדרגה; Firebase זמני ל-Realtime
- חוסם: מחשב `DESKTOP-54EVA7N` היה מנותק בזמן הכנת DevOps — קבצים מוכנים לדחיפה

## עדכון אחרון
- **DevOps (מוכן לדחיפה):** `START-MONGO.bat`, `SETUP.bat` (Mongo→install→API→2 apps), `ARCHITECTURE.md`, `.env.example` עם `VITE_WEBAPP_URL=http://localhost:4000`, `server/.env.example`, `bridge/.env.example` עם Mongo מקומי/Atlas, `START.md` Mongo-first
- **תיעוד:** עדכון Mongo ב-START (סנכרון למכונה אחרי חיבור)
- **מתכנת:** שלד `server/` Express+Mongo

## הצעד הבא
1. @noma — לחבר מחדש את המחשב / לאשר חיבור GitHub ל-Cloud Agent
2. @סוכן מתכנת — `server/` API
3. @סוכן בדיקות — smoke אחרי API
