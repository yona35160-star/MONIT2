# Design Wave 1 — הערות מסירה

## מה נעשה
1. `design-system.json` — מקור אמת לטוקנים, תפקידים (passenger/driver/admin), רדיוסים, כללים.
2. יישור `Button` מ-indigo/gray אד-הוק לטוקני `primary` / `accent` / `danger` (+ `outline`).
3. רכיבים חדשים ב-`src/components/ui/`: `Badge`, `Card`, `Input`, `Spinner`, ו-`index.ts`.
4. `Spinner` לפי תפקיד — מחליף loaders כפולים באפליקציות.

## אי-עקביות שזוהו (למתכנת / Wave 2 polish)
- `Button` הישן השתמש ב-`indigo` בניגוד ל-`.btn-primary` ב-CSS ול-`primary-*` ב-Tailwind.
- Tailwind `fontFamily.sans` היה Heebo; `index.css` body משתמש ב-Rubik — עדיפות: Rubik → Heebo → Inter.
- צבעי brand ב-CSS (`--brand-primary: #1E40AF`) שונים מ-`primary-500` (#0EA5E9). מקור האמת לכפתורים/CTA: `design-system.json` + סולם `primary`/`accent` ב-Tailwind. `--admin-*` נשאר ל-Admin בלבד.

## שימוש
```tsx
import { Button, Badge, Card, Input, Spinner } from '../components/ui';
```

## QA-3 (2026-09-14)
הוחלפו כל מופעי `indigo-*` ב-`src/` בטוקני `primary-*` לפי `design-system.json`. מסלול קריטי (Login / StationOrder / AdminDashboard / DriverPortal / PassengerApp) + רכיבים נלווים + `btn-premium` ב-CSS.

## Wave 2 polish — empty/loading/error (2026-09-14)
- רכיבים חדשים: `EmptyState`, `AlertBanner` ב-`src/components/ui/`
- שולבו במסלול קריטי: DriverPortal (Spinner+EmptyState), StationOrder (EmptyState+AlertBanner), OrderStatus/DriverLogin/CustomerOrder (AlertBanner)
