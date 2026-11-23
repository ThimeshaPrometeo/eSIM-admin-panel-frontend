# Demo script

The suggested client demo (spec §15), about 20 minutes, on demo data. Every step changes the demo store, so
it can be shown in order. Before starting: **user menu → Reset demo data**, dark theme, a desktop browser at
1440 × 900 or larger (every page fits one screen there).

Sign in with any password and any 6-digit code. Usernames: `nadeesha` (admin), `kasun` (staff, Support),
`amaya` (reseller, Lanka Roam Travels), `sahan` (assistant), `dilini` (new staff colleague: forced password
change, then the 2FA set-up prompt), `ishara` (locked assistant). The role switcher in the user menu changes role without signing out.

## 1. Sign in (1 min)

- Open `/`. The globe shows real coverage (172 countries with a priced network) and demo activity chips.
- Sign in as `nadeesha`, then the 2FA step (any 6 digits).
- Say: passkeys and recovery codes are supported; the first sign-in forces a password change (show it later
  with `dilini` if asked).

## 2. Admin dashboard (2 min)

- **Overview → Dashboard.** One screen: stats, the globe with arcs from Colombo to this week's countries,
  eight charts.
- Change the period to **Last 7 days**, the unit to **MB**, and pick **Blue Horizon Tours** in the reseller
  filter: every chart follows.
- Point out the dashed tail of the usage line: **estimated** until the supplier's nightly report.
- Switch **Transactions → Revenue and profit** (admins only).

## 3. Coverage and prices (2 min)

- **Products → Coverage.** Drag the globe; click **Japan** in the list: the globe turns to it, networks with
  4G/5G/VoLTE and their price per GB, the plans that work there, the zones.
- **Products → Price list.** Supplier cost per network. Pick **Lanka Roam Travels** in "No reseller": their
  resulting prices appear. **Excel** and **PDF** downloads (the PDF carries "Downloaded by …").
- **Products → Plans → Create plan**, zone **Worldwide**, 5 GB: the hold is calculated live and the **price
  spread warning** explains why a hold override exists. Cancel.

## 4. Create a reseller with a markup (2 min)

- **Resellers → Create reseller**: company "Ceylon Explorer Tours", contact, email, username `kavya`, markup
  **22%**. It's created only in this platform; nothing at the supplier.
- On its page: **Change markup** (admin only, reason required, audit trail), **Discounts → Add discount**
  with the live before/after price.
- Open **Lanka Roam Travels**: available **€0.40**, almost the whole balance held for running plans, **2 plans
  waiting for funds**. "Their money is committed to running plans."

## 5. Switch to the reseller and sell with zero balance (3 min)

- **User menu → View as Reseller** (Amaya, Lanka Roam Travels). The navigation changes: Sales, My eSIMs,
  Wallet, Team; no supplier cost or markup anywhere. The top bar shows **Available €0.40**.
- **Sales → Sell eSIM.** Pick **Europe explorer** (their own named plan): price range and typical price per
  GB, the hold in *their* prices. Pick a customer, keep **On first use**, **Review**.
- The wallet panel: the hold doesn't fit, so "The eSIM is created and blocked until your wallet covers the
  hold. Only On first use activation is possible." **Sell eSIM**.
- The result: the eSIM card (tilts with the mouse), QR, activation code, SM-DP+, LPA; **Blocked until
  funded**.

## 6. Request a top-up (1 min)

- **Finance → Wallet.** Available €0.40; **Waiting for funds** lists three plans in funding order.
- **Request top-up**: the amount is pre-filled to start all three; add a bank reference; send.

## 7. Switch to admin, approve, the plan unblocks (2 min)

- **View as Admin.** The bell shows the new request. **Finance → Top-up requests → Approve**: the dialog
  explains what happens (outstanding paid first, waiting plans funded oldest first, receipt issued).
- Toast: "Top-up approved · Receipt RC-… · 3 waiting plans funded."
- **eSIM management → All eSIMs**, open the eSIM just sold: its plan is now **Pending first use**.
- Optional: **Wallets → Atlas Mobile Partners** shows an **outstanding amount**; selling is refused for them
  until a top-up pays it first.

## 8. Assistant permissions (2 min)

