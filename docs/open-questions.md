# Open questions (frontend)

Found in Phase 0 by comparing `FRONTEND_BUILD_SPEC.md` with the backend docs (`endpoints.md`,
`permissions.md`, `billing.md`, `schema-tenant.md`, `decisions.md`). Each has the **assumption we build on**
until it is answered. When answered, record the answer here (or in the spec) and update the affected docs.

**Blocks** says what can't be finished without an answer. "Demo" = needed before the client demo.

For every question still open: **build on the stated assumption** (product, 2026-11-20).

## 0. Answered (2026-11-20)

| # | Answer |
|---|---|
| Q-SIP | The SIP panel is in `reference/sip-panel/` (git-ignored). Use it for architecture, structure and interaction patterns only (shell, navigation, tables, dialogs). Visuals follow spec §7 |
| Q-ORDERS | Follow the backend: Orders visible with `sell_esim:view` or `transactions:view`; no separate Orders toggle. A separate `orders` module is requested in [backend-backlog.md](backend-backlog.md) BB-1 |
| Q-PLANSTATE | The proposed mapping is approved, including the extra **Blocked by admin** state (CONVENTIONS §7). "Return one derived plan state" is BB-2 |
| Q-STAFFWRITE-1…7 | Follow the backend's admin-only rules (table in §2) |
| Q-EUROZONE | Invented zones built only from priced networks are fine; they are marked as **demo zones** in the data |
| Q-API-CASE | The backend returns camelCase on `/api/v1`; `lib/api` maps types and shapes, not casing (CONVENTIONS §3) |
| Missing endpoints | Timeline, eSIM CSV export, email QR, PDF watermark and its settings are faked in demo mode; suggested endpoints in [backend-backlog.md](backend-backlog.md) |

### Answered (2026-11-23, review of phases 2–4)

| # | Answer |
|---|---|
| Q-ONESCREEN | Keep the one-screen desktop layouts (CONVENTIONS §9.2a) |
| Q-ROUTE2FA | The 2FA set-up screen is built after the demo, together with Profile and security |
| Q-DEMOPASSKEY | Demo passkey sign-in as the admin is fine for the demo |
| Q-EXPORTLIBS | `jspdf` and `write-excel-file` approved (bundled, loaded on export only, no network calls) |

### Decided (2026-11-23, review of phases 5–8)

