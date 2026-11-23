# Sign-in hero, round 3: "mission control"

Date: 2026-11-20. Status: **waiting for approval.** Screenshots, recording and raw measurements:
`review-artifacts/signin-r3/` (not committed).

## Built (per the brief)

1. **Art direction.** Always-dark page on near-black navy `oklch(0.13 0.03 260)`; one signature gradient
   (`oklch(0.65 0.2 250)` → `oklch(0.8 0.15 170)`) on the headline accent, the main button and the globe's
   edge glow only; cool low-saturation neutrals. Every colour is a `--si-*` token. Background layers: large
   radial glow behind the globe, faint teal glow bottom left, 3% film grain, a 24px dot grid fading to the
   edges, and a vignette.
2. **Type.** Geist 560, `clamp(56px, 6vw, 88px)` (44px on phones), −0.04em, line height 0.95. "173
   countries" in the gradient with a soft matching glow; 173 counts up from 0 in 1.2 s, tabular. Subheadline
   18px, 65% foreground, 44ch, 1.6. Pill: pulsing green dot · "Live in 173 countries · New: 5G in Japan".
3. **Stats.** One glass strip, thin dividers, each item an icon in a small gradient tile, bold number, muted
   label; hover lifts 1px and brightens the border.
4. **Card.** Card colour at 60% + 20px blur, 1px gradient border (12% → 3% white), 1px top highlight,
   `0 30px 80px -20px` primary at 25%, radius 20, padding 32. Inputs 48px, recessed, leading user/lock icons,
   focus = 2px primary-40% ring + soft glow in 150 ms; labels 13px medium. Main button: gradient with inner top
   highlight, a sheen sweeping across on hover, arrow +3px on hover, 0.98 press, spinner in place of the arrow
   while loading. Passkey: outline button with a fingerprint icon under an "or" divider of fading lines.
   Footer trust line.
5. **Globe.** Real 3D (three.js): teal land dots, electric-blue rim, slow spin (0.12 rad/s ≈ 0.002
   rad/frame), drag to rotate (spin resumes on release), routes between London, Dubai, Tokyo, New York, São
   Paulo and Mumbai with glowing comet trails, pulsing pins at those cities. Three floating glass activity
   cards drift slowly; the first cycles through cities, each new entry fading up and unblurring. Parallax:
   globe 6–8px, cards 10px (opposite direction).
6. **Motion.** Staggered entrance: logo, pill, headline, subtext, strip, card (600 ms each, 80 ms stagger,
   `cubic-bezier(0.22, 1, 0.36, 1)`, 12px rise, 8px unblur); globe fades and scales in from 0.95 over 1.4 s.
   Reduced motion: everything appears in its final state, the globe renders one still frame.
7. **Details.** Top bar: gradient-stroke logo, Coverage, Pricing, Docs, Status ●, "Contact sales". Footer:
   language selector, "All systems operational". 8px spacing, left column max 520px,
   vertically centred.
8. **Responsive.** Below 1024px the globe sits behind the content at 40%, bottom right, not interactive; the
   card goes full width. Phones: no floating cards, 44px headline.
9. **Quality.** All interactive targets ≥ 44px (small text links get an enlarged hit area), visible focus
   everywhere, animations on transform and opacity (plus the requested entrance blur).

## Measurements

- Production build, Chrome on Apple M3, pointer moving and dragging the globe: 60.0 fps average, 1% low 60,
  at 1440 × 900, 1600 × 1000 and 1920 × 1080.
- No page errors, no console errors, no requests outside the app's origin.
- Contrast: body text 17.9:1; subheadline (65%) ≈ 8:1; main-button label (navy on the gradient) 6.2:1 at
  the blue end to 11.5:1 at the teal end. White text would fail on this gradient (1.8–3.2:1), so the label is
  navy.

## Decisions and things to confirm

1. **Globe library.** Kept our own three.js globe instead of cobe or three-globe. cobe can't draw arcs or comet
   trails; three-globe adds several large dependencies (hex grid, tweening) for what this globe already does.
   It is real, interactive 3D, not an image. Happy to swap if you prefer one of them.
2. **Claims shown to every visitor** (in `SIGN_IN_COPY`, one place): "SOC 2 · 256-bit encryption · SSO
   available" — the backend has no SSO today (password + 2FA or passkeys) and SOC 2 needs confirming;
   "All systems operational", the live-activity cards and "+1,284 activations today" are illustrative until
   real data feeds them; "New: 5G in Japan" is your copy.
3. **Top-bar links** (Coverage, Pricing, Docs, Status, Contact sales) point to `#`: there are no public pages
   in v1 (spec §12). Give me the destinations, or I'll hide them.
4. **Language selector** offers English only (no translations in v1).
5. **The trust-line lock** is a lucide icon rather than the 🔒 emoji, for consistent rendering; the flag
   emoji in the activity card renders as letters on Windows.
6. The sign-in page is always dark; the rest of the app keeps dark and light themes.
