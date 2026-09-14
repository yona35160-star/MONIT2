# 🔐 מדריך ניהול מפתחות (ENV) ופריסה - TaxiWork

מדריך זה מרכז את כל הגדרות הסביבה והמפתחות הנדרשים להפעלת המערכת בייצור (Production).

---

## 1. מיפוי מוקדי הגדרות (Configuration Centers)

המערכת פועלת במבנה מבוזר, ולכן יש להגדיר את המפתחות ב-4 מקומות שונים:

### א. אפליקציית לקוח (Frontend - Netlify)
המפתחות משמשים את ה-React Apps (Vite) ומוזרקים בזמן ה-Build.

| מפתח | תיאור | מקור הערך |
| :--- | :--- | :--- |
| `VITE_FIREBASE_API_KEY` | מפתח API של Firebase | Firebase Console |
| `VITE_FIREBASE_PROJECT_ID` | מזהה הפרויקט ב-Firebase | Firebase Console |
| `VITE_WEBAPP_URL` | כתובת ה-Backend ב-GAS | Google Apps Script (Deploy > Web App) |
| `VITE_WHATSAPP_RENDER_URL` | כתובת שרת ה-Bridge | Render Dashboard |
| `VITE_BRIDGE_API_KEY` | מפתח אבטחה לחיבור ל-Bridge | הגדרה פנימית (חייב להתאים ל-Bridge) |

### ב. שרת ה-WhatsApp Bridge (Render)
מפתחות אלו מוגדרים ב-Dashboard של Render תחת Environment Variables.

| מפתח | תיאור | הערות |
| :--- | :--- | :--- |
| `BRIDGE_API_KEY` | מפתח אבטחה לכניסת בקשות | חייב להתאים ל-Frontend ול-GAS |
| `MONGO_URI` | מחרוזת חיבור ל-MongoDB Atlas | משמש לשמירת Session ונתונים |
| `GAS_SCRIPT_URL` | כתובת ה-Web App של GAS | לקבלת עדכוני מיקום וסטטוס |
| `TELEGRAM_BOT_TOKEN` | טוקן בוט טלגרם להתרעות | לדיווח על קריסות שרת |
| `TELEGRAM_CHAT_ID` | מזהה צ'אט לקבלת התרעות | Chat ID של המנהל/קבוצה |

### ג. שרת ה-Backend (Google Apps Script)
מפתחות אלו מוגדרים בגיליון `Settings` או ב-`Script Properties`.

| מפתח | תיאור | מיקום מומלץ |
| :--- | :--- | :--- |
| `ADMIN_PASSWORD` | סיסמת כניסה לממשק הניהול | Script Properties (מוצפן) |
| `FIREBASE_AUTH_SECRET` | סוד לאימות מול Firebase | Script Properties |
| `GOOGLE_MAPS_API_KEY` | מפתח API למפות וחיפוש כתובות | Script Properties |
| `TARGET_GROUP_JID` | מזהה קבוצת הוואטסאפ לשידור | מתקבל מהבוט ע"י פקודת `jid` |

### ד. מסד נתונים בזמן אמת (Firebase)
הגדרות אלו נמצאות בקבצי הקונפיגורציה של Firebase.

| קובץ | תפקיד | פקודת פריסה |
| :--- | :--- | :--- |
| `firebase.json` | הגדרות אירוח ופונקציות | `firebase deploy --only hosting` |
| `database.rules.json` | חוקי אבטחה ל-Realtime DB | `firebase deploy --only database` |

---

## 2. שלבי פריסה (Deployment Workflow)

### שלב 1: פריסת ה-Backend (GAS)
1. פתח את ה-Editor של Google Apps Script.
2. לחץ על **Deploy > New Deployment**.
3. בחר **Web App** והעתק את ה-URL שהתקבל.

### שלב 2: פריסת ה-Bridge (Render)
1. ודא שכל ה-Environment Variables מוגדרים ב-Render.
2. בצע Push ל-GitHub. השרת יתעדכן אוטומטית.
3. העתק את ה-URL של Render (למשל `https://taxi-bridge.onrender.com`).

### שלב 3: פריסת ה-Frontend (Netlify)
1. עדכן את ה-URLs של GAS ו-Render ב-Netlify Environment Variables.
2. בצע Build & Deploy.

---

## 3. בדיקת תקינות (Health Check)
לאחר הפריסה, ודא שהמערכת פועלת ע"י:
1. בדיקת ה-URL של Bridge: `https://your-bridge.onrender.com/health` (צריך להחזיר JSON עם `status: ok`).
2. שליחת הודעת `test` מהדאשבורד של האדמין.
3. בדיקת לוגים בגיליון `Logs` ב-Google Sheets.
