# 🔐 מדריך ניהול מפתחות (ENV) ופריסה - TaxiWork v4

מדריך זה מפרט את ניהול משתני הסביבה (Environment Variables) והגדרות האבטחה עבור המעבר לארכיטקטורת **Firebase-First**.

## 🔑 ניהול מפתחות (Script Properties)

ב-Google Apps Script, מפתחות רגישים מאוחסנים ב-`Script Properties` כדי למנוע חשיפה שלהם בגיליון ה-Settings הציבורי.

| מפתח (Key) | תיאור | מקור / איפה למצוא | רמת סיכון |
| :--- | :--- | :--- | :--- |
| `FIREBASE_AUTH_SECRET` | מפתח Legacy לחיבור Firebase RTDB | Firebase Console > Project Settings > Service Accounts > Database Secrets | 🔴 קריטי |
| `FIREBASE_PROJECT_ID` | מזהה הפרויקט ב-Firebase | Firebase Console | 🟡 בינוני |
| `FIREBASE_DB_URL` | כתובת בסיס הנתונים בזמן אמת | Firebase Console > Realtime Database | 🟠 גבוה |
| `GOOGLE_MAPS_API_KEY` | מפתח לחישוב מרחקים ומפות | Google Cloud Console | 🟠 גבוה |
| `BRIDGE_API_KEY` | מפתח לחיבור ל-WhatsApp Bridge | Render Dashboard (Environment) | 🟠 גבוה |

---

## 🚀 שלבי פריסה (Deployment Workflow)

כדי להפעיל את המערכת החדשה, יש לבצע את השלבים הבאים לפי הסדר:

### 1. הכנת התשתית (Infrastructure Prep)
1. וודא שקובץ `firebase-config.ts` ב-Frontend מכיל את ההגדרות הנכונות.
2. וודא ש-`Script Properties` ב-GAS מכילים את `FIREBASE_AUTH_SECRET`.

### 2. סנכרון נתונים היסטורי (Data Seeding)
בתוך עורך ה-GAS, הרץ את הפונקציה:
- `runFirebaseSyncAll()` -> מעלה את כל הנהגים, הלקוחות וההזמנות מהגיליון ל-Firebase.

### 3. אימות וביקורת (Verification)
הרץ את הפונקציה:
- `runFirebaseVerify()` -> בודק התאמה בין הגיליון ל-Firebase ומדווח על חוסרים.

### 4. הפעלה רשמית (Go-Live)
הרץ את הפונקציה:
- `runEnableDualWrite()` -> מפעיל את הדגל `ENABLE_FIREBASE_SYNC` לצמיתות.

---

## 🛠 ניהול דגלים (Feature Flags)

ניתן לשלוט בהתנהגות המערכת בזמן אמת דרך `ArchitectureSwitch.gs`:

| דגל (Flag) | תיאור | מצב מומלץ |
| :--- | :--- | :--- |
| `ENABLE_FIREBASE_SYNC` | האם לסנכרן כל כתיבה ל-Firebase | **true** (אחרי סנכרון מלא) |
| `USE_FIREBASE_REALTIME_DB` | האם ה-Frontend מעדיף נתונים מ-Firebase | **true** (מוגדר ב-Frontend) |

---

## 🛡 אבטחה וביצועים (Security & Scale)

- **Sanitization**: כל הנתונים עוברים ניקוי אוטומטי (`Firebase.sanitizeKey`) לפני השליחה כדי למנוע שגיאות תווים אסורים ב-Firebase.
- **Non-blocking**: סנכרון הנתונים מתבצע בתוך `try-catch` בנפרד מהגיליון, כך שאם Firebase איטי, הגיליון לא נתקע.
- **Masking**: מפתחות רגישים בגיליון ה-Settings מוחלפים אוטומטית ב-`[SECURELY_STORED_IN_PROPS]`.

> [!IMPORTANT]
> לעולם אל תשתף את ה-URL של ה-Script Properties או את ה-Database Secret של Firebase. במקרה של דליפה, יש להחליף את המפתחות ב-Firebase Console ולעדכן ב-GAS מיד.
