# TASKS — TAXIPRO (MONIT2)

עדיפות מלמעלה למטה. כל סוכן מעדכן `STATUS.md` ומעביר לסוכן הבא לפי `PROJECT_PROTOCOL.md`.

## Wave 0 — סנכרון (עכשיו)
- [ ] PM: סנכרון קוד מקומי → GitHub MONIT2 (בלי node_modules / .env)
- [ ] DevOps: וידוא `.gitignore`, מבנה ריפו, הרצה מקומית `npm install` + `npm run typecheck`

## Wave 1 — יציבות ובסיס (היום)
- [ ] עיצוב: Design System + בדיקת עקביות UI ב-3 האפליקציות (passenger/driver/admin)
- [ ] מתכנת: תיקון typecheck/build, מסלול קריטי הזמנה→שיוך→מעקב, חיבורי Firebase/GAS בטוחים
- [ ] QA: smoke E2E על 3 האפליקציות + דוח `QA-REPORT.md`
- [ ] תיעוד: יישור README/GUIDE לריפו + microcopy במקומות שבורים
- [ ] DevOps: תסריטי הרצה/פריסה (Vercel front + Render bridge) + env template

## Wave 2 — ביצועים וחיבורים
- [ ] מתכנת: ביצועי מפה/listeners, ניקוי memory leaks, rate limits
- [ ] DevOps: health checks (bridge `/health`, Firebase rules review)
- [ ] QA: רגרסיה על חיבורי WhatsApp/Telegram (אם זמין) + אבטחה בסיסית
- [ ] עיצוב: polish למצבי שגיאה/טעינה/ריק

## Wave 3 — מוכן לייצור
- [ ] QA: E2E מלא + רשימת חסימות
- [ ] DevOps: פריסת preview יציבה
- [ ] PM: אישור Go-Live / חזרה לתיקונים

## שגרה
כל ~3 שעות בימי עבודה: בדיקת סטטוס + smoke קצר + עדכון `STATUS.md` + דיווח ל-noma על חסימות בלבד.
