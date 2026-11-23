# Routes

Every route, who can open it, the permission that guards it, the `lib/api` functions it calls and the main
components. Function names follow backend `endpoints.md` (path in brackets). Spec section numbers in the
first column. **Demo** = the phase that built it; every route is built.

Roles: **A** admin, **S** staff (limited by staff role), **R** reseller, **As** assistant (limited by toggles).

## 1. Public and auth

| Route | Spec | Roles | Guard | Data functions | Components | Demo |
|---|---|---|---|---|---|---|
| `/` | 8.31 | public | redirect to `/esim/dashboard` when signed in | `login` (POST /auth/login), `passkeyLoginOptions`, `passkeyLogin` | `SignInView`, `Globe` (hero), `ShaderBackground`, `PasswordField` | yes |
| `/login/2fa` | 8.31 | after password | needs pending-MFA state | `verifyMfa` (POST /auth/mfa/verify), `passkeyAssert` | `OtpInput` (6 digits / recovery code toggle) | yes |
| `/login/change-password` | 8.31 | signed in, `mustChangePassword` | forced | `changePassword` (POST /auth/change-password) | `PasswordStrength` | yes |
| `/login/setup-2fa` *(new, Q-ROUTE2FA)* | 8.31 | signed in, not enrolled | prompted (enforced from go-live) | `setupTotp`, `enableTotp` | `TotpSetup`, `RecoveryCodes` | yes (Phase 7) |
| `/forgot-password` | 8.31 | public | | `forgotPassword` | | yes (Phase 7) |
| `/reset-password` | 8.31 | public | `?token=` | `resetPassword` | | yes (Phase 7) |

## 2. Workspace (`app/esim/*`, inside `AppShell`)

