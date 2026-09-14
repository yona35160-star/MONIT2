# QA-REPORT — TAXIPRO / MONIT2 — Wave 1 Smoke

**סוכן:** בדיקות (QA & Security)  
**תאריך:** 2026-09-14  
**סביבה:** build סטטי מ-`dist/{passenger,driver,admin}` (בלי `.env` אמיתי, בלי bridge)  
**פקודות:** `npm run typecheck` ירוק; Chrome headless על פורטים 5273 / 5274 / 5275

## פסק דין

**PASS עם ממצאים לא-חוסמים.** מותר לדחוף ל-GitHub / להמשיך preview.

אין קריסת runtime בשלוש האפליקציות. מסלול קריטי **הזמנה** נגיש בטופס תחנה (`#/station-order`). **שיוך→מעקב חי** לא נבדקו end-to-end — דורשים `VITE_WEBAPP_URL` + Firebase.

## Smoke E2E

| אפליקציה | URL | כותרת | קריסה | הערות |
|---|---|---|---|---|
| Passenger | `http://127.0.0.1:5273/` | TAXIPRO \| הזמנת מונית | לא | נחיתה RTL תקינה, כפתורי התחברות/הרשמה |
| Driver | `http://127.0.0.1:5274/` | TAXIPRO \| פורטל נהג | לא | מסך הזדהות עלה; באנר שגיאת Script URL (צפוי בלי env) |
| Admin | `http://127.0.0.1:5275/` | TAXIPRO \| ניהול מערכת | לא | לוגין עלה; כותרות באנגלית |
| Admin station-order | `http://127.0.0.1:5275/#/station-order` | כנ״ל | לא | טופס הזמנה מלא (שם, טלפון, איסוף, יעד, תעריף, תשלום) |

`pageerror` / uncaught: **0** בכל המסכים.  
Firebase fail-safe: `src/services/firebase.ts` מדלג על listeners כשאין `db` — מאושר בקוד.

צילומים: `qa-screenshots/passenger.png`, `driver.png`, `admin.png`, `admin-station-order.png`

## ממצאים

### P2 — לא חוסם

| ID | אזור | תיאור | למי |
|---|---|---|---|
| QA-1 | Admin login | כותרות באנגלית: `Smart Central` / `Authorized Personnel Only` (`src/pages/Login.tsx`). תיעוד דיווח שתוקן לעברית — **לא מופיע בבילד שנבדק**. | @סוכן תיעוד |
| QA-2 | Driver login | באנר שגיאה אדום תמיד בלי `VITE_WEBAPP_URL` (`DriverLogin.tsx`). לא קורס, אבל מלחיץ ב-clone מבודד. עדיף מצב שקט/setup. | @סוכן מתכנת |
| QA-3 | Design | שאריות `indigo-*` במסלול קריטי: `Login.tsx`, `StationOrder.tsx`, `AdminDashboard.tsx`, ועוד — בניגוד ל-Design System (בלי indigo). | @סוכן עיצוב |
| QA-4 | Assets | `favicon.ico` מחזיר 404 בשלוש האפליקציות. | @סוכן מתכנת / DevOps |

### P3 — מידע / Wave 2

| ID | תיאור |
|---|---|
| QA-5 | בלי `.env`: live track, GAS, WhatsApp bridge לא נבדקו. Admin מציג «הגשר המקומי לא מגיב» — צפוי. |
| QA-6 | Admin station-order: תת-כותרת אנגלית `SMART DISPATCH HUB`. |
| QA-7 | `PassengerApp` ב-`BrowserRouter`; Driver/Admin ב-`HashRouter`. בסדר ל-Vercel per-app; לערבב preview באותו origin עלול לשבור deep links של נוסע. |

## אבטחה (סריקה בסיסית)

| בדיקה | תוצאה |
|---|---|
| `.env` / `.env.local` בעץ | לא נמצאו |
| `.gitignore` כולל `.env` + `!.env.example` | תקין (גם `bridge/.env` נתפס ע״י `.env`) |
| `database.rules.json` | default-deny; קריאה/כתיבה דורשות `auth`; כתיבת מיקום נהג מוגבלת ל-uid/admin |
| Firebase init | placeholder לא קורא `initializeApp` |
| מפתחות hardcoded ב-`src/` | לא נמצא `AIza…` |

**הערה:** מפתחות `VITE_*` ייכנסו ל-JS של הלקוח אחרי build עם env אמיתי — זה המודל הנוכחי, לא באג Wave 1.

## מה לא נבדק (חסימות סביבה)

- הזמנה אמיתית דרך GAS
- שיוך נהג + מעקב Firebase
- OTP / WhatsApp / Telegram
- `GET /health` של ה-bridge בזמן ריצה (יש מסמך DevOps; אין תהליך חי כאן)

## המלצת המשך

1. **DevOps:** דחיפה ל-GitHub (בלי `.env`) + preview Vercel.  
2. **תיעוד:** ליישר Admin login לעברית בבילד בפועל (QA-1, QA-6).  
3. **עיצוב:** ניקוי indigo במסלול קריטי (QA-3) — Wave 2 polish.  
4. **QA Wave 2:** רגרסיה עם `.env` אמיתי + bridge.

## עדכון תיעוד

**QA-1/QA-6 נסגרו** ע״י סוכן תיעוד (מקור ב-C:\Users\Pc\MONIT2-sync): Login בעברית; מרכז שיגור חכם ב-CreateOrderModal. נדרש rebuild לאימות בבילד.
