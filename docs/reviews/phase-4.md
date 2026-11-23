# Phase 4: demo pages, part 2

Screenshots (dark; a few light and phone): `review-artifacts/phase-4/` (git-ignored).

## Built (spec §15 items 9–11)

- **eSIM list**: search (ICCID, customer), status, install status, plan state, plan, reseller filters; usage
  bars; CSV export (audit-logged). Resellers and assistants see only their own eSIMs.
- **eSIM detail**: one screen on desktop (the eSIM card with tilt, status, actions, details | tabs Plans,
  Usage, Install details, Activity). Install details with QR (download, email), activation code, SM-DP+,
  LPA and copy buttons; PIN and PUK on request (audit-logged); plans in every state with hold and
  estimated/final charges; actions per spec 8.4 (suspend/reactivate with the D57 rule, extend, add data with
  a growing hold, block/unblock, delete plan, set end of life with the ICCID typed, cancel a waiting plan);
  usage chart, by-network table, CSV and watermarked PDF.
- **Sell eSIM / Add plan** (`/esim/sell`, `?esim=` adds a plan): stepper Plan → Customer → Activation →
  Confirm → Result. All outcomes: completed (eSIM card, QR, codes, download/email QR), new eSIM blocked until
  funded (only "On first use"), add plan awaiting funds, outstanding amount refused with "Request top-up",
  daily limit, being verified (link to the order), failed (hold released). Idempotency key per attempt;
  confirm disabled while sending. Demo-only "Simulate the supplier's answer" switch. Direct sales: optional
  amount paid by the customer.
- **Wallet** (reseller/assistant): available, balance, held, outstanding with explanations; waiting plans in
  funding order; running holds; request top-up (pre-filled with what starts the waiting plans), cancel,
  receipts (watermarked PDF); "How holds and per-MB charging work".
- **Wallets** (admin/staff) incl. the house wallet; **wallet detail** with holds, ledger, credit/debit
  (admin, reason; never below what's held).
- **Transactions**: the ledger in scope, period/type/reseller filters, Estimated chips, CSV.
- **Top-up requests**: pending/approved/rejected; Approve explains its effect (outstanding first, waiting
  plans funded oldest first, receipt); Reject with a reason.
- **Orders** and **order detail**: admins resolve "Being verified" with the ICCID or as failed; staff check.
- **One screen on desktop** for every page (see CONVENTIONS §9.2a); checked at 1440 × 900 and 1366 × 768.
- `docs/demo-script.md`; rehearsal run in dark and light, desktop and phone, reduced motion and `?static=1`:
  no console errors, no external requests.

## Measured

- Production build passes. Three.js loads only on the dashboard and coverage pages (about 1 MB raw there);
  list pages don't load it. The PDF library loads only when someone exports.
- Tests: 61 (permissions, navigation and route guard, formatting, seed invariants, pricing, sell outcomes,
  funding queue, outstanding first, wallets never below held).

## Open decisions

- Demo PDFs (statements, receipts) are simple one-table documents with the watermark; real documents come
  from the backend (BB-6).
- Customers, Usage, Inventory, Alerts, Invoices, Profit, Users, Staff roles, Settings, Yesim connection,
  Audit log and Profile remain "Coming soon" (spec §15).