| Route | Spec | Roles | Module (level to open) | Data functions | Main components | Demo |
|---|---|---|---|---|---|---|
| `/esim/dashboard` | 8.1 | A S R As | `dashboard:view`; revenue chart `profit_reports:view` | `getDashboardUsageDaily`, `getDashboardUsageMonthly`, `getDashboardEsimStatus`, `getDashboardPlansSold`, `getDashboardTransactions`, `getDashboardTopEsims`, `getDashboardUsageByCountry`, `getDashboardRevenue`, `getDashboardWallets`, `getDashboardHouseWallet` (A); `listResellers` (filter) | `DashboardView`, `Globe` (compact) + `ShaderBackground` header, `PeriodSelect`, `UnitSelect`, `StatBlock`, charts: `UsageAreaChart`, `MonthlyBarChart`, `StatusDonut`, `PlansSoldChart`, `TransactionsChart`, `TopEsimsBar`, `CountryBar`, `RevenueProfitChart` | yes |
| `/esim/esims` | 8.2 | A S R As | `esims:view` | `listEsims` (GET /esims), `listPlansCatalogue` / `listPlans` (filter), `listResellers` (A/S), `listCustomers`; export CSV (Q-EXPORT) | `EsimListView`, `DataTable`, `StatusChip`, `UsageBar` | yes |
| `/esim/esims/[id]` | 8.3, 8.4 | A S R As | `esims:view`; actions per 8.4 | `getEsim`, `getEsimCredentials`, `getEsimQr`, `getEsimUsage`, `getEsimActivity` (Q-TIMELINE), `suspendEsim`, `reactivateEsim`, `setEsimStatus` (A, end of life), `extendPackage`, `changePackageLimits`, `blockPackage`, `unblockPackage`, `deletePackage` (A), `cleanPackages` (A), `setEsimCustomer`, `exportUsage` | `EsimDetailView`, `EsimCard`, `QrCard`, `UsageRing`, `InstallDetails`, `PinPukReveal`, `EsimPlansTable`, `HoldPreview`, `ActivityTimeline`, `EsimActionsMenu`, `esim-dialogs` (suspend, reactivate, extend, add data, block, end of life, delete plan, clean) | yes |
| `/esim/sell` (`?esim=<id>` = add plan) | 8.5 | A S R As | `sell_esim:manage` | `listPlansCatalogue` (GET /plans/catalogue), `listResellerPlans`, `getPlanCountries`, `listCustomers`, `createCustomer`, `getWallet` / `getDashboardWallets`, `createEsimOrder` (POST /orders/esim, idempotent), `addPlanToEsim` (POST /esims/:id/plans, idempotent), `getEsim` | `SellStepper`, `PlanCard`, `PriceRange`, `HoldPreview`, `CustomerPicker`, `ActivationPicker`, `SellResult` (`EsimCard`) | yes |
| `/esim/orders` | 8.6 | A S R As | `orders:view` → see Q-ORDERS (backend: `sell_esim` or `transactions` view) | `listOrders` | `OrdersView`, `DataTable` | yes |
| `/esim/orders/[id]` | 8.6 | A S R As | same; resolve = A (backend), check = A/S | `getOrder`, `checkOrder`, `resolveOrder`, `cancelOrder` (waiting plans) | `OrderDetailView`, `ResolveOrderDialog` | yes (resolve, check, cancel waiting) |
| `/esim/usage` | 8.7 | A S R As | `usage:view` | `getUsageDaily`, `getUsageByCountry`, `getUsageCharges`, `exportUsage` (csv/pdf) | `UsageView`, charts, `DataTable` | yes (Phase 6) |
| `/esim/inventory` | 8.8 | A S | `inventory:view` | `getInventory`, `getInventoryHistory`, `syncInventory` | `InventoryView` | yes (Phase 6) |
| `/esim/alerts` | 8.9 | A S R As | `alerts:view`; rules `alerts:manage` (A/S) | `listAlerts`, `updateAlert`, `listAlertRules`, `createAlertRule`, `updateAlertRule`, `deleteAlertRule` | `AlertsView`, `AlertRuleDialog` | yes (Phase 6) |
| `/esim/plans` | 8.10 | A S | `plans:view`; create/edit = A (backend `@Roles('admin')`, Q-STAFFWRITE) | `listPlans`, `createPlan`, `updatePlan`, `setPlanStatus`, `pricingPreview` (POST /plans/pricing-preview), `listZones` | `PlansView`, `PlanFormDialog` (live hold, spread warning, unpriced networks) | yes |
| `/esim/plans/[id]` | 8.10 | A S | `plans:view` | `getPlan`, `getPlanPricingPreview`, `getZoneNetworks` | `PlanDetailView`, `NetworkBadges` | yes |
| `/esim/my-plans` | 8.11 | R As (A/S read-only, Q-MYPLANS) | `reseller_plans:view`; edit `manage` | `listResellerPlans`, `createResellerPlan`, `updateResellerPlan`, `deleteResellerPlan`, `listPlansCatalogue` | `MyPlansView`, `ResellerPlanDialog` | yes |
| `/esim/coverage` | 8.12 | A S R As | `coverage:view` | `listCoverageCountries`, `getCoverageCountry`, `listCoverageZones` | `CoverageView`, `Globe` (interactive), `CountryFilterList`, `CoveragePanel`, `NetworkBadges` | yes |
| `/esim/price-list` | 8.13 | A S R As | `price_lists:view`; sync = A | `getCurrentPriceList` (+ `?resellerId`, `?retail` for admins; export xlsx/pdf), `syncPriceList`, `listPriceSyncs` | `PriceListView`, `DataTable` | yes |
| `/esim/discounts` | 8.14 | A S R As | `discounts:view`; create/edit = A | `listDiscounts`, `createDiscount`, `updateDiscount`, `deleteDiscount`, `pricingPreview` (GET /pricing/preview) | `DiscountsView`, `DiscountDialog` (live preview) | yes |
| `/esim/resellers` | 8.15 | A S | `resellers:view`; create/edit/suspend `manage`; markup = A | `listResellers`, `createReseller`, `updateReseller`, `setResellerStatus`, `setResellerMarkup` | `ResellersView`, `reseller-dialogs` | yes |
| `/esim/resellers/[id]` | 8.15 | A S | `resellers:view` | `getReseller`, `listEsims({resellerId})`, `listCustomers`, `getWallet`, `listTransactions`, `listDiscounts`, `listAssistants`, `listInvoices`, `listAuditLogs`, `getUsageDaily({resellerId})` | `ResellerDetailView` (tabs: Overview, eSIMs, Customers, Wallet and ledger, Discounts, Assistants, Documents, Audit trail), `TopUpWalletDialog` | yes (Documents and Audit trail tabs show demo rows) |
| `/esim/customers` | 8.16 | A S R As | `customers:view`; edit `manage` | `listCustomers`, `createCustomer`, `updateCustomer`, `archiveCustomer` | `CustomersView`, `CustomerDialog` | yes (Phase 6) |
| `/esim/customers/[id]` | 8.16 | A S R As | `customers:view` | `getCustomer` | `CustomerDetailView` | yes (Phase 6) |
| `/esim/assistants` | 8.17 | A S (`assistants:view`) · R (`team:manage`) | either module | `listAssistants`, `createAssistant`, `updateAssistant`, `setAssistantPermissions`, `setAssistantStatus`, `getPermissionModules` | `TeamView` (R), `AssistantsOverview` (A/S), `PermissionMatrix`, `assistant-dialogs` | yes |
| `/esim/wallets` | 8.18 | A S | `wallets:view` | `listWallets` | `WalletsView` | yes |
| `/esim/wallets/[id]` | 8.18 | A S | `wallets:view`; adjustment = A | `getWallet`, `listWalletHolds`, `listTransactions({walletId})`, `createWalletAdjustment` | `WalletDetailView`, `AdjustmentDialog` | yes |
| `/esim/wallet` | 8.19 | R As | `wallets:view`; request = `topup_requests:manage` | `getWallet` (own), `listWalletHolds`, `listTopupRequests`, `createTopupRequest`, `cancelTopupRequest`, `downloadInvoicePdf` (receipt) | `WalletView`, `WalletSummary`, `HoldsTable`, `FundingQueue`, `TopupRequestDialog`, `HowBillingWorks` | yes |
| `/esim/transactions` | 8.20 | A S R As | `transactions:view` | `listTransactions`, `exportTransactionsCsv` | `TransactionsView` | yes |
| `/esim/topup-requests` | 8.21 | A S | `topup_requests:manage` (A/S) | `listTopupRequests`, `approveTopupRequest`, `rejectTopupRequest` | `TopupRequestsView`, `ApproveDialog`, `ReasonDialog` | yes |
| `/esim/invoices` | 8.22 | A S R As | `invoices:view` | `listInvoices`, `downloadInvoicePdf` (watermarked) | `InvoicesView` | yes (Phase 5–6) |
| `/esim/profit` | 8.23 | A S | `profit_reports:view` | `getProfitReport`, `getYesimCost`, `getReconciliation`, exports | `ProfitView` | yes (Phase 5–6) |
| `/esim/users` | 8.24 | A S | `users:view` | `listUsers`, `createUser`, `updateUser`, `setUserStatus`, `changeUsername` (A), `resetUserMfa` (A), `sendPasswordReset` | `UsersView` | yes (Phase 7) |
| `/esim/staff-roles` | 8.25 | A S | `staff_roles:view` | `listStaffRoles`, `createStaffRole`, `setStaffRolePermissions`, `getPermissionModules` | `StaffRolesView`, `PermissionMatrix` | yes (Phase 7) |
| `/esim/settings` | 8.26 | A S | `settings:view` | `getSettings`, `updateSettings` | `SettingsView` | yes (Phase 5–6) |
| `/esim/yesim` | 8.27 | A S | `yesim_connection:view` | `getYesimConnection`, `listJobRuns`, `runJob` (A), `listYesimLogs` | `YesimConnectionView` | yes (Phase 6) |
| `/esim/audit-log` | 8.28 | A S | `audit_log:view` | `listAuditLogs`, `getAuditLog` | `AuditLogView`, `DiffView` | yes (Phase 7) |

