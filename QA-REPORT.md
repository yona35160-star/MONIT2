# QA-REPORT — TAXIPRO / MONIT2 — Wave Unify

**סוכן:** בדיקות (QA & Security)  
**תאריך:** 2026-09-15  
**קומיטים:** `e6c8f1d` / `b2f3969` / `c9843eb` (+ BAT ללחיצה אחת)  
**סביבה:** `npm run dev:ops` :5275 + `npm run dev:app` :5273 — בלי `.env` אמיתי, בלי bridge

## פסק דין

**PASS — Ready מקומי ל-noma על 2 המסכים.**

`npm run typecheck` ירוק. Smoke על `admin.html` + `app.html` כולל בחירת תפקיד והחלפה: **ירוק**.  
Live data / login מאובטח / WhatsApp עדיין דורשים `.env` חדש + `SETUP-BRIDGE.bat` (צעד ידני מ-noma).

## Unify smoke

| בדיקה | URL | תוצאה |
|---|---|---|
| Ops login | `http://localhost:5275/admin.html` | PASS — מרכז שליטה / למורשים בלבד |
| Alias `#/station` | `admin.html#/station` | PASS — טופס הזמנה |
| Alias `#/dispatch` | `admin.html#/dispatch` | PASS — טופס הזמנה |
| Role picker | `http://localhost:5273/app.html` | PASS — כרטיסי נוסע/נהג |
| בחירת נוסע + סרגל | לחצן «נוסע» | PASS — `החלף תפקיד` + מסך התחברות |
| החלף תפקיד | סרגל | PASS — חזרה ל-picker |
| בחירת נהג | לחצן «נהג» | PASS — פורטל נהגים |
| הפניית `passenger.html` | dev:app | PASS פונקציונלי (נוחת `/?role=passenger` במקום `/app.html` בגלל Vite mode) |

אין `pageerror` / uncaught. צילומים: `qa-screenshots/unify-*.png`

## ממצאים לא-חוסמים

| ID | חומרה | תיאור | למי |
|---|---|---|---|
| QA-10 | P3 | `SETUP.bat` מסתיים ב-`pause` (Enter אחרי שהאפליקציות כבר עלו) | DevOps |
| QA-11 | P3 | Ops עדיין מציג «הפעל START-ALL.bat» לגשר — צריך `SETUP-BRIDGE.bat` | תיעוד |
| QA-12 | P3 | Role picker מציג `admin.html` כטקסט למשתמש («נמצא ב־admin.html») | תיעוד/עיצוב |
| QA-13 | Info | קונסול: PWA script MIME (`text/html`) ב-dev — לא שובר UI | מתכנת Wave הבא |

## אבטחה

- אין `.env` בריפו שנבדק; SETUP מעתיק `.env.example` רק אם חסר  
- לא נבדקו מפתחות חיים / Firebase חדש

## המלצה ל-PM

1. להכריז **Ready מקומי** ל-noma: `SETUP.bat` או `START-ALL.bat` → 5275/admin + 5273/app  
2. noma ממלא `.env` (Firebase/GAS/WhatsApp חדשים) ומריץ `SETUP-BRIDGE.bat` כשמוכן  
3. Polish: QA-10..12
