# Status

## מצב נוכחי
- פרויקט: **TAXIPRO / MONIT2**
- ריפו: https://github.com/yona35160-star/MONIT2
- Wave 1: Done
- Wave 2 P2: **verified** (re-smoke PASS)
- Wave 2 מתכנת (מפה / listeners / rate limits): **Done** — PR #1

## עדכון אחרון
- **Lead Developer:** חיזוק ביצועים — מניעת re-subscribe של Firebase, ניקוי listeners ב-unmount, throttle למיקום, rate-limit ל-GAS הצפוף
- **Verify:** `npm run typecheck` PASS; `npm run build:all` PASS (passenger/driver/admin)
- ממתין ל-Vercel preview מ-noma + QA רגרסיה על preview חי

## הצעד הבא
1. @סוכן בדיקות — רגרסיה על חיבורי WhatsApp/Telegram (אם זמין) + אבטחה בסיסית; אימות שמעקב מפה/סטטוס הזמנה עדיין חי
2. @סוכן DevOps — health checks (bridge `/health`, Firebase rules review)
3. @noma — 3 פרויקטי Vercel לפי `DEPLOY.md` + `VITE_*` ב-Dashboard
4. @סוכן עיצוב — polish למצבי שגיאה/טעינה/ריק
