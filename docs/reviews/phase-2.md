# Phase 2: shell and demo foundation

Screenshots (dark): `review-artifacts/phase-2/` (git-ignored).

## Built

- **Data layer** (`lib/api/*`): `client.ts` (`/api/v1`, cookies, 401 → sign-in with `?next=`, `ApiError`),
  `errors.ts` (codes → plain messages), `mode.ts` (`NEXT_PUBLIC_DATA_MODE`, default demo). Each resource has a
  demo and an API implementation with the same type; pages never branch on the mode.
- **Demo store** (`lib/demo/*`): real catalogue (401 networks, 6 zones incl. 3 demo zones), deterministic seed
  relative to today (Asia/Colombo), persisted to localStorage, latency 150–600 ms, reset. Tested invariants:
  balance = ledger, never negative, available = balance − reserved, every plan state and eSIM status present,
  price formula and most specific discount, holds.
- **Permissions** (`lib/platform/permissions.ts`): role envelopes (spec 5.3), effective = tenant ∩ role ∩
  grants, assistant ≤ reseller, Orders follows Sell eSIM or Transactions; named rules for the backend's
  admin-only actions.
- **Navigation and route guard** (`lib/platform/nav-config.ts`): one tree per role family; hidden tabs and
  empty sections removed; not-yet-built tabs are disabled "Soon" items; the guard reads the same tree (signed
  out → sign-in, forced password change, access denied in place, coming soon).
- **Platform context**: user, permissions, data version, unread count, wallet summary, sign in / 2FA /
  passkey (demo) / sign out / change password, role switcher, reset demo data.
- **Shell**: desktop primary rail + secondary column (hover previews a section, gliding indicator) + top bar
  (breadcrumb, Demo data badge, reseller's available balance, bell, theme, user menu); mobile top bar,
  section tabs strip, bottom navigation with "More".
- **Sign-in flow**: `/` → `/login/2fa` → workspace; `/login/change-password` (forced on first sign-in).
- **Notifications** page and bell.

## Open decisions

- The 2FA set-up prompt for accounts without 2FA (`/login/setup-2fa`, spec 8.31) is not built; Dilini signs
  in without it. Build it now, or with Profile and security after the demo?
- Demo passkey sign-in signs in as the admin (there is no real passkey ceremony in demo mode).
