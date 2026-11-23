# Phase 7: people and security

Screenshots (dark): `review-artifacts/phase-7/` (git-ignored).

## Built

- **Users** (8.24, `/esim/users`): every account with role, reseller or staff role, status (active,
  disabled, locked until …, first sign-in pending), two-factor (app, passkeys, or "Not set up"), last
  sign-in; search and filters (role, state, no authenticator app). Actions: add staff user (temporary
  password shown once), disable/enable (reason), unlock, reset two-factor (reason), change username and
  change staff role (admins only). Staff can't change administrator accounts; nobody disables themselves.
- **Staff roles** (8.25, `/esim/staff-roles`): roles with members and area counts; the permission matrix over
  the admin navigation, limited by the staff envelope; create, rename, delete (refused while it has
  members). Staff see roles read only.
- **Audit log** (8.28, `/esim/audit-log`): who, what, entity, IP, when; filters for user, entity, action,
  period and text; a side sheet with before/after for changes. Settings, markup, customer, rule, role,
  username, status and two-factor changes record their before/after.
- **Profile and security** (8.30, `/profile`, `/profile/security`): name and email (username read only),
  change password; authenticator app (set up or move to a new phone with QR code and key, recovery codes
  shown once, new recovery codes), passkeys (add, rename, remove; the last second step can't be removed),
  sign out everywhere.
- **Sign-in additions** (8.31): forgot password (same answer whether or not the account exists; demo shows
  the link instead of emailing it), reset password (link works once for 30 minutes, lifts a lock), and the
  2FA set-up prompt after sign-in for accounts without an authenticator app or passkey, after the forced
  password change ("Remind me next time" until go-live).
- **Navigation:** no "Coming soon" items left in any role.

## Checked

- Tests: 87 (new: users list and filters; staff user creation; unlock, reset two-factor with reason,
  admin-only username changes, staff can't change admins, nobody disables themselves; staff roles clamp to
  the envelope, keep grants outside the matrix and record each area changed; audit history built from the
  data, IPs from documentation ranges, nobody acts before their account existed or after now; authenticator
  set-up and recovery codes; the last second step can't be removed; forgot/reset password).
- Browser run: Dilini's first sign-in (password change → 2FA prompt → recovery codes → dashboard); Ishara
  locked → forgot password → reset; admin, staff and reseller pages at 1440 × 900 with no page scroll, no
  table overflow, no console errors, no external requests.