- **View as Reseller → Team → Sahan → Permissions.** The matrix: turn on the **Finance** section; areas the
  reseller doesn't have are greyed out. **Save permissions**.
- **View as Assistant** (Sahan): the navigation now includes **Finance**; Team management never appears for
  assistants.

## 9. Money: from Yesim's price to profit (5 min)

As **Admin**. One formula prices everything: **reseller price per MB = Yesim €/MB × (1 + markup) × (1 −
discount)**, with the rates in force on the day the data was used. Every page below comes from the same
rated usage lines, so the figures agree to the cent.

1. **Products → Price list → Price breakdown.** Lanka Roam Travels is selected: for each network the Yesim
   €/MB, their markup (25%), discount (5%), their price per MB and per GB, our profit per GB and the margin.
   Click **Blue Horizon Tours** and **Nomad Connect** to compare three resellers side by side.
2. **Simulator** tab: reseller **Lanka Roam Travels**, country **Italy**, **1 GB**. The table shows each
   Italian network; the right-hand card writes the formula out in plain numbers (Yesim cost → markup →
   discount → what they pay → our profit). Switch the reseller to **Direct sale** to show the retail price.
3. **Change a markup.** **Resellers → Lanka Roam Travels → Change markup**: 25% → **30%**, reason "Higher
   support cost". The dialog says it rates usage **from tomorrow**; charges already made keep the markup of
   their day.
4. **See their price change.** Back to **Price list → Price breakdown**: Lanka Roam's prices are up 4%
   (1.30 ÷ 1.25). **History → Markup changes** lists the change with who, when, why and from which day.
   **History → Yesim price versions** shows what changed in Yesim's list in version 14 (4 networks up, 4
   down) and what each reseller pays now.
5. **A usage charge's breakdown.** **Finance → Transactions**, a **Usage charge** row → **How was this
   charged?**: the day's network lines with MB, the Yesim rate, our cost, markup and discount, the charge, our
   profit, the price list version, estimated or final. (Also from eSIM detail: the "€… charged" link on a
   plan.) As **Reseller**, the same button shows only their own price and charge.
6. **The monthly statement.** **Finance → Invoices**, type **Statement**, open Lanka Roam Travels' last
   month: opening balance + top-ups − usage = closing balance. Click a usage line: the same breakdown for
   that day. **Download PDF** carries the "Downloaded by …" watermark (switchable per document type in
   **System → Settings**).
7. **The profit waterfall.** **Finance → Profit and costs**: revenue, Yesim cost, profit, margin for the last
   30 days; the waterfall goes Yesim cost + markup − discounts = revenue → profit. **Breakdown**: by
   reseller, country, network or plan with margins, highest and lowest. **Reconciliation**: deposits to
   Yesim minus our cost of usage against the balance Yesim reports (within the €5 tolerance).

## Other moments, if there's time

- **eSIM detail** (admin): **Show PIN and PUK** (audit-logged), plan actions (extend, add data, block,
  delete), **Set end of life** needs the ICCID typed.
- **Being verified**: sell as admin with "Simulate the supplier's answer: No answer"; the order opens with
  **Resolve as completed** (enter the ICCID) or **Resolve as failed** (hold released).
- **Operations** (admin): **Usage** per eSIM with CSV/PDF; **Inventory** with the 90-day stock trend and
  the low-stock warning; **Alerts and rules** (acknowledge, resolve, the 80% and 100% rules); **System →
  Yesim connection** (jobs, Sync now, balance check, link to what changed).
- **People and security**: **Users** (Ishara is locked: **Unlock**; **Reset two-factor** needs a reason);
  **Staff roles** (the matrix stops at what staff may have); **Audit log** (open a markup change: before
  and after); **Profile and security** (authenticator app, recovery codes, passkeys, sign out everywhere).
- **First sign-in**: sign out, sign in as `dilini`: new password, then the 2FA set-up prompt with QR code
  and key, then recovery codes. **Forgot password?** on the sign-in page shows the reset flow (the demo
  shows the link instead of emailing it).
- **Theme**: the sun/moon button; every page has a light theme.
- **Phone**: the bottom navigation and section tabs.

## Before the demo

- Rehearse once in dark and light, desktop and phone, once with reduced motion (system setting) and once with
  `?static=1` (static globe and background, as on machines without WebGL).
