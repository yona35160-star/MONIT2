# START — TAXIPRO / MONIT2 (Wave Mongo)

מדריך ממוספר ל-noma. **Mongo = מקור האמת.** Sheets/GAS בנספח מעבר בלבד.
2 מסכים: מרכז שליטה + אפליקציית נסיעה. ראו גם `ARCHITECTURE.md`.

> אל תדחפו `.env` / מפתחות ל-GitHub.

---

## סקירה מהירה

| # | שלב | תוצאה |
|---|-----|--------|
| 1 | Mongo מקומי **או** Atlas | `MONGODB_URI` |
| 2 | Firebase (זמני ל-Realtime) | `VITE_FIREBASE_*` |
| 3 | מילוי `.env` / `server/.env` / `bridge/.env` | API על `:4000` |
| 4 | `SETUP.bat` / `npm run dev:api` | Mongo + API `:4000` + 2 מסכים |
| 5 | `SETUP-BRIDGE.bat` + QR + קבוצה | WhatsApp |
| 6 | בדיקת הזמנה | הזמנה → שיוך → מעקב |

---

## 1) MongoDB

### אפשרות א — מקומי (ברירת מחדל)

1. התקינו [MongoDB Community Server](https://www.mongodb.com/try/download/community) (Windows).
2. לחיצה כפולה על `START-MONGO.bat`  
   - מנסה `net start MongoDB` (ייתכן שצריך UAC/מנהל)  
   - אחרת מריץ `mongod` עם `data\mongo`
3. URI: `mongodb://127.0.0.1:27017/taxipro`
4. בדקו: `mongosh mongodb://127.0.0.1:27017/taxipro --eval "db.runCommand({ping:1})"`
5. חלופה Docker: `docker run -d --name taxipro-mongo -p 27017:27017 mongo:7`

### אפשרות ב — MongoDB Atlas (ענן, בלי התקנה מקומית)

1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) → Free cluster.
2. Database Access → משתמש + סיסמה.
3. Network Access → IP שלכם (או `0.0.0.0/0` לפיתוח בזהירות).
4. Connect → Drivers → העתיקו URI בסגנון:  
   `mongodb+srv://USER:PASS@CLUSTER.mongodb.net/taxipro`
5. שימו את ה-URI ב-`server/.env` ו-`bridge/.env` כ-`MONGODB_URI` (מקומי בלבד).

---

## 2) Firebase (זמני — Phase 1)

Realtime בלבד עד Phase 2 (Socket/Change Streams).  
Firebase Console → פרויקט חדש → Realtime Database → העתיקו `VITE_FIREBASE_*` ל-`.env`.

---

## 3) מילוי env

```cmd
copy .env.example .env
copy server\.env.example server\.env
copy bridge\.env.example bridge\.env
```

ערכים חשובים:

| קובץ | מפתח | ערך לדוגמה |
|------|------|------------|
| `.env` | `VITE_WEBAPP_URL` | `http://localhost:4000` |
| `server/.env` | `MONGODB_URI` | מקומי או Atlas |
| `server/.env` | `PORT` | `4000` |
| `bridge/.env` | `MONGODB_URI` | אותו URI |
| `bridge/.env` | `BRIDGE_API_KEY` | מחרוזת אקראית חזקה |

`SETUP.bat` מעתיק תבניות אם חסרות.

---

## 4) הפעלה בלחיצה אחת

`SETUP.bat`:

1. מפעיל Mongo (`START-MONGO.bat`)
2. `npm install` (root + bridge + `server/` אם קיים)
3. מריץ API על `:4000` כש-`server/` קיים
4. פותח Ops + Ride App

- מרכז שליטה: http://localhost:5275/admin.html  
- אפליקציית נסיעה: http://localhost:5273/app.html  
- API: http://localhost:4000  

הרצה חוזרת: `START-ALL.bat`.

---

### כניסת פיתוח מקומית (stubs — לא לפרודקשן)

- אדמין: `admin@taxi.co.il` / `123456`
- OTP: `123456` (`DEV_OTP`)
- חוזה API כמו GAS: `POST /` עם `{ action, payload, authToken }`

## 5) WhatsApp

`SETUP-BRIDGE.bat` → health `http://localhost:3000/health` → QR → קבוצה חדשה.

---

## 6) בדיקת הזמנה

1. Login במרכז שליטה — כתובת שרת: `http://localhost:4000` (או ריק עד שממלאים).
2. שיגור הזמנה → נהג באפליקציה → מעקב (Firebase זמני).

---

## נספח — GAS / Sheets (מעבר בלבד)

לא ברירת מחדל. אין פיצ'רים חדשים ב-Sheets. אם עדיין צריך Web App ישן — ראו היסטוריית GUIDE; העדיפות היא `server/` + Mongo.

---

## פתרון בעיות

| תסמין | פעולה |
|--------|--------|
| Mongo service לא עולה | הרצה כמנהל / `START-MONGO.bat` / Atlas |
| API :4000 לא עונה | `cd server && npm run dev` · בדקו `MONGODB_URI` |
| Bridge בלי session | אותו `MONGODB_URI` ב-`bridge/.env` |
| UAC חוסם service | mongod דרך `START-MONGO.bat` או Atlas |

*TAXIPRO — Wave Mongo*
