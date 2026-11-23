# Phase 1 review, round 2: buttons and sign-in hero

Date: 2026-11-20. Status: **waiting for approval of these two only** (A buttons, B sign-in hero). The eSIM
card is unchanged. Screenshots, recording and raw measurements: `review-artifacts/phase-1-r2/` (not
committed).

## A. Buttons

- Primary: 44px (sm 36, lg 52), radius 12, gradient `#1A8FFF → #0070E6`, 1px inner top highlight 25% white,
  1px border 12% white, Geist 500 15px, −0.01em, white. Optional trailing arrow (`arrow` prop) slides 2px
  right on hover.
- Hover: soft Azure outer glow (24px blur) fades in over 200 ms, plus a radial light following the cursor.
  Press: scale 0.98 in 120 ms, no bounce. Focus: 2px Azure ring with a soft 4px glow.
- Secondary: glass (white 6% dark, 70% light), 1px border 10% → 18% on hover, faint inner light.
- Ghost, outline and destructive follow the same craft; destructive uses `--danger` and is only for
  destructive actions.
- Light mode: same Azure gradient, softer cooler shadow, no navy fill or thick border.
- Styles live in `styles/globals.css` (`.btn-*`); `components/ui/button.tsx` only picks the classes.

**Contrast (please confirm).** White labels on the gradient: 3.27:1 at the top (`#1A8FFF`), 3.89:1 in the
middle, 4.71:1 at the bottom. WCAG AA asks for 4.5:1 for 15px text, so the top half is below AA. Built
exactly as specified; if AA matters, the smallest change is starting the gradient at `#0A7EF0`.

## B. Sign-in hero

- It is the real sign-in page (`/`, `components/platform/sign-in-view.tsx`): brand mark, headline (Geist
  550, 68px, −0.03em; only "173 countries" in the gradient), one line of copy, glass stats chips, and a glass
  card with username, password (show/hide), "Sign in", "Use a passkey" and "Forgot password?". Phase 2 wires
  the flow into it.
- Globe:
  - land from a new bundled land/country mask (Natural Earth 1:50m, 18 KB gzipped), so every continent is
    drawn, Antarctica included; dots in latitude rows (denser, smaller, smaller toward the poles, slight size
    jitter);
  - dark: soft Emerald dots with additive blending and a per-dot glow; light: darker Emerald `#00A877` on a
    frosted-glass globe;
  - ocean: dark glass with an inner gradient and a thin fresnel edge light;
  - atmosphere: a wide, soft Azure halo fading to transparent (no ring); in light leaning slightly cyan so it
    never reads lavender;
  - 8 arcs from Sri Lanka (Italy, Spain, Japan, UAE, UK, Singapore, Australia, Türkiye), Azure → Emerald,
    with light pulses travelling along them and ripples where they land; arcs and pulses fade at the limb, so
    nothing floats outside the globe;
  - slow rotation and a subtle, weighted tilt toward the mouse; faint distant particles (dark only).
- Background: Midnight Ink (porcelain in light) with layered ambient light (Azure behind the globe, faint
  Emerald bottom left), film grain at 2.5–3% (an inline SVG noise tile, no request) and a gentle vignette.
  This replaces the fluid shader behind the sign-in page; the shader stays for the dashboard header.
- Mobile: globe above, smaller; card below.

## Measurements

- Frame rate, sign-in page, 1600 × 1000, pointer moving, production build, Chrome on Apple M3: dark 59.8
  fps average, light 60.0, 1% low 60 in both.
- No page errors and no requests outside the app's origin.
- Performance rules unchanged: DPR ≤ 1.5, loop paused off screen / hidden tab, reduced-motion static frame,
  static SVG fallback without WebGL.
