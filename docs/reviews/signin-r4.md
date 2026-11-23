# Sign-in hero, round 4: upgrades on the approved design

Date: 2026-11-20. Status: **waiting for approval.** Layout, colours, glass card and globe unchanged.
Screenshots, recording and raw measurements: `review-artifacts/signin-r4/` (not committed).

## Built

1. **Copy.** All text replaced as specified (badge, two-line headline "Every network. / One login." with "One
   login." in the gradient plus glow, subheading, stat strip, card title and subtitle, "Work email",
   "Enter workspace →", "or continue with" + Passkey and SSO side by side, trust line, footer status, nav with
   Developers and "Talk to sales"). Stat numbers and the footer status are Geist Mono; all three numbers count
   up on load (99.99% with two decimals).
2. **Signal into the login.** Every 4.6 s a thin line of light (teal → blue, with a soft glow and a small
   spark at the start) travels along a curve from a hub city that faces the viewer into the card's top border,
   following the city as the globe turns. On arrival the card's top edge flashes and the LIVE counter goes up
   by one (with a small tick). The globe reports each city's screen position every frame through a ref, so
   nothing re-renders per frame. Below 1024px (globe behind the content) and with reduced motion there is no
   line; the counter still ticks and the card edge still flashes.
3. **Telemetry cards.** Monospace, each with a flag, rotating through the five lines; three slots, one
   replaced at a time: the old card fades out with blur while the new one fades up out of a blur.
4. **Depth.** A thin tilted orbit ring around the globe (its back half hidden behind the globe) with a glowing
   satellite and a short trail; a slow, very faint teal and violet aurora drifting across the top; faint ocean
   dots so land reads brighter than the sea.
5. **Headline entrance.** Line by line, each word sliding up from a soft blur (90 ms apart). The gradient runs
   continuously across "One login." even though the words animate separately; a slow shimmer passes every
   6 seconds.
6. **Mobile.** A slim LIVE ticker at the top with the latest activation, rotating; shown whenever the globe
   cards are hidden (below 1024px, so tablets get it too).

## Measurements

- Production build, Chrome on Apple M3, pointer moving and dragging the globe: 60.0 fps average, 1% low 60,
  at 1440 × 900, 1600 × 1000 and 1920 × 1080.
- No page errors, no console errors, no requests outside the app's origin.

## To confirm

1. **Claims every visitor sees** (all in `SIGN_IN_COPY`): "SOC 2 Type II", "GSMA certified", "99.99% uptime"
   need confirming before go-live. The LIVE counter (starts at 2,184), the telemetry, "+12,480 devices online",
   the ticker and "401 carriers online" are illustrative until real data feeds them.
2. **SSO.** The backend has no SSO today; the SSO button shows "Single sign-on isn't available yet" and points
   to email + password or a passkey. Hide it, or keep it as a placeholder?
3. **"Work email".** The backend signs in with a username **or** an email; the field accepts both, only the
   label says email.
4. The violet in the aurora is a new token (`--si-violet`), used only there.
