# START — התחלה מחדש (Fresh Start) ל-noma

מדריך ממוספר להרמת **TAXIPRO / MONIT2** על תשתית חדשה.
2 מסכים בלבד: מרכז שליטה + אפליקציית נסיעה.
**Wave Mongo:** מקור האמת הוא Express + Mongo ב-`http://localhost:4000` (לא GAS). Firebase נשאר זמנית ל-realtime בלבד.

> אל תדחפו `.env` / מפתחות ל-GitHub. רק תבניות `.env.example`.

---

## סקירה מהירה

| # | שלב | תוצאה |
|---|-----|--------|
| 1 | Firebase חדש | ערכי `VITE_FIREBASE_*` (realtime בלבד) |
| 2 | MongoDB מקומי + API | `START-MONGO.bat` ואז `npm run dev:api` על פורט 4000 |
| 3 | מילוי `.env` | `VITE_WEBAPP_URL=http://localhost:4000` |
| 4 | `SETUP.bat` | 2 מסכים + API |
| 5 | `SETUP-BRIDGE.bat` + QR + קבוצה | WhatsApp חדש |
| 6 | בדיקת הזמנה | הזמנה → שיוך → מעקב |

---

## 1) Firebase חדש (realtime בלבד)

1. היכנסו ל-[Firebase Console](https://console.firebase.google.com/) → **Add project**.
2. הוסיפו **Realtime Database** (למשל `europe-west1`).
3. Project Settings → Your apps → Web → העתיקו: `apiKey`, `authDomain`, `databaseURL`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` (+ `measurementId` אם יש).
4. (מומלץ) יישמו כללים לפי `database.rules.json`.
5. שמרו את הערכים למילוי ב-`.env` בסעיף 3.

---

## 2) MongoDB + Express API (מקור האמת)

GAS/Sheets יוצאים בהדרגה. הפרונט ממשיך לשלוח `POST { action, payload, authToken }` — עכשיו ל-`http://localhost:4000`.

### 2.1 הפעלת Mongo
Windows:
```cmd
START-MONGO.bat
```
או שירות: `net start MongoDB` · או `mongod --dbpath data\mongo` · או Docker:
```cmd
docker run -d --name taxipro-mongo -p 27017:27017 mongo:7
```

URI ברירת מחדל (ב-`server/.env.example`, בלי סודות חיים):
`MONGODB_URI=mongodb://127.0.0.1:27017/taxipro`

### 2.2 הפעלת ה-API
```cmd
START-API.bat
```
או:
```bash
cd server
cp .env.example .env   # אם חסר
npm install
npm run dev            # = node --watch src/index.js
```
מהשורש: `npm run dev:api` / `npm run api`.

Health: http://localhost:4000/health

אדמין מקומי (stub): `admin@taxi.co.il` / `123456`  
OTP מקומי: `123456` (`DEV_OTP` ב-`server/.env`).

### 2.3 חיבור ל-Login
1. `.env` בשורש: `VITE_WEBAPP_URL=http://localhost:4000`
2. מרכז שליטה → Login → גלגל השיניים → אותה כתובת → **Test**.

GAS נשאר ב-`GS/` כ-fallback / ארכיון — לא חובה ל-Ready מקומי.

---

## 3) מילוי `.env`

1. `SETUP.bat` מעתיק מ-`.env.example` אם חסר, או:
   ```cmd
   copy .env.example .env
   copy server\.env.example server\.env
   ```
2. מלאו לפחות: `VITE_WEBAPP_URL=http://localhost:4000` + `VITE_FIREBASE_*` למעקב חי.
3. אופציונלי: Gemini / Telegram / Bridge.
4. `bridge/.env`: `BRIDGE_API_KEY`, Mongo אם בשימוש לסשן WhatsApp.
5. **אל תעלו** `.env` לריפו.

---

## 4) הפעלת 2 המסכים

לחיצה כפולה על `SETUP.bat`:

- Mongo API: http://localhost:4000
- מרכז שליטה: http://localhost:5275/admin.html
- אפליקציית נסיעה: http://localhost:5273/app.html

הרצה חוזרת: `START-ALL.bat` (מסכים) + `START-API.bat` (אם ה-API לא רץ) + `START-MONGO.bat` (אם Mongo לא רץ).

```bash
npm run dev:api
npm run dev:ops
npm run dev:app
```

---

## 5) WhatsApp חדש (בוט + קבוצה)

1. לחיצה כפולה על `SETUP-BRIDGE.bat`.
2. Health: http://localhost:3000/health
3. סריקת QR (מפתח מ-`bridge/.env`):
   `http://localhost:3000/qr?role=dispatcher&key=YOUR_API_KEY`
4. צרו קבוצת תחנה **חדשה**, הוסיפו את הבוט, והעתיקו מזהה קבוצה להגדרות / `.env` לפי התבנית.
5. ודאו `BRIDGE_API_KEY` תואם ל-`VITE_BRIDGE_API_KEY`.

---

## 6) בדיקת הזמנה

1. מרכז שליטה → שיגור (`#/station-order` או `#/dispatch`).
2. צרו הזמנה לטלפון בדיקה.
3. באפליקציה → **נהג** → קבלה / שיוך.
4. עקבו אחרי סטטוס (מעקב חי דורש Firebase ב-`.env`).
5. עם Bridge — ודאו הודעה לקבוצה/לנוסע.

---

## פתרון בעיות

| תסמין | פעולה |
|--------|--------|
| API לא עולה | `START-MONGO.bat` ואז `npm run dev:api` |
| Test נכשל ב-Login | ודאו `http://localhost:4000/health` ו-`VITE_WEBAPP_URL` |
| Firebase לא מתחבר | בדקו `VITE_FIREBASE_*` ו-DB פעיל (realtime בלבד) |
| Bridge לא מגיב | `SETUP-BRIDGE.bat` · QR · מפתחות |
| URL ישן בדפדפן | Local Storage → מחקו `taxi_app_script_url` |

---

## קישורים

- [`GUIDE.md`](./GUIDE.md) · [`README.md`](./README.md) · [`DEPLOY.md`](./DEPLOY.md) · [`MICROCOPY.md`](./MICROCOPY.md)

*TAXIPRO / MONIT2 — Wave Mongo · Fresh Start*
