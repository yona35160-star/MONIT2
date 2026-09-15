# PROJECT_OVERVIEW — TAXIPRO / MONIT2

## כיוון מוצר (מעודכן)
מערכת דיספאצ'ר מוניות עם **2 ממשקים בלבד** + תשתית חדשה נקייה.

### שני המסכים
1. **מרכז שליטה** (`admin` / ops) — ניהול, מפת נהגים, שיגור מתחנה (StationOrder מאוחד לכאן). אין אתר תחנה נפרד.
2. **אפליקציית נסיעה** (`app`) — נוסע ונהג באותו אתר/אפליקציה, עם בחירת תפקיד בכניסה (או לינק `#/passenger` / `#/driver`). אין אתרי passenger/driver נפרדים.

### תשתית חדשה (חובה)
- **Database חדש** — Firebase project חדש + Google Sheet / Apps Script חדש (בלי לשאת נתונים ישנים)
- **WhatsApp חדש** — מספר/סשן בוט מנהל חדש + קבוצת תחנה חדשה לשליחת הודעות
- **התקנה בלחיצה** — `SETUP.bat` / `START-ALL.bat` שמריצים install + env template + dev של 2 המסכים (+ bridge אופציונלי)

### ארכיטקטורה (נשארת)
Vite + React + TS | Firebase realtime | Google Apps Script | WhatsApp Bridge (Baileys)

### מקורות
- מקומי: `C:\Users\Pc\MONIT2-sync` (מקור עבודה)
- מקור מקורי: `F:\SAAS\טקסי-פרו-עותק`
- GitHub: https://github.com/yona35160-star/MONIT2
