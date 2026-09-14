# 🚖 TAXIPRO — מערכת דיספאצ'ר חכמה לניהול צי מוניות (v2.0)

מערכת אקו-סיסטם מלאה לניהול הזמנות מוניות בזמן אמת, משולבת **WhatsApp**, **Telegram**, **Firebase** ו-**AI**. המערכת עברה Audit מקיף (אפריל 2026) והיא מותאמת לייצור (Production) עם דגש על יציבות, אבטחה וחוויית משתמש פרימיום.

---

## 🏗️ ארכיטקטורת המערכת (Post-Audit)

המערכת מורכבת מ-4 רכיבים מרכזיים המסונכרנים ביניהם:

1.  **Frontend (Vite + React + TS):** 
    *   📱 **Passenger App**: הזמנה מהירה, מעקב חי ודירוג.
    *   🚕 **Driver App**: קבלת נסיעות, ניווט וניהול רווחים.
    *   🖥️ **Admin System**: שליטה מלאה, מפת נהגים חיה, וסיכומי מנהלים מבוססי AI.
2.  **Backend (Google Apps Script):** "המוח" שמנהל את בסיס הנתונים (Google Sheets), הלוגיקה העסקית וחישובי המחיר.
3.  **Real-time DB (Firebase):** סנכרון מיקומי נהגים ועדכוני סטטוס נסיעה בשידור חי.
4.  **Messaging Bridge (Node.js):** מגשר ייעודי (מבוסס Baileys) לשליחת הודעות WhatsApp ודיווחי שגיאות ל-Telegram.

---

## 🚀 מדריך התקנה והרצה מהיר

### 1. דרישות קדם
*   Node.js (גרסה 18 ומעלה)
*   חשבון Firebase (מסלול חינמי)
*   Google Sheets (עבור ה-Backend)
*   חשבון MongoDB Atlas (עבור שמירת ה-Session של הוואטסאפ)

### 2. הגדרת בסיס הנתונים (Apps Script)
1. צור קובץ Google Sheets חדש.
2. העלה את הקבצים מתיקיית `GS/` לתוך ה-Apps Script.
3. הרץ פעם אחת את פונקציית ה-`setupSystem`.
4. בצע **Deployment** בתור Web App (חשוב: גישה ל-"Everyone") והעתק את ה-URL.

### 3. הגדרת ה-Bridge (WhatsApp)
ה-Bridge מאפשר למערכת "לדבר" בוואטסאפ.
1. הכנס לתיקיית `bridge/`.
2. הרץ `npm install`.
3. הגדר בקובץ `.env` בתוך התיקייה את ה-`MONGO_URI` שלך.
4. להרצה מקומית וסריקת QR: הרץ את `control-panel.bat` או `npm run dev`.
5. לאחר הסריקה, ה-Session יישמר ב-Mongo וניתן להעלות את התיקייה ל-**Render**.

### 4. הגדרת ממשק המשתמש (React)
1. בשורש הפרויקט, הרץ `npm install`.
2. העתק את `.env.example` ל-`.env` והזן את המפתחות (Firebase, Apps Script, Gemini AI, Telegram).
3. **הרצה מקומית:**
   *   אדמין: `npm run dev:admin`
   *   נהג: `npm run dev:driver`
   *   נוסע: `npm run dev:passenger`

---

## 🛠️ פקודות חשובות (Scripts)

| פקודה | תיאור |
| :--- | :--- |
| `npm run dev` | הרצה של הדשבורד המרכזי |
| `npm run build:all` | בנייה של כל 3 האפליקציות לתיקיית `dist/` |
| `npm run bridge:multi` | הרצת מגשר הוואטסאפ (3 בוטים במקביל) |
| `npm run build:apps:admin` | בנייה ייעודית רק למערכת הניהול |

---

## 🤖 יכולות AI משולבות
המערכת משתמשת ב-**Gemini 1.5 Flash** (חינמי) עבור:
*   **Smart Command Box:** יצירת הזמנות מטקסט חופשי (NLP).
*   **Executive Briefing:** הפקת דוחות סיכום יומיים למנהל התחנה.
*   **Smart Assigner:** המלצה על הנהג המתאים ביותר לפי מרחק והקשר.

---

## 🏥 ניטור ותקינות (Health Monitoring)
*   **Telegram Alerts:** המערכת מדווחת אוטומטית לבוט הטלגרם על ניתוקי וואטסאפ או שגיאות שרת קריטיות.
*   **Audit Compliance:** הקוד כולל ניקוי זיכרון (Cleanup) ל-Listeners והגבלת כמות נתונים (Rate Limiting) למניעת עומס.

---
**נבנה עבור מערך הדיספאצ'ינג המתקדם בישראל.** 🚕✨