## 3. Everyone (inside `AppShell`)

| Route | Spec | Data functions | Components | Demo |
|---|---|---|---|---|
| `/notifications` | 8.29 | `listNotifications`, `markNotificationRead`, `markAllNotificationsRead` | `NotificationsView` | yes (Phase 7) |
| `/profile`, `/profile/security` | 8.30 | `getMe`, `updateResellerProfile` (R), `changePassword`, `setupTotp`, `enableTotp`, `disableTotp`, `regenerateRecoveryCodes`, `listPasskeys`, `registerPasskey`, `deletePasskey`, `logoutAll` | `ProfileView`, `TotpSetup`, `PasskeyList` | yes (Phase 7) |
| `/forbidden` (rendered in place, not navigated) | 5.4 | | `AccessDenied` | yes |
| `/design-system` | 7.7 | none | everything | yes (dev only, `notFound()` in production) |

## 4. Navigation map

`lib/platform/nav-config.ts` holds one tree per role family. Each tab: `label`, `href`, `module`
(or `modules[]` for "any of"), `level`, `demo: boolean`.

**Admin and staff**

| Section | Tabs → route |
|---|---|
| Overview | Dashboard → `/esim/dashboard` |
| eSIM management | All eSIMs → `/esim/esims` · Sell eSIM → `/esim/sell` · Orders → `/esim/orders` · Usage → `/esim/usage` · Inventory → `/esim/inventory` · Alerts and rules → `/esim/alerts` |
| Product management | Plans → `/esim/plans` · Coverage → `/esim/coverage` · Price list → `/esim/price-list` · Discounts → `/esim/discounts` |
| Reseller management | Resellers → `/esim/resellers` · Customers → `/esim/customers` · Assistants → `/esim/assistants` |
| Finance | Wallets → `/esim/wallets` · Transactions → `/esim/transactions` · Top-up requests → `/esim/topup-requests` · Invoices → `/esim/invoices` · Profit and costs → `/esim/profit` |
| User management | Users → `/esim/users` · Staff roles → `/esim/staff-roles` |
| System | Settings → `/esim/settings` · Yesim connection → `/esim/yesim` · Audit log → `/esim/audit-log` |

