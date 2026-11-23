# Backend backlog (requests from the frontend)

Things the frontend needs from the backend that don't exist yet. Until each one ships, the frontend fakes it
in demo mode with the shape proposed here, so switching to `api` mode needs no page changes. Agreed with
product on 2026-11-20 (answers to the Phase 0 questions).

| # | Request | Why | Proposed shape | Demo behaviour until then |
|---|---|---|---|---|
| BB-1 | **Separate `orders` permission module** | The spec's permission model has `orders` (admin M, staff M, reseller V, assistant V) and an Orders toggle for assistants. Today `GET /orders` needs `sell_esim` or `transactions` view | Catalogue module `orders`; `GET /orders`, `GET /orders/:id` require `orders:view`; check/resolve/cancel keep their role rules | Orders visible with `sell_esim:view` or `transactions:view`; no separate Orders toggle in the permission matrix |
| BB-2 | **One derived plan state per package** on `GET /esims/:id`, `GET /esims` (current plans) | The UI state combines order status, hold status, package state and `adminBlocked`; computing it in the browser duplicates billing rules | `planState: "awaiting_funds" \| "blocked_no_funds" \| "blocked_hold_used_up" \| "blocked_by_admin" \| "pending_first_use" \| "active" \| "expired" \| "ended"`; filter `?planState=` on `GET /esims` | Demo store returns `planState` using the approved mapping (CONVENTIONS §7) |
| BB-3 | **eSIM activity timeline** | eSIM detail (spec 8.3): orders, status changes, install status changes, alerts in one list | `GET /esims/:id/activity?page&pageSize` → `{ data: [{ at, kind: "order" \| "status" \| "install" \| "alert" \| "credentials_viewed", title, detail?, actor?, ref? }], ... }` | Built from demo orders, audit entries and alerts |
| BB-4 | **eSIM list CSV export** | Spec 8.2, §10 | `GET /esims/export.csv` with the same filters as `GET /esims`, streamed | Client-side CSV from the demo store |
| BB-5 | **Email the QR code** | Spec 8.3, 8.5 | `POST /esims/:id/qr/email { email }` (defaults to the customer's email); audit-logged | Toast "QR code sent to …" |
| BB-6 | **PDF watermark at download time** | Spec 8.22, §10: "Downloaded by <full name> (<username>) · <date and time>", large, diagonal, semi-transparent, on every PDF (documents, usage report, price list, profit report) | Applied when serving the PDF (the stored PDF and its hash stay unchanged); every download audit-logged (`document.downloaded`, with doc type and ID) | Client-side PDF with the same watermark |
| BB-7 | **Watermark settings** per document type | Spec 8.26 | Settings keys `watermark_statement`, `watermark_receipt`, `watermark_invoice`, `watermark_usage_report`, `watermark_price_list` (boolean, default `true`); admin only | Demo settings |
| BB-8 | **Missing settings keys** | Spec 8.26 | `waiting_plan_cancel_days` (today env `WAITING_PLAN_CANCEL_DAYS`), `low_wallet_threshold`, `low_stock_threshold`, `timezone` (tenant) | Demo settings |
| BB-9 | **Profit export** | Spec 8.23, §10 | `GET /reports/profit/export?format=csv\|pdf` | Client-side export |
| BB-10 | **Usage by network for one eSIM** | eSIM detail usage table | Confirm `GET /usage/charges?esimId=` exists, or add it | Demo store per-network lines |
| BB-11 | **Definitive alert type list** | Alert inbox filters and icons | Enum (or documented list) of `alerts.type` | Types listed in open-questions Q-ALERTTYPES |
| BB-12 | **Distinct locked-account response** | Spec 8.31 lockout message | 401 with `code: "ACCOUNT_LOCKED"` and `retryAfter` (seconds), or keep the generic answer by design | Generic message plus the lockout rule text |
| BB-13 | **Public sign-in data** (no login needed) | Sign-in page: country count, recent events on the globe | `GET /public/coverage-summary` → `{ countryCount }` (countries with at least one priced network); `GET /public/activity?limit=12` → `[{ id, iso2, country, kind: "installed" \| "activated" \| "on5g" \| "usage", bytesToday? }]`, anonymised (country level only, no customer data) | Count computed from the demo networks (`lib/demo/seed/networks.json`); deterministic demo events |
| BB-14 | **Health check for the status line** | Footer shows "All systems operational" only when the backend says so | `GET /health` → `{ status: "operational" \| "degraded" \| "down" }`, public, cacheable for 30 s | No status line in demo mode |
| BB-15 | **Tenant branding** (white-label) | Sign-in and shell show the logo mark only today | `GET /public/branding` → `{ name, logoUrl?, logoDarkUrl? }` served from our origin (CSP `img-src 'self'`) | Logo mark only, no name |
