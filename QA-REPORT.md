# QA-REPORT — TAXIPRO / MONIT2

**סוכן:** בדיקות (QA & Security)  
**עדכון אחרון:** 2026-09-14 — Full local smoke אחרי `0462796` (throttle + DriverPortal GPS)  
**סביבה:** `dist/{passenger,driver,admin}` בלי `.env` / בלי bridge חי

## פסק דין נוכחי

**PASS — Ready לבדיקה מקומית של noma** (מסכים ציבוריים + build).

- `npm run typecheck` ירוק  
- `npm run build:all` ירוק  
- smoke מלא על 4 מסכים ציבוריים: **ALL_PASS**  
- אין `pageerror` / uncaught  
- favicon 200 בכל האפליקציות  
- אין `.env` בעץ; אין `AIza…` ב-dist

### מה עדיין לא נבדק (דורש `.env` + bridge)

מסלול קריטי מלא הזמנה→שיוך→מעקב חי, OTP, WhatsApp/Telegram, Admin dashboard מאובטח, Driver portal אחרי login.

---

## Full smoke — תוצאות

| מסך | כותרת | favicon | קריסה | הערות |
|---|---|---|---|---|
| Passenger `/` | TAXIPRO \| הזמנת מונית | 200 | לא | נחיתה RTL תקינה |
| Driver `/` | TAXIPRO \| פורטל נהג | 200 | לא | באנר setup בעברית (QA-2) |
| Admin `/` | TAXIPRO \| ניהול מערכת | 200 | לא | `מרכז שליטה` / `למורשים בלבד` |
| Admin `#/station-order` | כנ״ל | 200 | לא | טופס הזמנה + `מרכז שיגור חכם` |

צילומים: `qa-screenshots/full-*.png`

---

## סגירת ממצאי Wave 1/2

| ID | סטטוס | אימות |
|---|---|---|
| QA-1 Admin אנגלית | **Closed** | מרכז שליטה / למורשים בלבד |
| QA-2 Driver Script URL | **Closed** | הודעת setup בעברית |
| QA-3 indigo קריטי | **Closed** | 0 ב-Login/StationOrder/AdminDashboard |
| QA-4 favicon 404 | **Closed** | 200 |
| QA-6 SMART DISPATCH | **Closed** | מרכז שיגור חכם |

## בדיקות קוד (Wave 2)

| נושא | תוצאה |
|---|---|
| `throttle.ts` + שימוש ב-DriverPortal GPS | קיים; `throttledSync.cancel()` ב-cleanup |
| Firebase fail-safe `getDbOrWarn` | 17 שימושים ב-`firebase.ts` |
| Microcopy סטטוס | `מערכת מחוברת/מנותקת`; ErrorBoundary בעברית |
| `database.rules.json` | default-deny + auth (מאומת קודם) |

## ממצאים חדשים (לא חוסמים)

| ID | חומרה | תיאור | למי |
|---|---|---|---|
| QA-8 | P3 | `ServerStatusWidget` עדיין מציג נתיב ישן `f:\AVODOT\TAXI-WORK\whatsapp-taxi-bridge` בהוראות הפעלה | @סוכן תיעוד / מתכנת |
| QA-9 | Info | בלי `.env` Admin מציג «הגשר המקומי לא מגיב» — צפוי | — |

## המלצה ל-PM / noma

1. **Go לבדיקה מקומית** עם `.env` אמיתי + `START-ALL.bat` / `npm run bridge`  
2. DevOps: לוודא `0462796`+ על origin (כבר דווח)  
3. QA אחרי env: smoke על dashboard/portal + הזמנה אמיתית  
4. לתקן QA-8 בגל polish

