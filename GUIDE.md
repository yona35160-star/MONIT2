# TAXIPRO / MONIT2 — מדריך הפעלה

> דיספאצ'ר מוניות: React + Firebase + Google Apps Script + WhatsApp Bridge  
> מדריך זה ממוקד **הרצה מקומית** ופריסת פרונט. ה-Bridge דורש תהליך מתמיד (מקומי / Render) — לא Vercel.

---

## תוכן עניינים

1. [מבט-על: מה רץ איפה](#1-מבט-על-מה-רץ-איפה)
2. [התקנה ראשונית](#2-התקנה-ראשונית)
3. [הרצה מקומית](#3-הרצה-מקומית)
4. [WhatsApp Bridge](#4-whatsapp-bridge)
5. [פריסת Frontend](#5-פריסת-frontend)
6. [שירותים חיצוניים](#6-שירותים-חיצוניים)
7. [מבנה הפרויקט](#7-מבנה-הפרויקט)
8. [פתרון בעיות](#8-פתרון-בעיות)

---

## 1. מבט-על: מה רץ איפה

| רכיב | מקומי? | חיצוני? | הערה |
|------|---------|---------|------|
| Frontend (Passenger / Driver / Admin) | ✅ `npm run dev:*` | ✅ Vercel / Netlify | 3 entry points נפרדים |
| WhatsApp Bridge | ✅ `npm run bridge` | ❌ לא על Vercel | WebSocket 24/7 — Render / מקומי |
| Firebase Realtime DB | ❌ | ✅ | חייב חיצוני |
| Google Apps Script | ❌ | ✅ | Backend + Sheets |
| MongoDB (sessions) | אופציונלי | ✅ Atlas | בלעדיו — sessions בקבצים מקומיים |

---

## 2. התקנה ראשונית

### דרישות

| כלי | גרסה |
|-----|------|
| Node.js | 18+ (מומלץ 20) |
| npm | 9+ |

### צעדים

```bash
npm install
cd bridge && npm install && cd ..
cp .env.example .env
```

מלאו את `.env` לפי `.env.example`.  
**אל תדחפו** `.env` / `.env.local` לריפו (ראו `PROJECT_OVERVIEW.md`).

### Backend (Apps Script) — פעם אחת

1. צרו Google Sheet והעלו את הקבצים מ-`GS/` ל-Apps Script.
2. הריצו פעם אחת את `setupSystem`.
3. Deploy כ-Web App (גישה: Everyone) והעתיקו את ה-URL ל-`VITE_WEBAPP_URL`.

---

## 3. הרצה מקומית

### Windows — סקריפט מובנה

```cmd
START-ALL.bat
```

### אפליקציה בודדת

| אפליקציה | פקודה | כתובת טיפוסית |
|----------|-------|----------------|
| נוסע | `npm run dev:passenger` | http://localhost:5173/passenger.html |
| נהג | `npm run dev:driver` | http://localhost:5174/driver.html |
| אדמין | `npm run dev:admin` | http://localhost:5175/admin.html |

Vite יבחר פורט פנוי אם הפורט תפוס.

### כניסה לאדמין

1. `npm run dev:admin`
2. בדף Login — גלגל השיניים (⚙️) להגדרת `VITE_WEBAPP_URL` אם חסר
3. Test → כניסה עם פרטי `Config.gs`

---

## 4. WhatsApp Bridge

אופציונלי — הפרונט עובד בלעדיו (בלי שליחת WhatsApp).

```bash
npm run bridge
# או: cd bridge && node multi-bot.js
```

בדיקת מצב:

```bash
curl http://localhost:3000/health
```

סריקת QR (החליפו מפתח מ-`bridge/.env`):

```
http://localhost:3000/qr?role=dispatcher&key=YOUR_API_KEY
```

`BRIDGE_API_KEY` ב-`bridge/.env` חייב להתאים ל-`VITE_BRIDGE_API_KEY` ב-`.env` הראשי.

---

## 5. פריסת Frontend

**מקור האמת לפריסה:** [`DEPLOY.md`](./DEPLOY.md) (Vercel ×3 לפרונט + Render ל-Bridge).

תמצית:
- Frontend → **Vercel** (3 פרויקטים: passenger / driver / admin) — `npm run build:passenger|driver|admin`, קיים `vercel.json` (SPA rewrites)
- Bridge → **Render** (`bridge/render.yaml`) — לא על Vercel
- `netlify.toml` נשאר כאופציה משנית בלבד

העתיקו משתני `VITE_*` מ-`.env.example` ל-Vercel (ערכים אמיתיים רק שם). אחרי Deploy עדכנו את `VITE_SITE_URL` / `VITE_DRIVER_SITE_URL` / `VITE_ADMIN_SITE_URL` ו-Redeploy.

---

## 6. שירותים חיצוניים

| שירות | למה לא Vercel? | מה כן |
|-------|----------------|--------|
| WhatsApp Bridge | WebSocket + filesystem + 24/7 | מקומי / Render / Railway / Fly.io |
| Firebase | DB מנוהל | להישאר ב-Firebase |
| Apps Script | Runtime של Google | להישאר ב-Google |
| MongoDB Atlas | sessions חיצוניים | אופציונלי; בלי URI — קבצים מקומיים |

---

## 7. מבנה הפרויקט

```
MONIT2 / TAXIPRO
├── src/
│   ├── api/                 # שכבת API
│   ├── apps/                # Passenger / Driver / Admin shells
│   ├── components/          # UI משותף (+ ui/: Button, Badge, Card, Input, Spinner)
│   ├── pages/               # דפים
│   ├── store/               # Redux Toolkit
│   ├── services/            # Firebase, AI, Push
│   ├── data/                # blog, FAQ
│   ├── types/ · utils/ · styles/
│   └── firebase-config.ts
├── bridge/                  # WhatsApp Bridge (Baileys)
├── GS/                      # Google Apps Script
├── public/
├── docs/                    # מדריכים נוספים
├── passenger.html · driver.html · admin.html
├── START-ALL.bat
├── vercel.json
├── design-system.json     # טוקני עיצוב (מקור אמת)
├── DESIGN_NOTES.md         # הערות מסירת עיצוב
├── DEPLOY.md              # פריסת Vercel + Render
├── netlify.toml           # אופציה משנית
├── .env.example             # תבנית בלבד — לא סודות בריפו
├── PROJECT_OVERVIEW.md · GUIDE.md · DEPLOY.md · TASKS.md · STATUS.md · PROJECT_PROTOCOL.md
└── package.json
```

---

## 8. פתרון בעיות

### "כתובת שרת לא הוגדרה"
- גלגל השיניים ב-Login
- ודאו ש-`VITE_WEBAPP_URL` תקין (`https://script.google.com/macros/s/…`)

### Vite לא נטען

```bash
rm -rf node_modules dist .vite
npm install
npm run dev:admin
```

### פורט תפוס (Windows)

```cmd
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

### WhatsApp לא מתחבר
- התאמת `BRIDGE_API_KEY` ↔ `VITE_BRIDGE_API_KEY`
- נקו `bridge/sessions/` וסירקו QR מחדש
- בדקו `MONGO_URI` אם בשימוש

### Firebase לא מתחבר
- כל `VITE_FIREBASE_*` תקינים
- Realtime Database פעיל + `database.rules.json`

### Module not found אחרי שינוי

```bash
rm -rf node_modules/.vite
npm run dev:admin
```

---

## פקודות מהירות

```bash
npm run typecheck
npm run dev:passenger
npm run dev:driver
npm run dev:admin
npm run build:all
npm run bridge
curl http://localhost:3000/health
```

---

## צוות סוכנים

עבדו לפי [`PROJECT_PROTOCOL.md`](./PROJECT_PROTOCOL.md):  
סיום משימה = עדכון [`STATUS.md`](./STATUS.md) + יידוע הסוכן הבא.

---

*TAXIPRO / MONIT2 — Israeli taxi dispatch*
