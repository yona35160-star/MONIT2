# PROJECT_OVERVIEW — TAXIPRO / MONIT2

מערכת דיספאצ'ר מוניות בזמן אמת (Taxi Dispatch).

## מוצר
- **Passenger** — הזמנה, מעקב חי, דירוג
- **Driver** — קבלת נסיעות, ניווט, רווחים
- **Admin** — שליטה, מפת נהגים חיה, סיכומי AI

## ארכיטקטורה
| רכיב | טכנולוגיה | הערות |
|------|-----------|--------|
| Frontend | Vite + React + TS + Tailwind | 3 כניסות: passenger/driver/admin |
| Realtime | Firebase | מיקומי נהגים + סטטוס נסיעה |
| Backend | Google Apps Script + Sheets | לוגיקה עסקית ומחירים |
| Messaging | Node bridge (Baileys) | WhatsApp + Telegram alerts |
| Mobile | Capacitor | android/ios (לא בסנכרון הראשוני) |

## מקור אמת מקומי
`F:\SAAS\טקסי-פרו-עותק` → עותק נקי לסנכרון: `C:\Users\Pc\MONIT2-sync`  
ריפו: https://github.com/yona35160-star/MONIT2

## יעד נוכחי
מערכת מוכנה מקצה לקצה: ביצועים, חיבורים יציבים, עיצוב עקבי, בדיקות מחזוריות — בלי תקלות במסלול הקריטי (הזמנה → שיוך נהג → מעקב → סיום).

## מגבלות אבטחה
- לא לדחוף `.env` / `.env.local` / מפתחות
- לעבוד מול `.env.example` בלבד בריפו
