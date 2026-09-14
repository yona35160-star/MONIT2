# TAXIPRO / MONIT2 — דיספאצ'ר מוניות בזמן אמת

מערכת לניהול הזמנות מוניות: **Passenger** · **Driver** · **Admin**  
Stack: Vite + React + TypeScript + Tailwind · Firebase · Google Apps Script · WhatsApp Bridge (Baileys)

ריפו: https://github.com/yona35160-star/MONIT2

---

## מה במערכת

| אפליקציה | תפקיד |
|----------|--------|
| Passenger | הזמנה, מעקב חי, דירוג |
| Driver | קבלת נסיעות, ניווט, רווחים |
| Admin | שליטה, מפת נהגים חיה, סיכומי AI |

| רכיב | טכנולוגיה |
|------|-----------|
| Frontend | Vite + React + TS + Tailwind (3 entry points) |
| Realtime | Firebase Realtime Database |
| Backend | Google Apps Script + Sheets |
| Messaging | Node bridge (`bridge/`) — WhatsApp + Telegram alerts |
| Mobile | Capacitor (android/ios; לא בסנכרון הראשוני) |

---

## התחלה מהירה

### דרישות
- Node.js 18+ (מומלץ 20)
- חשבון Firebase
- Google Sheets + Apps Script
- (אופציונלי) MongoDB Atlas ל-sessions של WhatsApp

### התקנה

```bash
npm install
cp .env.example .env   # מלא ערכים אמיתיים — אל תדחוף .env לריפו
cd bridge && npm install && cd ..
```

### הרצה מקומית

| אפליקציה | פקודה | כתובת טיפוסית |
|----------|-------|----------------|
| נוסע | `npm run dev:passenger` | http://localhost:5173/passenger.html |
| נהג | `npm run dev:driver` | http://localhost:5174/driver.html |
| אדמין | `npm run dev:admin` | http://localhost:5175/admin.html |

ב-Windows אפשר גם: `START-ALL.bat`

מדריך מפורט: [`GUIDE.md`](./GUIDE.md)

---

## פקודות עיקריות

| פקודה | תיאור |
|--------|--------|
| `npm run dev` | אדמין (כניסה מהירה ל-station-order) |
| `npm run dev:passenger` / `dev:driver` / `dev:admin` | הרצת אפליקציה בודדת |
| `npm run build:all` | בניית שלוש האפליקציות ל-`dist/` |
| `npm run typecheck` | בדיקת TypeScript בלי emit |
| `npm run bridge` | הרצת WhatsApp Bridge (`bridge/multi-bot.js`) |

---

## אבטחה

- **אל תדחפו** `.env` / `.env.local` / מפתחות לריפו
- עבדו מול `.env.example` בלבד כתבנית
- ראו גם: [`PROJECT_PROTOCOL.md`](./PROJECT_PROTOCOL.md), [`STATUS.md`](./STATUS.md)

---

## מסמכים

| קובץ | תוכן |
|------|------|
| [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) | מבט מוצר וארכיטקטורה |
| [`GUIDE.md`](./GUIDE.md) | התקנה, הרצה, פתרון בעיות |
| [`DEPLOY.md`](./DEPLOY.md) | פריסת Vercel ×3 + Render Bridge |
| [`TASKS.md`](./TASKS.md) | גלים ומשימות צוות |
| [`STATUS.md`](./STATUS.md) | סטטוס שוטף (חובה לעדכן בסיום משימה) |
| [`PROJECT_PROTOCOL.md`](./PROJECT_PROTOCOL.md) | חוק מסירה בין סוכנים |
| [`docs/`](./docs/) | מדריכי התקנה ותפעול נוספים |

---

## AI (אופציונלי)

עם `VITE_GEMINI_API_KEY`: Smart Command Box, Executive Briefing, Smart Assigner.

---

*TAXIPRO / MONIT2 — Israeli taxi dispatch*
