# TAXIPRO — מדריך הרצה ובדיקה עצמית

עדכון אחרון: 2026-09-15

תיקיית העבודה: `C:\Users\Pc\MONIT2-sync`

---

## מה רץ

| שירות | כתובת | הערה |
|--------|--------|------|
| Node API + Mongo Atlas | http://localhost:4000 | חייב `/health` עם `mongo:true` |
| Control Center (מנהל + תחנה) | http://localhost:5275/admin.html | |
| Ride app (נוסע + נהג) | http://localhost:5273/app.html | |
| WhatsApp Bridge | `SETUP-BRIDGE.bat` | סריקת QR בטלפון |

---

## לפני הכל (פעם אחת)

1. Node.js מותקן.
2. בתיקייה: `npm install` וגם `npm --prefix server install` אם צריך.
3. קבצי סביבה מקומיים (לא ב-Git):
   - `server/.env` — `MONGODB_URI=...` (Atlas)
   - `bridge/.env` — אותו `MONGODB_URI` + מפתחות Bridge
   - `.env` בשורש — `VITE_WEBAPP_URL=http://localhost:4000`
4. **אל תעתיק סיסמאות לצ'אט / אל תעשה commit ל-`.env`.**

---

## הפעלה מהירה

### אפשרות א׳ — סקריפטים

1. API: הרץ `START-API.bat` (או מתיקיית `server`: `npm run dev`)
2. שתי האפליקציות: `SETUP.bat` או `START-ALL.bat`
3. WhatsApp (אופציונלי): `SETUP-BRIDGE.bat` ← סרוק QR

### אפשרות ב׳ — ידני (PowerShell)

```powershell
cd C:\Users\Pc\MONIT2-sync
npm run dev:api
# חלון נוסף:
npm run dev:ops
# חלון נוסף:
npm run dev:app
```

---

## בדיקת Smoke (סמן)

- [ ] `http://localhost:4000/health` → `"ok":true,"mongo":true`
- [ ] Login אדמין: `admin@taxi.co.il` / `123456`
- [ ] בשדה GAS / WebApp URL: **ריק** או `http://localhost:4000` (לא לינק GAS ישן)
- [ ] Control Center נפתח אחרי Login
- [ ] Ride app נפתח (`/app.html`) עם בחירת תפקיד
- [ ] יצירת הזמנת נסיעה (מהממשק או דרך API)
- [ ] (אופציונלי) WhatsApp: QR נסרק והבוט מחובר

### בדיקת API מהירה (PowerShell)

```powershell
Invoke-RestMethod http://localhost:4000/health

$body = @{ action='loginAdmin'; email='admin@taxi.co.il'; password='123456' } | ConvertTo-Json
Invoke-RestMethod http://localhost:4000/ -Method Post -Body $body -ContentType 'application/json; charset=utf-8'
```

---

## פתרון תקלות

| בעיה | מה לעשות |
|------|-----------|
| `/health` עם `mongo:false` | בדוק `server/.env` → `MONGODB_URI`; Atlas Network Access |
| פורט תפוס (4000/5273/5275) | סגור תהליך node ישן והפעל מחדש |
| Login נכשל / שגיאת רשת | ודא ש-API רץ ו-`VITE_WEBAPP_URL=http://localhost:4000` |
| מסך מבקש GAS ישן | השאר שדה ריק; אל תדביק לינק Apps Script |
| Bridge לא עולה | הרץ `SETUP-BRIDGE.bat` מתוך התיקייה; ודא `BRIDGE_API_KEY` ב-`bridge/.env` |

---

## אבטחה

- סיסמת Atlas רק ב-`.env` מקומי.
- אם הסיסמה דלפה — סובב ב-Atlas (Database Access) ועדכן רק ב-`.env`.
- ה-API לא אמור להדפיס את ה-URI המלא ללוג.

---

## אחרי שהכל ירוק אצלך

נתיב קריטי: Login → לוח בקרה → הזמנה → שיוך נהג → מעקב → WhatsApp.
