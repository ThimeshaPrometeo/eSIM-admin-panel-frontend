# Phase 8: demo script, run-through and polish

Screenshots: `review-artifacts/phase-8/` (dev) and `review-artifacts/phase-8-prod/` (production build), both
git-ignored.

## Done

- **Demo script:** chapter 9 "Money: from Yesim's price to profit" (price breakdown → simulator → change
  Lanka Roam's markup → their price changes → a usage charge's breakdown → the monthly statement → the
  profit waterfall), and "other moments" for operations, people and security, and the first sign-in with
  the 2FA prompt. About 20 minutes.
- **"Coming soon" removed:** every tab is built, so the disabled items, the "Soon" badges, the route state
  and the placeholder page are gone from the code and the docs.
- **Polish:** the Usage page says that direct sales are charged to the house wallet at Yesim cost (why its
  "Charged" total is lower than the revenue in Profit and costs).

## Run-through

- Every page in every navigation, as admin (27 pages), staff (20), reseller (17) and assistant (10), in the
  dev server and in the production build: no page scroll at 1440 × 900, no table overflow, no "NaN",
  "undefined", "€-" or "Soon" in the page text, no access-denied page behind a navigation link, no console
  errors, no external requests.
- The financial chapter, scripted: Lanka Roam's markup 25% → 30% moves Wind Italy from €0.79 to €0.82 per GB
  (× 1.04) and the margin from 15.8% to 19%; the change appears in markup history; the October statement
  closes (€27.88 + €100.00 − €95.08 = €32.80); dashboard revenue equals the profit report's (€608.77).
- Production build passes (44 routes). Tests: 87.
