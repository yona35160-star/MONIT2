# START — התחלה מחדש (Fresh Start) ל-noma

מדריך ממוספר להרמת **TAXIPRO / MONIT2** על תשתית חדשה לגמרי.
2 מסכים בלבד: מרכז שליטה + אפליקציית נסיעה.

> אל תדחפו `.env` / מפתחות ל-GitHub. רק תבניות `.env.example`.

---

## סקירה מהירה

| # | שלב | תוצאה |
|---|-----|--------|
| 1 | Firebase חדש | ערכי `VITE_FIREBASE_*` |
| 2 | Google Sheet + GAS חדש | URL של Web App ל-Login ול-`.env` |
| 3 | מילוי `.env` | קובץ מקומי בלבד |
| 4 | `SETUP.bat` | 2 מסכים רצים |
| 5 | `SETUP-BRIDGE.bat` + QR + קבוצה | WhatsApp חדש |
| 6 | בדיקת הזמנה | הזמנה → שיוך → מעקב |

---

## 1) Firebase חדש

1. היכנסו ל-[Firebase Console](https://console.firebase.google.com/) → **Add project**.
2. הוסיפו **Realtime Database** (למשל `europe-west1`).
3. Project Settings → Your apps → Web → העתיקו: `apiKey`, `authDomain`, `databaseURL`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` (+ `measurementId` אם יש).
4. (מומלץ) יישמו כללים לפי `database.rules.json`.
5. שמרו את הערכים למילוי ב-`.env` בסעיף 3.

---

## 2) Google Sheet + Apps Script חדש (GAS)

### 2.1 יצירת Sheet
1. [Google Sheets](https://sheets.google.com/) → גיליון ריק חדש.
2. שם מומלץ: `TAXIPRO-MONIT2-Fresh`.

### 2.2 העלאת הקוד מ-`GS/`
1. בגיליון: **Extensions → Apps Script**.
2. מחקו קבצי ברירת מחדל אם קיימים.
3. העתיקו את כל הקבצים מתיקיית `GS/` שבפרויקט (כולל `SystemSetup.gs`, `Config.gs`, `Order.gs` וכו') לפרויקט ה-Apps Script.
   - ידנית קובץ-קובץ, או עם `clasp` מול `GS/.clasp.json` אחרי התחברות.
4. שמרו (Ctrl+S).

### 2.3 הרצת Setup ראשונה
1. בחרו את הפונקציה **`setupSystemFull`** (`SystemSetup.gs`).
2. **Run** → אשרו הרשאות לחשבון Google.
3. בדקו בלוג שאין כשלים קריטיים.

### 2.4 Deploy כ-Web App
1. **Deploy → New deployment**.
2. סוג: **Web app**.
3. Execute as: **Me**.
4. Who has access: **Anyone**.
5. **Deploy** → העתיקו את ה-URL שנראה כמו:
   `https://script.google.com/macros/s/…/exec`

### 2.5 חיבור ל-Login ול-.env
1. מרכז שליטה → Login → גלגל השיניים.
2. הדביקו את ה-URL בשדה **כתובת שרת** (השדה מתחיל **ריק** — בלי ברירת מחדל חיה).
3. **Test** עד להצלחה, ואז התחברות עם פרטי האדמין מ-`Config.gs` / ה-Setup.
4. שימו את אותו URL ב-`.env` כ-`VITE_WEBAPP_URL`.

---

## 3) מילוי `.env`

1. `SETUP.bat` מעתיק מ-`.env.example` אם חסר, או:
   ```cmd
   copy .env.example .env
   ```
2. מלאו לפחות: `VITE_WEBAPP_URL` + כל `VITE_FIREBASE_*`.
3. אופציונלי: Gemini / Telegram / Bridge.
4. `bridge/.env`: `BRIDGE_API_KEY`, `GAS_SCRIPT_URL` (אותו URL), Mongo אם בשימוש.
5. **אל תעלו** `.env` לריפו.

---

## 4) הפעלת 2 המסכים

לחיצה כפולה על `SETUP.bat` ב-`C:\Users\Pc\MONIT2-sync`:

- מרכז שליטה: http://localhost:5275/admin.html
- אפליקציית נסיעה: http://localhost:5273/app.html

הרצה חוזרת: `START-ALL.bat`.

```bash
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
| שדה כתובת שרת ריק | תקין ב-Fresh Start — הדביקו URL מ-Deploy |
| Test נכשל | Deploy מחדש · הרשאות · `setupSystemFull` |
| Firebase לא מתחבר | בדקו `VITE_FIREBASE_*` ו-DB פעיל |
| Bridge לא מגיב | `SETUP-BRIDGE.bat` · QR · מפתחות |
| URL ישן בדפדפן | Local Storage → מחקו `taxi_app_script_url` |

---

## קישורים

- [`GUIDE.md`](./GUIDE.md) · [`README.md`](./README.md) · [`DEPLOY.md`](./DEPLOY.md) · [`MICROCOPY.md`](./MICROCOPY.md)

*TAXIPRO / MONIT2 — Fresh Start*