| # | Decision | Where |
|---|---|---|
| Q-EFFECTIVE | Markup and discount changes take effect **from the moment they're saved**: all usage priced after the save uses the new values, including plans already running; usage before it keeps the earlier values. Existing holds are not resized (the hold-exhaustion rule covers any shortfall). Markup history shows "effective from <date time>". | Spec 8.32; CONVENTIONS §6; `lib/demo/rating.ts` splits a day at the moment of a change |
| Q-RESELLERALERTS | Resellers and assistants get an **Alerts** tab: read only, alerts on their own eSIMs only, no rule editing. | Spec 5.4, 8.9 |
| Q-WEBHOOKS | Webhook URLs follow the backend's design: `/webhooks/yesim/<tenant>/<secret>/usage` and `/webhooks/yesim/<tenant>/<secret>/esim-status`; the secret is masked (demo mode shows the masked form only, no copy). | Spec 8.27; BB-25 |
| Q-STAFFINVITE | **No admin-chosen passwords.** Creating any user (staff, a reseller's first user, an assistant) sends an invitation link, valid 72 hours, to set a password and then set up 2FA (not skippable on that path). Invited accounts can't sign in; the invitation can be sent again (the old link stops working). Demo mode shows "Invitation sent" and an "Open invitation" button. | Spec 8.15, 8.17, 8.24, 8.31; route `/invite`; BB-26 |
| Q-MFARESET | Resetting two-factor removes all second factors (authenticator app, recovery codes and passkeys); the user sets them up again at next sign-in. Reason required, audit-logged. | Spec 8.24 |

## 1. Still open, building on the assumption

| # | Question | Assumption until answered | Blocks |
|---|---|---|---|
| Q-API-BASE | Spec says the frontend calls `/api/*`; the backend's prefix is `/api/v1`. | `apiFetch("/v1/esims")` → `/api/v1/esims`; proxy forwards `/api/*` unchanged to `BACKEND_URL` | — |

## 2. Spec vs backend permissions (role rules)

The backend adds `@Roles(...)` on top of module levels in several places, so staff with `manage` still can't
do some actions. **Answered: follow the backend** (hide the action for roles it refuses).

| # | Action | Spec | Backend | Assumption |
|---|---|---|---|---|
| Q-STAFFWRITE-1 | Create/edit/activate plans | staff `plans: M` | admin only | Staff see Plans read-only |
| Q-STAFFWRITE-2 | Create/edit discounts | "admin manage" | admin only | as spec |
| Q-STAFFWRITE-3 | Wallet manual credit/adjustment | wallets M for staff | admin only | Staff see wallets read-only |
| Q-STAFFWRITE-4 | Resolve "Being verified" order | admin/staff | **resolve: admin only**; "check with supplier" admin/staff | Staff get "Check now", admins get "Resolve" |
| Q-STAFFWRITE-5 | Reset a user's 2FA | users manage | admin only, never yourself | Admin only |
| Q-STAFFWRITE-6 | Price list sync, run jobs ("Sync now") | price_lists / yesim_connection M | admin only | Admin only |
| Q-STAFFWRITE-7 | Alert rule "Auto-suspend" | admin/staff set rules | `notify_and_suspend` admin only | Staff can create Notify rules only |
| Q-MARKUP | Markup column in the reseller list | "admins only" | staff see markup **read-only** (permissions.md §7) | Show to staff read-only (backend). Confirm with product |
| Q-MYPLANS | Admins/staff on My plans | not in admin nav | `reseller_plans: V` (see all, read-only) | No admin tab; reseller plans shown on the reseller detail page instead |
| Q-RDISC | Resellers have `discounts: V` but the reseller nav has no Discounts tab | — | own discounts readable | No tab (discount is already in their prices). Add a "Your discounts" card on the Price list page? |

## 3. Missing in the backend (the UI needs it)

| # | UI need | Spec | Assumption / proposal |
|---|---|---|---|
| Q-TIMELINE | eSIM activity timeline (orders, status, install changes, alerts) | 8.3 | Propose `GET /esims/:id/activity`; demo builds it from orders, audit entries and alerts |
| Q-EXPORT | eSIM list CSV, profit CSV/PDF | 8.2, 8.23 | Propose `GET /esims/export.csv`; profit uses `/reports/yesim-cost/export` until a profit export exists |
| Q-EMAILQR | "Email QR" button | 8.3, 8.5 | Propose `POST /esims/:id/qr/email {email}`; demo shows a toast |
| Q-USAGE-NET | Per-eSIM usage by country/network table | 8.3 | Use `GET /usage/charges?esimId=` lines (per network); confirm the filter exists |
| Q-WATERMARK | PDF watermark "Downloaded by …" at download time, per-document-type on/off in Settings, downloads audit-logged | 8.22, 8.26, §10 | Backend serves stored PDFs (drafts watermarked DRAFT) and has no watermark setting. Needs backend design (stamping at download keeps the stored PDF's hash valid). Demo stamps client-side |
| Q-SETTINGS | Full list of setting keys | 8.26 | Known: `default_reseller_markup_percent`, `retail_markup_percent`, `zone_price_spread_warning_ratio`, `house_wallet_low_balance_threshold`, `usage_rating_finalise_days`, `usage_rating_alert_days`, `yesim_reconciliation_tolerance`, tax wording. Missing from the backend docs: unfunded-plan cancel days (env `WAITING_PLAN_CANCEL_DAYS` today), low wallet threshold, low-stock threshold, watermark flags, time zone |
| Q-NOTIFPREFS | Reseller Settings → Notifications tab | 5.4 | No preferences endpoint. Assumption: the tab shows the notification list/settings placeholder; confirm what "Notifications" settings means |
| Q-SESSIONS | "Sessions: sign out everywhere" | 8.30 | Only `POST /auth/logout-all` exists (no session list). UI shows just the button |
| Q-ALERTTYPES | Alert `type` is a free string in the schema | 8.9 | Use the types named in backend docs: `usage_threshold`, `low_stock`, `low_wallet`, `house_wallet_low`, `order_needs_check`, `unpriced_network_usage`, `usage_rating_late`, `plan_held_by_daily_limit`, `outstanding_balance`, `price_list_changed`, `zone_unpriced_networks`, `plan_waiting_funds`; ask for the definitive list |
| Q-LOCKOUT | Lockout message after 10 failures | 8.31 | Backend login returns a generic 401 by design. Does it return a distinct code for a locked account? Assumption: show the generic message plus "after 10 failed attempts the account locks for 15 minutes" |
| Q-INSTALL | Install status labels | 8.3 | Spec lists "Downloaded, Installed, Enable, Disable" (Yesim raw strings); backend normalises to `downloaded/installed/enabled/disabled/...` and keeps `installStatusRaw`. UI shows the normalised label, the raw value when `unknown` |
| Q-ESIMSTATUS | eSIM statuses beyond the spec's four | 8.3 | Backend also has INACTIVE, DISCONNECTED, UNKNOWN and `suspendedBy = rule`. UI labels them (CONVENTIONS §7) |

## 4. Product / behaviour

| # | Question | Assumption until answered |
|---|---|---|
| Q-DIRECT | Direct sales: the backend charges the **house wallet at Yesim cost**, while D79 adds a **retail markup** for direct sales. Which price does an admin see in the sell flow, and what hold? And should the sell flow ask for the optional `retailAmount` (what the customer paid outside the platform)? | Admin sees retail prices (cost × retail markup) as "customer price" and the cost-based hold on the house wallet; optional "Amount paid by the customer" field on the confirm step for admin/staff |
| Q-SETDATE | "On a set date": the backend activation `date` maps to Yesim `activePeriod {start, end}`. Does the UI pick only a start? Max distance ahead? | Start only (end = start + validity); max 365 days (backend A-ACT) |
| Q-CANCELWAIT | The backend lets the owner **cancel** a waiting plan (`POST /orders/:id/cancel`) and **cancel** a pending top-up request. The spec doesn't mention either | Show "Cancel plan" on Awaiting funds / Blocked: no funds plans and "Cancel request" on pending top-ups |
| Q-CREDITNOTE | Credit notes exist in the backend (admin, reason); the spec's documents page doesn't mention them | List them in Invoices (read-only); creating them is after the demo |
| Q-ALERTACK | Alert status has `acknowledged` too; spec says open/resolved | Show three states; resellers/assistants can't change status (backend A-ALERT) |
| Q-DAILYLIMIT | Demo daily sale limit and cap | Demo uses 50/day and a cap of 500 so the demo can't hit the real live-test values (3/15) by accident |
| Q-ROUTE2FA | 2FA set-up prompt needs a screen | New route `/login/setup-2fa`, skippable until go-live |
| Q-EUROZONE | No real "Europe" zone exists in Yesim data (only TEST_LZ, ENIGMA_LZ, Italy; the first two contain unpriced networks and can't be used for plans) | Demo synthesises "Europe 30", "Asia travel" and "Worldwide" zones from priced networks, marked as created by us (demo-data.md §2.2) |
| Q-ALERTTYPES2 | The ten alert types in spec 8.9 | UI uses the backend names from Q-ALERTTYPES (`unpriced_network_usage`, `usage_rating_late`, `plan_held_by_daily_limit`, …); `zone_unpriced_networks` and `plan_waiting_funds` get labels once the definitive list arrives (BB-11) |
| Q-2FASKIP | The 2FA prompt's "Remind me next time" | Lasts for the browser session; not offered after accepting an invitation; removed at go-live when 2FA becomes required (Q-ROUTE2FA) |

## 5. Repository

| # | Question | Assumption |
|---|---|---|
| Q-DOCS | Spec §1 lists `docs/backend/*.md` in this repo; they live in the backend repo. Copy a snapshot here, or link? | Link to the backend repo (avoids two copies drifting). The two reference CSVs **were copied** to `docs/reference/` because the demo build reads them |
