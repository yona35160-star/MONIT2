# TAXIPRO / MONIT2 — מדריך הפעלה (2 מסכים)

> **מרכז שליטה** + **אפליקציית נסיעה** · Firebase/GAS/WhatsApp חדשים · BAT בלחיצה אחת

---

## 1. שני המסכים

| מסך | קובץ | פקודה | URL מקומי |
|-----|------|--------|-----------|
| מרכז שליטה (Ops) | `admin.html` | `npm run dev:ops` | http://localhost:5275/admin.html |
| אפליקציית נסיעה | `app.html` | `npm run dev:app` | http://localhost:5273/app.html |

- שיגור מתחנה בתוך האדמין: `#/station-order` (גם `#/station`, `#/dispatch`)
- באפליקציה: מסך בחירת תפקיד · «החלף תפקיד» · `#/passenger` / `#/driver`
- כניסות ישנות מפנות ל-`app.html`

---

## 2. לחיצה אחת (Windows)

### SETUP.bat — התקנה + הרצה
בלי שאלות:
1. מעתיק `.env.example` → `.env` אם חסר (גם `bridge/.env`)
2. `npm install` בשורש וב-`bridge/`
3. מפעיל `dev:ops` + `dev:app`
4. פותח את שני ה-URLs

### START-ALL.bat — הרצה חוזרת
מפעיל את 2 המסכים. אם אין `node_modules` — קורא ל-`SETUP.bat`.

### SETUP-BRIDGE.bat — WhatsApp בנפרד
מתקין bridge אם צריך, מריץ `npm run bridge`, פותח `/health`.  
סריקת QR לבוט החדש — ראו סעיף 4.

---

## 3. הרצה ידנית

```bash
npm install
cd bridge && npm install && cd ..
cp .env.example .env   # פעם אחת; מלאו ערכים חדשים

npm run dev:ops        # מרכז שליטה
npm run dev:app        # אפליקציית נסיעה
```

בנייה:

```bash
npm run typecheck
npm run build:unify    # build:ops + build:app
```

---

## 4. WhatsApp Bridge

לא חלק מ-`SETUP.bat` — הריצו בנפרד:

```cmd
SETUP-BRIDGE.bat
```

או:

```bash
npm run bridge
curl http://localhost:3000/health
```

QR (מפתח מ-`bridge/.env`):

```
http://localhost:3000/qr?role=dispatcher&key=YOUR_API_KEY
```

`BRIDGE_API_KEY` חייב להתאים ל-`VITE_BRIDGE_API_KEY`.  
noma: סריקת QR + יצירת קבוצה חדשה ומסירת IDs.

---

## 5. תשתית חדשה ופריסה

1. Firebase חדש → `VITE_FIREBASE_*`
2. Sheet + GAS חדש מ-`GS/` → `VITE_WEBAPP_URL`
3. אל תדחפו `.env` / `bridge/.env`
4. פרודקשן: **2** פרויקטי Vercel — ראו [`DEPLOY.md`](./DEPLOY.md) (`build:ops` / `build:app`)

---

## 6. פתרון בעיות

| בעיה | מה לעשות |
|------|-----------|
| כתובת שרת לא הוגדרה | גלגל שיניים ב-Login · מלאו `VITE_WEBAPP_URL` |
| פורט תפוס | סגרו חלון Vite ישן או הריצו מחדש את ה-BAT |
| Bridge לא מגיב | `SETUP-BRIDGE.bat` · התאמת מפתחות · QR מחדש |
| Vite שבור | מחקו `node_modules` / `dist` / `.vite` והריצו `SETUP.bat` |

---

## צוות

[`PROJECT_PROTOCOL.md`](./PROJECT_PROTOCOL.md) · [`STATUS.md`](./STATUS.md) · [`TASKS.md`](./TASKS.md) · [`MICROCOPY.md`](./MICROCOPY.md)

---

*TAXIPRO / MONIT2 — SETUP.bat · START-ALL.bat · SETUP-BRIDGE.bat*
