# Design Notes — v2.0 Fresh Start

## Direction
Full visual refresh: **amber taxi** accent on **deep charcoal** surfaces. Typography: **Heebo** first (Hebrew).

## Apply
1. Load Google Font Heebo in HTML entries / CSS.
2. Remap Tailwind `primary` palette to amber scale (see design-system.json).
3. Surfaces: `#0B0F14` bg, `#141A22` cards.
4. Login (ops): keep padlock motif; amber glow instead of sky-blue.
5. Ride RolePicker: amber CTAs, charcoal cards.

## Do not
- Keep old sky `#0EA5E9` as primary.
- Keep indigo leftovers.

## v2.1 Dual theme (2026-09-15)
- **Dark (default):** GitHub-like canvas `#0d1117` / `#161b22` / border `#30363d`
- **Light:** Amazon-day `#EAEDED` / white cards / border `#D5D9D9` / warm CTA
- Brand CTA unchanged: `#F5A524`
- Toggle classes: `html.theme-light` + `html.admin-light` (compat)
- CSS vars: `--tp-*` for app chrome; `--admin-*` mapped for Control Center
