# TAXIPRO / MONIT2 — דיספאצ'ר מוניות (2 מסכים)

מערכת הזמנות מוניות בזמן אמת עם **שני ממשקים בלבד** ותשתית חדשה נקייה.

| מסך | כניסה | למי |
|-----|--------|-----|
| **מרכז שליטה** | `admin.html` | אדמין + שיגור מתחנה (אין אתר תחנה נפרד) |
| **אפליקציית נסיעה** | `app.html` | נוסע ונהג באותו אתר — בחירת תפקיד / `#/passenger` / `#/driver` |

Stack: Vite + React + TypeScript + Tailwind · Firebase · Google Apps Script · WhatsApp Bridge (Baileys)

ריפו: https://github.com/yona35160-star/MONIT2

---

## התחלה בלחיצה (יעד Wave Unify)

```cmd
SETUP.bat
```

הסקריפט (כשיהיה מוכן מ-DevOps) אמור:
1. `npm install` (שורש + `bridge/` אופציונלי)
2. להעתיק `.env.example` → `.env` אם חסר
3. להפעיל את **2** האפליקציות (+ bridge אופציונלי)

מדריך מפורט: [`GUIDE.md`](./GUIDE.md) · פריסה: [`DEPLOY.md`](./DEPLOY.md)

---

## הרצה ידנית (יעד)

| מסך | פקודה צפויה | כתובת |
|-----|-------------|--------|
| מרכז שליטה | `npm run dev:admin` | http://localhost:5175/admin.html |
| אפליקציית נסיעה | `npm run dev:app` | http://localhost:5173/app.html |

> **מעבר:** עד שהמתכנת סוגר איחוד entries, עדיין קיימים `passenger.html` / `driver.html`. אחרי Wave U1 הם יופנו ל-`app.html`.

### Bridge (אופציונלי)

```bash
npm run bridge
curl http://localhost:3000/health
```

---

## תשתית חדשה (חובה)

- Firebase project **חדש** + Google Sheet / Apps Script **חדש**
- WhatsApp: בוט מנהל חדש + קבוצת תחנה חדשה (QR ידני ע״י noma)
- בריפו רק `.env.example` — **אל תדחפו** `.env` / מפתחות

---

## פקודות עיקריות

| פקודה | תיאור |
|--------|--------|
| `npm run typecheck` | TypeScript |
| `npm run build:admin` / `build:app` | בניית 2 המסכים (אחרי איחוד) |
| `npm run bridge` | WhatsApp Bridge |

---

## מסמכים

| קובץ | תוכן |
|------|------|
| [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) | כיוון מוצר — 2 מסכים |
| [`GUIDE.md`](./GUIDE.md) | התקנה, BAT, הרצה, פתרון בעיות |
| [`DEPLOY.md`](./DEPLOY.md) | Vercel / Render |
| [`MICROCOPY.md`](./MICROCOPY.md) | קול מותג + מילון |
| [`TASKS.md`](./TASKS.md) | Wave Unify |
| [`STATUS.md`](./STATUS.md) | סטטוס שוטף |
| [`PROJECT_PROTOCOL.md`](./PROJECT_PROTOCOL.md) | חוק מסירה |

---

*TAXIPRO / MONIT2 — 2 screens only*
