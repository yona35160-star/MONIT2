# TAXIPRO / MONIT2 — דיספאצ'ר מוניות (2 מסכים)

מערכת הזמנות מוניות בזמן אמת עם **שני ממשקים בלבד**.

| מסך | כניסה | URL מקומי |
|-----|--------|-----------|
| **מרכז שליטה** (Ops) | `admin.html` | http://localhost:5275/admin.html |
| **אפליקציית נסיעה** (App) | `app.html` | http://localhost:5273/app.html |

באפליקציית הנסיעה: בחירת תפקיד (נוסע / נהג) או `#/passenger` / `#/driver`.  
`passenger.html` / `driver.html` / `index.html` מפנים ל-`app.html`.

Stack: Vite + React + TypeScript + Tailwind · Firebase · Google Apps Script · WhatsApp Bridge (Baileys)

ריפו: https://github.com/yona35160-star/MONIT2

---

## התחלה בלחיצה אחת

```cmd
SETUP.bat
```

מה קורה:
1. `npm install` (שורש + `bridge/`)
2. מעתיק `.env.example` → `.env` (ורק אם חסר; גם `bridge/.env`)
3. מפעיל **רק 2 מסכים** — `dev:ops` + `dev:app` (בלי שאלות)
4. פותח את ה-URLs למעלה

סקריפטים נוספים:

| קובץ | תפקיד |
|------|--------|
| `START-ALL.bat` | מפעיל 2 מסכים (או קורא ל-`SETUP.bat` אם אין `node_modules`) |
| `SETUP-BRIDGE.bat` | WhatsApp Bridge בנפרד (כשיש בוט/QR חדש) |

מדריך מלא: [`GUIDE.md`](./GUIDE.md) · פריסה: [`DEPLOY.md`](./DEPLOY.md)

---

## הרצה ידנית

| מסך | פקודה | כתובת |
|-----|--------|--------|
| מרכז שליטה | `npm run dev:ops` | http://localhost:5275/admin.html |
| אפליקציית נסיעה | `npm run dev:app` | http://localhost:5273/app.html |

```bash
npm run typecheck
npm run build:unify    # = build:ops + build:app (גם: npm run build:all)
npm run bridge         # או SETUP-BRIDGE.bat
```

---

## תשתית חדשה

- Firebase + Google Sheet/Apps Script **חדשים** — מלאו ב-`.env` (אל תדחפו לריפו)
- WhatsApp: בוט מנהל + קבוצה חדשים — סריקת QR דרך `SETUP-BRIDGE.bat`
- תבניות בלבד בריפו: `.env.example`, `bridge/.env.example`

---

## מסמכים

| קובץ | תוכן |
|------|------|
| [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) | כיוון מוצר |
| [`START.md`](./START.md) | התחלה מחדש ממוספרת ל-noma |
| [`GUIDE.md`](./GUIDE.md) | התקנה / BAT / פתרון בעיות |
| [`DEPLOY.md`](./DEPLOY.md) | Vercel ×2 + Render |
| [`MICROCOPY.md`](./MICROCOPY.md) | קול מותג |
| [`TASKS.md`](./TASKS.md) · [`STATUS.md`](./STATUS.md) · [`PROJECT_PROTOCOL.md`](./PROJECT_PROTOCOL.md) | צוות |

---

*TAXIPRO / MONIT2 — 2 screens · one-click SETUP*
