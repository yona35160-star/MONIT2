# TAXIPRO — מדריך הפעלה מלא

> מערכת דיספאצ'ר מוניות: React + Firebase + Google Apps Script + WhatsApp Bridge
> **המדריך הזה ממוקד הרצה מקומית. שירותים חיצוניים (אם נדרשים) — Vercel בלבד.**

---

## תוכן עניינים
1. [מבט-על: מה רץ איפה](#1-מבט-על-מה-רץ-איפה)
2. [התקנה ראשונית (פעם אחת)](#2-התקנה-ראשונית)
3. [הרצה מקומית — 3 דקות](#3-הרצה-מקומית)
4. [הרצת WhatsApp Bridge מקומית](#4-הרצת-whatsapp-bridge-מקומית)
5. [פריסה ל-Vercel (אופציונלי)](#5-פריסה-ל-vercel)
6. [שירותים חיצוניים שלא ניתנים להחלפה](#6-שירותים-חיצוניים-שלא-ניתנים-להחלפה)
7. [מבנה הפרויקט](#7-מבנה-הפרויקט)
8. [פתרון בעיות](#8-פתרון-בעיות)

---

## 1. מבט-על: מה רץ איפה

| רכיב | מקומי? | חיצוני? | הערה |
|------|---------|---------|------|
| Frontend (Passenger / Driver / Admin) | ✅ npm run dev | ✅ Vercel | רץ מקומית או על Vercel |
| WhatsApp Bridge (Node.js) | ✅ node multi-bot.js | ❌ Vercel לא תומך | **חייב Render/מקומי** — דורש WebSocket מתמיד 24/7 |
| Firebase Realtime DB | ❌ | ✅ חינמי | חייב להיות חיצוני (DB) |
| Google Apps Script (Backend) | ❌ | ✅ חינמי | חייב להיות חיצוני (אצל Google) |
| MongoDB (sessions של ה-Bridge) | ✅ אופציונלי | ✅ Atlas חינמי | בלעדיו — sessions נשמרים בקבצים מקומיים |

> **חשוב:** ה-`.env` בפרויקט כבר מאוכלס בערכים פעילים של Firebase + GAS, ולכן הפרונט-אנד עובד מקומית מיידית מול ה-backend החי.

---

## 2. התקנה ראשונית

### דרישות
| כלי | גרסה |
|-----|------|
| Node.js | 18+ (מומלץ 20) |
| npm | 9+ |

### צעדים

```bash
# 1. התקנת תלויות ראשיות
npm install

# 2. התקנת תלויות ה-Bridge (אופציונלי — רק אם משתמשים ב-WhatsApp)
cd bridge && npm install && cd ..
```

### וידוא `.env`
הקובץ `.env` בשורש הפרויקט כבר מכיל ערכים פעילים. אם הוא חסר:
```bash
cp .env.example .env
```
ואז ערוך אותו לפי [סעיף .env.example](.env.example).

---

## 3. הרצה מקומית

### דרך מהירה (Windows): סקריפט מובנה
```cmd
start-local.bat
```
פותח 3 חלונות טרמינל — אחד לכל אפליקציה (Passenger/Driver/Admin).

### דרך ידנית — אפליקציה אחת
| אפליקציה | פקודה | דפדפן ייפתח אוטומטית בכתובת |
|----------|-------|-------------------------------|
| נוסע (Passenger) | `npm run dev:passenger` | http://localhost:5173/passenger.html |
| נהג (Driver) | `npm run dev:driver` | http://localhost:5174/driver.html |
| אדמין (Admin) | `npm run dev:admin` | http://localhost:5175/admin.html |

> Vite יבחר פורט פנוי אוטומטית אם 5173 תפוס.

### דרך ידנית — 3 אפליקציות במקביל
פתח 3 טרמינלים, אחד לכל פקודה:
```bash
# Terminal 1
npm run dev:passenger

# Terminal 2
npm run dev:driver

# Terminal 3
npm run dev:admin
```

### כניסה לפאנל האדמין
1. הרץ `npm run dev:admin` ופתח את ה-URL
2. בדף ה-Login לחץ על גלגל השיניים (⚙️)
3. אם ה-`.env` כבר מאוכלס — השדה כבר מלא; אחרת הדבק את ה-GAS URL
4. לחץ **Test** ואז **כניסה** עם אימייל וסיסמה כפי שהוגדרו ב-Apps Script (`Config.gs`)

---

## 4. הרצת WhatsApp Bridge מקומית

ה-Bridge פותח חיבור WhatsApp Web לטלפון פיזי. זה רק **אופציונלי** — הפרונטאנד עובד גם בלעדיו (פשוט לא ישלחו הודעות וואטסאפ).

### הרצה
```bash
npm run bridge:multi
```
או:
```bash
cd bridge && node multi-bot.js
```

### בדיקת מצב
```bash
curl http://localhost:3000/health
# {"status":"healthy","activeSessions":0,...}
```

### סריקת QR
פתח בדפדפן (החלף `YOUR_API_KEY` במפתח מ-`bridge/.env`):
```
http://localhost:3000/qr?role=dispatcher&key=YOUR_API_KEY
```
סרוק עם ה-WhatsApp שלך. חזור על אותו תהליך עם `role=driver` ו-`role=passenger` אם נדרש.

> ה-`bridge/.env` כבר מאוכלס. ה-`BRIDGE_API_KEY` חייב להיות זהה ל-`VITE_BRIDGE_API_KEY` שב-`.env` הראשי.

---

## 5. פריסה ל-Vercel

> **רק** הפרונט-אנד עובר ל-Vercel. ה-Bridge לא יכול לרוץ שם (ראה [סעיף 6](#6-שירותים-חיצוניים-שלא-ניתנים-להחלפה)).

### תהליך — 3 פרויקטים נפרדים ב-Vercel
מכיוון שיש 3 גרסאות (passenger/driver/admin), צור 3 פרויקטים ב-Vercel — כולם מצביעים לאותו ה-Repo.

#### פרויקט 1: Passenger
1. ב-[Vercel Dashboard](https://vercel.com/dashboard) → **Add New → Project**
2. ייבא את ה-Repo
3. **Project Name:** `taxipro-passenger`
4. **Framework Preset:** Vite (יזוהה אוטומטית מ-`vercel.json`)
5. **Build Command:** `npm run build:vercel` (נקבע ב-`vercel.json`)
6. **Environment Variables:**
   - `BUILD_MODE` = `passenger`
   - הוסף את **כל** משתני `VITE_*` מ-`.env`
7. **Deploy**

#### פרויקט 2: Driver
חזור על הצעדים, עם:
- **Project Name:** `taxipro-driver`
- `BUILD_MODE` = `driver`

#### פרויקט 3: Admin
חזור עם:
- **Project Name:** `taxipro-admin`
- `BUILD_MODE` = `admin`

### עדכון URLs לאחר Deploy
לאחר שכל 3 הפרויקטים פרוסים, עדכן את ה-`.env` המקומי + Vercel Env Vars:
```env
VITE_SITE_URL=https://taxipro-passenger.vercel.app
VITE_DRIVER_SITE_URL=https://taxipro-driver.vercel.app
VITE_ADMIN_SITE_URL=https://taxipro-admin.vercel.app
```
ואז Redeploy את שלושת הפרויקטים כדי שהקישורים הפנימיים יעבדו.

### Vercel CLI (אלטרנטיבה)
```bash
npm i -g vercel
vercel login
BUILD_MODE=admin vercel --prod
```

---

## 6. שירותים חיצוניים שלא ניתנים להחלפה

| שירות | למה לא Vercel? | אלטרנטיבה |
|-------|----------------|-----------|
| **WhatsApp Bridge** | דורש WebSocket מתמיד + filesystem persistent + תהליך 24/7. Vercel Functions: timeout 60s, stateless, אין כתיבה לדיסק. | להריץ מקומית, או Render Free, או Railway/Fly.io |
| **Firebase Realtime DB** | זה DB מנוהל של Google, לא ניתן להעביר. | להישאר ב-Firebase (חינמי) |
| **Google Apps Script** | זה ה-runtime הסגור של Google. | להישאר ב-Google (חינמי) |
| **MongoDB Atlas** | אם אתה משתמש בו ל-bridge sessions — הוא חיצוני בלאו הכי. | אופציה: להשמיט `MONGO_URI` ולשמור sessions בקבצים |

### למה ה-Bridge לא רץ ב-Vercel?
ה-Bridge מבוסס Baileys (WhatsApp Web client) שדורש:
1. חיבור WebSocket מתמיד לשרתי WhatsApp.
2. שמירת session על דיסק (auth keys).
3. רספונדר HTTP זמין 24/7 לקבלת קריאות מ-GAS.

Vercel Serverless Functions:
- מוגבלות ל-60 שניות ביצוע (Pro).
- Stateless — אין filesystem בין קריאות.
- Cold-start בכל קריאה — מנתק WebSocket.

**מה כן עובד:** הריץ מקומית בזמן הפיתוח, או השאר ב-Render כפי שיש כיום.

---

## 7. מבנה הפרויקט

```
TAXIWORK/
├── src/
│   ├── api/                # שכבת API (api.ts, adminApi, driverApi, passengerApi)
│   ├── components/         # קומפוננטות משותפות
│   │   ├── ui/Button.tsx   # קומפוננטת UI בסיסית
│   │   ├── LiveMap.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── ...
│   ├── pages/              # דפים ראשיים
│   ├── store/              # Redux Toolkit
│   │   └── slices/         # authSlice, ordersSlice, driversReducer, statsSlice, settingsSlice
│   ├── services/           # Firebase, AI, Push notifications
│   ├── data/               # blogArticles.ts, faqData.ts
│   ├── types/              # TypeScript types
│   ├── styles/index.css
│   └── firebase-config.ts
├── bridge/                 # WhatsApp Bridge (Node.js + Baileys)
│   ├── multi-bot.js
│   ├── mongo-auth-state.js
│   └── .env
├── GS/                     # Google Apps Script (Backend)
├── public/                 # icons, manifests
├── passenger.html / driver.html / admin.html  # 3 entry points
├── vite.config.ts
├── vercel.json             # תצורת Vercel (build:vercel)
├── start-local.bat         # סקריפט הרצה מקומית מהירה
├── .env / .env.example
└── package.json
```

---

## 8. פתרון בעיות

### "כתובת שרת לא הוגדרה" בכניסה
- לחץ על גלגל השיניים בדף ה-Login.
- ודא ש-`VITE_WEBAPP_URL` ב-`.env` תקין (מתחיל ב-`https://script.google.com/macros/s/`).

### Vite לא נטען
```bash
# נקה cache והתקן מחדש
rm -rf node_modules dist .vite
npm install
npm run dev:admin
```

### פורט תפוס
```bash
# Windows — מצא ותסגור
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

### WhatsApp לא מתחבר
- ודא ש-`bridge/.env` מכיל `BRIDGE_API_KEY` תואם ל-`.env` הראשי.
- מחק את תיקיית `bridge/sessions/*` וסרוק QR מחדש.
- אם משתמשים ב-MongoDB: ודא שה-URI נכון.

### Firebase לא מתחבר
- ודא שכל משתני `VITE_FIREBASE_*` נכונים.
- ב-Firebase Console: ודא שה-Realtime Database **פעיל**.
- ודא ש-`database.rules.json` מאפשר קריאה/כתיבה.

### Build נכשל ב-Vercel
- ודא ש-`BUILD_MODE` מוגדר ב-Environment Variables של הפרויקט (`passenger`/`driver`/`admin`).
- ודא שכל משתני `VITE_*` מועתקים מ-`.env` ל-Vercel.

### "Module not found" אחרי שינוי קוד
```bash
# שחזר חיבורים פנימיים
rm -rf node_modules/.vite
npm run dev:admin
```

---

## פקודות מהירות

```bash
# === Frontend מקומי ===
npm run dev:passenger          # נוסע → 5173
npm run dev:driver             # נהג → 5174
npm run dev:admin              # אדמין → 5175

# === Build ===
npm run build:passenger        # build → dist/passenger
npm run build:driver           # build → dist/driver
npm run build:admin            # build → dist/admin
npm run build:all              # בנה את כל השלוש

# === Vercel ===
BUILD_MODE=admin npm run build:vercel    # מדמה build של Vercel מקומית

# === Bridge (WhatsApp) ===
npm run bridge:multi           # הרץ Bridge מקומית בפורט 3000
curl http://localhost:3000/health  # בדוק ש-Bridge עובד
```

---

## בעיות-build שתוקנו לאחרונה

| שגיאה | תיקון |
|-------|-------|
| `Could not resolve "./index.css"` | תוקן ל-`./styles/index.css` |
| `authSlice/ordersSlice/driversReducer/statsSlice/settingsSlice` חסרים | נוצרו 5 slices ב-`src/store/slices/` |
| `firebase-messaging.ts: Could not resolve "./api"` | תוקן ל-`'../api/api'` |
| `firebase.ts: Could not resolve "./api"` | תוקן ל-`'../api/api'` |
| `ErrorBoundary.tsx: Could not resolve "../src/utils/logger"` | תוקן ל-`'../utils/logger'` |
| `LandingPage.tsx: JSX tag mismatch` | נוסף `<div>` עוטף חסר |
| `OrderDetailsModal.tsx: Could not resolve "./ui/Button"` | נוצר `src/components/ui/Button.tsx` |
| `BlogPost.tsx / Blog.tsx: Could not resolve "../data/blogArticles"` | הקובץ הועתק ל-`src/data/blogArticles.ts` |
| `FAQ.tsx: Could not resolve "../data/faqData"` | הקובץ הועתק ל-`src/data/faqData.ts` |
| `Login.tsx: navigate('/dashboard')` שלא קיים | תוקן ל-`navigate('/admin')` |
| `bridge/multi-bot.js`: handlers כפולים | הוסרו (השאר רק עם Telegram alerts) |

---

*TAXIPRO v1.0 — Built for Israeli Taxi Dispatch*
