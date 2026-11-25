# Demo data plan

The demo store (spec §4) runs fully offline. This file defines what is seeded, how it is generated and how
actions change it. Names of entities and fields follow the backend schema (`schema-tenant.md`).

## 1. Mechanics

| Item | Plan |
|---|---|
| Location | `lib/demo/` (`seed/*.ts` generators, `store.ts`, `persist.ts`, `rng.ts`, `networks.generated.ts`) |
| Determinism | One seeded PRNG (mulberry32, fixed seed `20261119`). Dates are generated **relative to "today"** in Asia/Colombo so the demo always looks current; given the same day, the data is identical |
| Network data | `scripts/build-networks.ts` (`pnpm build:networks`, output committed) turns the two CSVs in `docs/reference/` into `lib/demo/seed/catalogue.json`: 401 networks with operator, TADIGs, MCC-MNC, `costPerMb` (`null` when blank), 4G/5G/VoLTE, and the zones. The browser never parses CSV. Countries with at least one priced network: **172** (computed, e.g. for the sign-in page) |
| Store | Plain in-memory object of tables (`users`, `resellers`, `esims`, `packages`, `orders`, `wallets`, `holds`, `ledger`, `usageCharges`, ...). Demo `lib/api/*.demo.ts` functions read/write it, apply the caller's **scope** and **permissions** exactly like the backend, and return the backend response shapes |
| Persistence | Whole store serialised to `localStorage` key `esim-demo:v<schemaVersion>` after each mutation (debounced). A schema version bump discards old data and reseeds |
| Reset | User menu → "Reset demo data" → confirm → reseed, keep the signed-in role |
| Latency | Random 150–600 ms per call (seeded per call so it's not jumpy); configurable to 0 in tests |
| Errors | Demo functions throw `ApiError` with the backend's codes (see §6) |
| Sign-in | Any password; 2FA accepts any 6 digits except `000000`, which shows the wrong-code state (or a recovery code of 8+ characters); 5 wrong codes lock the code step for 5 minutes. Forgot password answers the same for any input; for a known account the demo "email" is a toast with an "Open reset link" action (links last 1 hour, work once; 5 requests per 15 minutes). A known username or email signs in as that user (e.g. `nadeesha`, `amaya`, `sahan`, `dilini`), anything else as the admin. The demo user for each role is fixed (§3); the role switcher swaps the signed-in user |

## 2. Catalogue

### 2.1 Networks and prices (real)

- **401 networks in 174 countries** from `PriceList.csv`, with real operators, TADIGs, MCC-MNC, 4G/5G/VoLTE
  flags and `Data, €/MB` (min €0.000428, median €0.00224, max €0.146667 per MB).
- **5 networks with a blank price are unavailable** (never priced at 0): China Telecom, Movistar Colombia,
  Asia Cell (Iraq), Safaricom (Ethiopia), Altan Mexico.
- Voice/SMS columns are dropped.
- Two rows are **"Satellite Networks"** with ISO2 `--` (AeroMobile, Telenor Maritime): networks without a
  country. They are kept as networks but not listed as countries (no flag, not on the globe).
- One "current" price-list version, last synced ~2 hours ago; one earlier version with a handful of
  differences (for the sync history).

### 2.2 Zones

| Zone | Source | Networks | Usable for plans | Why it's there |
|---|---|---|---|---|
| Italy | real (LZ 79313) | 4 (Iliad €0.000428 … TIM €0.002584, ~6× spread) | yes | Real single-country zone; shows a spread warning (D84) |
| TEST_LZ | real (LZ 50382) | 401 | **no**: contains 5 unpriced networks | Shows "listed but can't be used" |
| ENIGMA_LZ | real (LZ 51012) | 364 (2 TADIGs not in the price list) | **no**: unpriced networks | Same |
| Europe 30 | synthesised (`createdByUs`) | 88 priced networks of 30 European countries, each ≤ €0.01/MB (as a travel zone would; Swisscom at €0.068 would make a 5 GB hold over €400) | yes | Spec's "Europe-style zone" (no such real zone exists) |
| Asia travel | synthesised (`createdByUs`) | 72 priced networks of 12 Asian countries incl. Sri Lanka, each ≤ €0.01/MB | yes | Local relevance (tenant in Colombo) |
| Worldwide | synthesised (`createdByUs`) | TEST_LZ minus the 5 unpriced networks (as `POST /zones` would drop them) | yes | The "wide zone"; huge price spread (≈340×) |

Synthesised zones are **demo zones**: built only from priced networks, marked `createdByUs: true` (the
backend's flag) **and** `demoZone: true` (demo data only), with a "Demo zone" chip wherever zones are listed
in demo mode. Approved 2026-11-20.

### 2.3 Plans (about 10)

| Plan | Zone | Data | Days | Notes |
|---|---|---|---|---|
| Italy 1 GB | Italy | 1 GB | 7 | |
| Italy 3 GB | Italy | 3 GB | 15 | best seller |
| Italy 5 GB | Italy | 5 GB | 30 | |
| Europe 5 GB | Europe 30 | 5 GB | 15 | |
| Europe 10 GB | Europe 30 | 10 GB | 30 | |
| Europe 20 GB | Europe 30 | 20 GB | 30 | |
| Asia 5 GB | Asia travel | 5 GB | 15 | |
| Worldwide 10 GB | Worldwide | 10 GB | 30 | **hold override** €150 (the default hold, 10 GB × the zone's highest network price, would be €1,700–2,100 depending on the reseller); **large price spread** warning |
| Italy 10 GB (draft) | Italy | 10 GB | 30 | status `draft` |
| Europe 3 GB (inactive) | Europe 30 | 3 GB | 7 | status `inactive`, has historic sales |

Reseller plans (My plans): 2–3 per active reseller, e.g. "Rome weekend" on Italy 3 GB with an informational
selling price.

## 3. People

Tenant: the company (tenant 1), EUR, Asia/Colombo.

| Who | Role | Demo user (role switcher) | Notes |
|---|---|---|---|
| Nadeesha Perera | admin | yes (Admin) | |
| Kasun Silva | staff, role **Support** | yes (Staff) | Support: eSIMs manage, sell, orders, usage, alerts, customers, coverage, price list view, resellers view, assistants view, transactions view, audit log view. No profit, no settings, no wallets manage |
| Dilini Fernando | staff, role **Finance** | no | Finance: wallets, transactions, top-up requests, invoices manage, profit view, resellers view. **New colleague:** no 2FA yet and a forced password change at first sign-in (username `dilini`) |
| 6 resellers, one user each | reseller | first one (Reseller) | see §4 |
| 3 assistants (all under reseller 1) | assistant | first one (Assistant) | different toggle sets (§4.1) |

Users also include statuses for the Users page: one disabled user, one locked user, one without 2FA.
All names are fictional.

## 4. Resellers

| # | Company | Markup | Discount | Status | Wallet story |
|---|---|---|---|---|---|
| 1 | Lanka Roam Travels | 25% | 5% (reseller) + 10% on Italy 3 GB | active | Money committed to running plans: available **€0.40**, 1 plan awaiting funds (Europe 10 GB add-plan, 3 days ago), 1 new eSIM blocked until funded (Italy 5 GB, yesterday). A sale now is blocked until a top-up; the **demo reseller** |
| 2 | Blue Horizon Tours | 15% | — | active | Large balance, most eSIMs |
| 3 | Nomad Connect | 40% | 8% (reseller) | active | Low balance → low-wallet alert |
| 4 | Coral Bay Holidays | 30% | — | active | **Zero balance**, a pending top-up request |
| 5 | Atlas Mobile Partners | 20% | 3% on Europe 10 GB | active | **Outstanding amount** (€14.37) → selling refused |
| 6 | Sunset Trails | 35% | — | **suspended** | Frozen activity |

Default markup for new resellers (setting): 25%. Retail markup for direct sales: 60%.

### 4.1 Assistants of reseller 1

| Assistant | Toggles | Result |
|---|---|---|
| Sahan (front desk) — **demo assistant** | Dashboard, Sell eSIM, My eSIMs (manage), Customers (manage), Coverage, Price list | "6 of 14 areas enabled"; no Finance section |
| Ishara (accounts) | Dashboard, Wallet, Transactions, Invoices, Top-up requests | Finance only |
| Ruwan (disabled) | — | status disabled |

## 5. Operational data

| Data | Amount and shape |
|---|---|
| eSIMs | ~1,040 over 90 days (about 900–1,000 GB and €900–1,000 Yesim cost a week). Owners: 25 **direct** (house wallet), the rest on resellers (#2 445, #1 360, #3 190; #4–#6 a handful, none sold by #6 in the last 30 days). Statuses: mostly ACTIVE; 5 SUSPENDED by reseller, 3 by admin, 1 by rule; 2 END_OF_LIFE; 1 INACTIVE |
| Install status | not installed, downloaded, installed, enabled, disabled, and **one raw unknown value** (`"Pending-Download-Retry"`) |
| Plans on eSIMs | 1–4 per eSIM; every state present: awaiting funds, blocked: no funds, blocked: hold used up, blocked by admin, pending first use, active, expired, ended |
| Install details | Realistic activation code, SM-DP+ address, LPA string per eSIM; ICCIDs `8937204016…` style (19–20 digits, fake) |
| PIN/PUK | Generated on reveal (deterministic per eSIM), never stored in the snapshot; each reveal writes an audit entry |
| Customers | ~60 (≈20 direct), names/emails/phones fictional |
| Where data is used | Each plan zone has a destination mix (seed `ZONE_MIX`, `OPERATOR_MIX`): Italy plans on Iliad, Vodafone, Wind and a little TIM; Europe plans mostly Italy and Spain (Movistar first); Asia plans mostly the UAE (DU, Etisalat); Worldwide plans partly Morocco (Maroc Telecom), the UAE and cheap networks elsewhere. By revenue: Italy, UAE, Morocco, Spain; the 8 networks with the most Yesim cost are DU, Etisalat, Iliad, Vodafone, Wind, TIM, Maroc Telecom and Movistar (checked by a test) |
| Usage | 90 days, per plan per day per network (bytes). Yesterday's and today's charges **Estimated**; earlier **Final**; one day 3 days ago for reseller 2 still **Estimated** (late report) with a `usage_rating_late` alert |
| Usage charges | One per hold per day, per-network lines with Yesim cost, markup, discount, price (admin view) |
| Wallets | 6 reseller wallets + **house wallet**; balance, reserved, available, outstanding consistent with the holds (invariant checked by a test) |
| Ledger | Every type: `topup`, `usage_charge`, `usage_reprice` (one), `outstanding_recovery`, `adjustment`, `deposit` (house wallet) |
| Holds | waiting (in queue order), active, exhausted, ending, settled, released, cancelled |
| Top-up requests | pending (reseller 4, reseller 1), approved (with receipts), rejected (with a note), cancelled |
| Orders | ~150, incl. failed (hold released), one **Being verified** (`needs_check`), awaiting funds, cancelled |
| Alerts | Every type, built from the data: 80% on a plan really at 80–99%; 100% on the eSIM the rule suspended (its plan used all its data); low wallet for each active reseller below €50 available; outstanding amount (Atlas); order being verified; late report (Blue Horizon, 3 days ago); house wallet low (the last time the ledger went below €500, resolved by the deposit that lifted it); low stock (the day before delivery STOCK-2026-04, 17 free); daily sale limit and unpriced network (resolved); price list v14 (acknowledged) |
| Alert rules | 80% notify, 100% auto-suspend (admin) |
| Notifications | ~15 per demo user, some unread |
| Audit log | Built from the data: every user's last sign-in plus daily ones for our team, the Ishara lock-out, every sale and added plan, top-up decisions, markup changes and discounts with before/after, price list versions, assistant disabled, reseller suspended, PIN/PUK reveal; IPs from the documentation ranges (203.0.113.x our team, 198.51.100.x resellers) |
| Inventory | Free = 57 today (about 3–4 days of stock at the last 30 days' sales, the same pace as the Inventory page, so the dashboard shows it amber); going back, free = 57 + new eSIMs sold since − deliveries since. Two deliveries (STOCK-2026-03, STOCK-2026-04) sized so stock went below the warning (20) only once, the day the low-stock alert reports |
| Documents | Monthly statements per reseller for 3 months, top-up receipts, direct-sale invoices; sequential numbers per type and year (e.g. `ST-2026-0007`) |
| Yesim connection | Status OK, reseller B2B_ENIGMA, sponsor SP05, network profile SP05_YESEN01, writes shown as disabled (read only), daily sale limit 50 (12 used today), total cap 500 (183 used); jobs derived from the clock (usage meter every 15 min, funding queue 5 min, order reconcile 10 min, nightly re-pricing 02:00, catalogue 03:00, price list every 6 h); "Sync now" records a run; latest notifications from recent eSIM activity; the balance check uses the same figures as Profit → Reconciliation |

### 5.1 Financial data (spec 8.32)

| Data | Shape |
|---|---|
| Yesim price versions | v12 (−130 days, starting prices), v13 (−74 days: Vodafone Italy −4%, one Greek network +6%), v14 (−32 days: TIM Italy +12%, Vodafone Spain −8%, Etisalat UAE +18%, NTT Docomo −6%, Orange France −5%, True Thailand +10%, Dialog Sri Lanka +7%, O2 Germany −9%). Today's catalogue price is v14; older prices are derived from it |
| Markup history | Every reseller's starting markup from their sign-up day; Blue Horizon 12% → 15% (−50 days, 16:40), Nomad Connect 35% → 40% (−20 days, 16:40); each takes effect at the moment it was saved, so that day's usage is split; retail markup 60% for direct sales |
| Usage lines | Per plan, day and network: about a third of days split 20–70% onto a second network in the same country, so a day can have two rates |
| Supplier account | Four deposits (−95, −62, −30, −8 days), each covering the Yesim cost until the next one in round €500s, the last sized so the balance is about €5,000–5,500 (about a month of runway); the balance Yesim reports is €3.82 below what our records imply (tolerance €5) |
| One formula | Dashboard, Profit and costs, wallets and statements all book money from the same rated lines (`lib/demo/booked.ts`): revenue = the cent-rounded reseller charge per package-day (retail for direct sales), split over that day's network lines; tests check the dashboard equals Profit and costs and the reseller's spend equals their ledger |
| Statements | Last three full months per reseller; opening + top-ups − usage = closing, to the cent |

### 5.2 Accounts

| Account | State |
|---|---|
| Nadeesha (admin) | Authenticator app, 8 recovery codes left, one passkey (MacBook Touch ID) |
| Dilini (staff, Finance) | Invited two days ago, link valid one more day: can't sign in until she opens it (Users → her row → Resend invitation → Open invitation) |
| Ishara (assistant) | Locked after 10 failed sign-ins (unlock in Users, or wait 15 minutes, or reset the password) |
| Ruwan (assistant) | Disabled by Lanka Roam Travels 15 days ago |

## 6. Actions that change the store (spec §4.1)

| Action | Effect in the demo store |
|---|---|
| Sell eSIM (enough funds) | New eSIM + order `completed` + package + active hold; available balance drops |
| Sell eSIM (not enough) | Only "On first use" allowed; eSIM + package `blocked`, hold `waiting` |
| Add plan (not enough) | Order `awaiting_funds`, hold `waiting`, nothing else |
| Sell with outstanding | `ApiError 409 OUTSTANDING_BALANCE` |
| Sell over daily limit | `ApiError 429` (demo daily limit is 50, so in practice only through the "Simulate supplier result" switch) |
| Sell "being verified" / "failed" | Demo-only switch in the confirm step (visible in demo mode only, e.g. "Simulate supplier result") to show all outcomes |
| Approve top-up | Ledger `topup`, outstanding recovered first, receipt created, **funding queue run** (oldest first, skip ahead), waiting plans unblock, notifications |
| Reject top-up | Status rejected with reason |
| Suspend / reactivate eSIM | Status + `suspendedBy`; reseller can't lift admin suspensions (`ApiError 403`) |
| Change markup | Reseller markup updated; a markup-history entry effective from the moment of saving (usage before it keeps the old markup; holds aren't resized); audit entry |
| Change or end a discount | The old discount ends at the moment of saving (end time kept), the new one applies from then |
| Change settings | Retail markup change adds a "house" markup-history entry effective from the save; watermark switches apply to the next PDF |
| Assistant toggles | Grants updated; switching to that assistant shows the new navigation |
| Manual adjustment | Ledger row; never below reserved (`409 INSUFFICIENT_AVAILABLE`) |
| End of life | Status `END_OF_LIFE`, plans ended, holds settled; further status changes `409 END_OF_LIFE_FINAL` |

## 7. Tests on the seed

- Wallet invariants: `available = balance − reserved`, all ≥ 0, `outstanding ≥ 0`.
- Rating (`rating.test.ts`, `finance.test.ts`): every line follows the formula with that day's rates; ledgers,
  holds, statements and the profit report equal the rated charges to the cent; the waterfall closes; the
  simulator and the price breakdown agree; resellers never receive cost or markup; no markup applies before
  it was set.
- Every price = cost × (1 + markup) × (1 − discount), most specific discount wins; unpriced networks never
  priced.
- Every state listed in §5 occurs at least once.
- Scope: reseller sees only their rows; assistant ≤ reseller.
