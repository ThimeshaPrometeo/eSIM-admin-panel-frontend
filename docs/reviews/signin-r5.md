# Sign-in, round 5: content changes

Layout, colours, glass card and globe unchanged. Screenshots: `review-artifacts/signin-r5/screenshots/`
(dark and light; 1440×900, 1920×1080, 1366×768, mobile 390; 2FA and recovery-code steps).

## Done

1. **No company name**: logo mark only (`BrandMark`), with an accessible label "eSIM platform". Tenant branding
   later (backlog BB-15).
2. **Removed**: marketing nav (Coverage, Pricing, Developers, Status, Talk to sales), SSO button, the trust line
   (SOC 2 / GSMA / encryption), "99.99% uptime", "401 carriers", the live counter and "+12,480 devices online".
3. **New copy** as specified, all in `SIGN_IN_COPY`:
   - Live badge "Live · Real-time usage across {countryCount} countries"; `countryCount` is computed by
     `countryCount()` in `lib/platform/coverage.ts` (countries with at least one priced network) from
     `lib/demo/seed/networks.json`, generated from the reference price list (`pnpm build:networks`).
     Today: **172** (173 countries are listed; one has no priced network).
   - Headline "Sell eSIMs." / "See every megabyte." (gradient on the second line only), supporting line,
     three stat chips, card copy, "or", full-width "Sign in with a passkey", 2FA footnote and helper line.
   - 2FA step (`step="two-factor"`): title, subtitle, 6-digit code (`one-time-code`, digits only),
     "Use a recovery code instead" (switches to a recovery-code field), "Verify and continue", plus
     "Back to sign in".
   - Globe chips and the mobile ticker read `events` from the data layer: demo events from
     `lib/demo/activity.ts` (deterministic; only priced countries; "Now on 5G" only where a priced 5G network
     exists). Real feed: backlog BB-13.
   - Footer: year and language selector; "All systems operational" only when `systemStatus` comes from the
     health check (BB-14). Demo mode has none, so it is hidden.
4. Gradient on the second headline line only; the main button keeps the sign-in gradient (this page only).

The signal still flows from a city into the card and flashes the card edge; it no longer increments a counter.

## Light theme

New light values for the `--si-*` tokens (darker blue/teal inks for text and links so they keep AA contrast;
the button keeps the bright gradient with the navy label). The page now follows the app theme.

## To confirm

- "Back to sign in" on the 2FA step and the recovery-code copy ("Use a recovery code", "Use your
  authenticator app instead") were added for usability; not in the brief.
- The light-theme globe reads paler than the dark one (light ocean, darker dots); it can be tuned further.