**Reseller** (assistant = same tree without Team management, filtered by toggles)

| Section | Tabs → route |
|---|---|
| Overview | Dashboard → `/esim/dashboard` |
| Sales | Sell eSIM → `/esim/sell` · My plans → `/esim/my-plans` · Coverage → `/esim/coverage` · Price list → `/esim/price-list` |
| eSIM management | My eSIMs → `/esim/esims` · Orders → `/esim/orders` · Usage → `/esim/usage` · Alerts → `/esim/alerts` (view only; Q-RESELLERALERTS) |
| Customer management | Customers → `/esim/customers` |
| Finance | Wallet → `/esim/wallet` · Transactions → `/esim/transactions` · Invoices → `/esim/invoices` |
| Team management | Assistants → `/esim/assistants` (module `team`) |
| Settings | Profile → `/profile` · Security → `/profile/security` · Notifications → `/notifications` (always visible) |

Note: the reseller tree has no Discounts tab, but resellers have `discounts:view` (own). Assumption: no tab;
their discount is already inside their prices (Q-RDISC).

## 5. Route guard

`<RouteGuard module level>` in each `*-client.tsx` (or derived from `nav-config` by pathname):
1. not signed in → `/` with `?next=`;
2. `mustChangePassword` → `/login/change-password`, then the 2FA set-up prompt (`/login/setup-2fa`) for
   accounts without an authenticator app or passkey;
3. missing permission → `AccessDenied` in the shell (URL unchanged).
