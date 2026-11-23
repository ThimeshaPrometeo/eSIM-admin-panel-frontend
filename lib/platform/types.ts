/**
 * Domain types the UI works with. Names follow the backend schema; `lib/api/*`
 * maps responses into these shapes, so components never see raw backend JSON.
 *
 * Money is a decimal string in EUR (as the backend returns it). Data amounts
 * are bytes. Dates are ISO strings in UTC.
 */
import type { Grants, Level } from "./permission-matrix";
import type { EsimStatus, HoldStatus, InstallStatus, OrderStatus, PlanState, SuspendedBy, TopupStatus } from "./status";

export type { Grants, Level };
export type Money = string;
export type Role = "admin" | "staff" | "reseller" | "assistant";

export const MODULES = [
  "dashboard",
  "sell_esim",
  "esims",
  "usage",
  "orders",
  "inventory",
  "alerts",
  "plans",
  "reseller_plans",
  "coverage",
  "price_lists",
  "discounts",
  "resellers",
  "customers",
  "assistants",
  "team",
  "wallets",
  "transactions",
  "topup_requests",
  "invoices",
  "profit_reports",
  "users",
  "staff_roles",
  "settings",
  "yesim_connection",
  "audit_log",
] as const;
export type Module = (typeof MODULES)[number];
export type Permissions = Record<Module, Level>;

/** The signed-in user (`GET /auth/me`). */
export type Me = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: Role;
  resellerId: string | null;
  resellerName: string | null;
  staffRoleName: string | null;
  permissions: Permissions;
  mustChangePassword: boolean;
  mfaEnrolled: boolean;
  timeZone: string;
};

export type Page<T> = { data: T[]; page: number; pageSize: number; total: number };

export type WalletSummary = {
  walletId: string;
  balance: Money;
  reserved: Money;
  available: Money;
  outstanding: Money;
  waitingPlans: number;
  waitingAmount: Money;
};

export type Reseller = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  status: "active" | "suspended";
  /** Admin and staff only; never sent to resellers. */
  markupPercent: number | null;
  /** The reseller-wide discount, if any. */
  discountPercent: number | null;
  wallet: WalletSummary;
  esimCount: number;
  customerCount: number;
  assistantCount: number;
  createdAt: string;
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  resellerId: string | null;
  resellerName: string | null;
  esimCount: number;
  createdAt: string;
};

export type Zone = {
  id: string;
  name: string;
  /** "supplier" = a real supplier zone; "demo" = invented for the demo (demo data only). */
  source: "supplier" | "demo";
  demoZone: boolean;
  networkCount: number;
  countryCount: number;
  unpricedNetworks: number;
  /** Plans can only use zones whose networks all have a price. */
  usable: boolean;
};

/** A network with the viewer's prices. `costPerMb` (supplier cost) is admin/staff only. */
export type PricedNetwork = {
  id: string;
  iso2: string;
  country: string;
  operator: string;
  tadigs: string[];
  mccMnc: string;
  lte: boolean;
  nr: boolean;
  volte: boolean;
  /** Viewer's price per MB; null = unavailable (no supplier price). */
  pricePerMb: number | null;
  costPerMb?: number | null;
};

export type PriceRange = { min: number; typical: number; max: number };

export type Plan = {
  id: string;
  name: string;
  zoneId: string;
  zoneName: string;
  demoZone: boolean;
  dataBytes: number;
  validityDays: number;
  status: "draft" | "active" | "inactive";
  /** Admin-set hold, or null for the calculated default. */
  holdOverride: Money | null;
  /** Hold the default reseller would pay (at the default markup). */
  defaultHold: Money;
  countryCount: number;
  networkCount: number;
  /** Supplier cost per MB across the zone (admin/staff). */
  costPerMb: PriceRange | null;
  spreadRatio: number | null;
  soldCount: number;
  createdAt: string;
};

/** A plan as one viewer can sell it (`GET /plans/catalogue`), in their own prices. */
export type CatalogueItem = {
  planId: string;
  resellerPlanId: string | null;
  name: string;
  basePlanName: string;
  zoneName: string;
  dataBytes: number;
  validityDays: number;
  countries: string[];
  perGb: PriceRange;
  /** Plan total at the cheapest, typical and dearest network. */
  total: { min: Money; typical: Money; max: Money };
  hold: Money;
  sellingPrice: Money | null;
};

export type PlanPricingPreview = {
  zoneId: string;
  networks: (PricedNetwork & { costPerMb: number | null })[];
  unpriced: number;
  costPerMb: PriceRange | null;
  spreadRatio: number | null;
  spreadWarning: boolean;
  spreadThreshold: number;
  /** Hold at the default markup, and the range across current resellers. */
  defaultHold: Money | null;
  holdRange: { min: Money; max: Money } | null;
};

export type ResellerPlan = {
  id: string;
  planId: string;
  planName: string;
  name: string;
  description: string;
  sellingPrice: Money;
  status: "active" | "inactive";
  resellerId: string;
  resellerName: string;
  dataBytes: number;
  validityDays: number;
  zoneName: string;
  createdAt: string;
};

export type Discount = {
  id: string;
  resellerId: string;
  resellerName: string;
  planId: string | null;
  planName: string | null;
  percent: number;
  status: "active" | "inactive";
  createdAt: string;
};

export type EsimPlan = {
  id: string;
  orderId: string;
  planId: string;
  name: string;
  state: PlanState;
  activation: "now" | "first_use" | "date";
  activationDate: string | null;
  startedAt: string | null;
  expiresAt: string | null;
  usedBytes: number;
  limitBytes: number;
  hold: { id: string; amount: Money; used: Money; status: HoldStatus };
  charges: { estimated: Money; final: Money };
  createdAt: string;
};

export type Esim = {
  id: string;
  iccid: string;
  status: EsimStatus;
  suspendedBy: SuspendedBy | null;
  installStatus: InstallStatus;
  installStatusRaw: string | null;
  resellerId: string | null;
  resellerName: string | null;
  customerId: string | null;
  customerName: string | null;
  plans: EsimPlan[];
  usedBytes: number;
  limitBytes: number;
  expiresAt: string | null;
  lastActivityAt: string | null;
  createdAt: string;
};

export type EsimDetail = Esim & {
  activationCode: string;
  smdpAddress: string;
  lpa: string;
  customerEmail: string | null;
};

export type EsimCredentials = { pin1: string; puk1: string; pin2: string; puk2: string };

export type EsimActivity = {
  id: string;
  at: string;
  kind: "order" | "status" | "install" | "alert" | "credentials_viewed" | "plan";
  title: string;
  detail: string | null;
  actor: string | null;
};

export type UsagePoint = { date: string; bytes: number; estimated: boolean };
export type UsageByNetwork = { iso2: string; country: string; operator: string; bytes: number; amount: Money; estimated: boolean };

export type Order = {
  id: string;
  type: "new_esim" | "add_plan";
  esimId: string | null;
  iccid: string | null;
  planName: string;
  resellerId: string | null;
  resellerName: string | null;
  userName: string;
  status: OrderStatus;
  funding: "active" | "waiting" | null;
  holdAmount: Money;
  failureReason: string | null;
  createdAt: string;
};

export type ActivationInput = { mode: "now" | "first_use" | "date"; start?: string };

export type SellInput = {
  planId: string;
  resellerPlanId?: string | null;
  customerId?: string | null;
  activation: ActivationInput;
  retailAmount?: Money | null;
};

/** What a sale or an add-plan returns (`POST /orders/esim`, `POST /esims/:id/plans`). */
export type SellResult =
  | {
      outcome: "completed";
      orderId: string;
      esimId: string;
      iccid: string;
      activationCode: string;
      smdpAddress: string;
      lpa: string;
      funding: "active" | "waiting";
      planName: string;
      limitBytes: number;
    }
  | { outcome: "awaiting_funds"; orderId: string; esimId: string; planName: string }
  | { outcome: "needs_check"; orderId: string }
  | { outcome: "failed"; orderId: string; reason: string };

export type Wallet = {
  id: string;
  kind: "reseller" | "house";
  resellerId: string | null;
  name: string;
  status: "active" | "suspended";
  balance: Money;
  reserved: Money;
  available: Money;
  outstanding: Money;
  waitingPlans: number;
  waitingAmount: Money;
  lowBalance: boolean;
};

export type WalletHold = {
  id: string;
  walletId: string;
  esimId: string;
  iccid: string;
  orderId: string;
  planName: string;
  amount: Money;
  used: Money;
  status: HoldStatus;
  /** Position in the funding queue (waiting holds only, 1 = next). */
  queuePosition: number | null;
  createdAt: string;
};

export type LedgerType = "topup" | "usage_charge" | "usage_reprice" | "hold" | "hold_release" | "adjustment" | "outstanding_recovery" | "deposit";

export type LedgerEntry = {
  id: string;
  walletId: string;
  walletName: string;
  resellerId: string | null;
  type: LedgerType;
  /** Signed: credits positive, debits negative. Holds show the reserved amount (balance unchanged). */
  amount: Money;
  balanceAfter: Money;
  reference: string;
  description: string;
  /** Usage charges only: true until the nightly report makes them final. */
  estimated: boolean | null;
  createdAt: string;
};

export type TopupRequest = {
  id: string;
  resellerId: string;
  resellerName: string;
  walletId: string;
  amount: Money;
  paymentReference: string;
  note: string;
  status: TopupStatus;
  requestedBy: string;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
  receiptNumber: string | null;
  /** Filled after approval: outstanding recovered and plans unblocked. */
  effect: { outstandingPaid: Money; plansFunded: number } | null;
};

export type Assistant = {
  id: string;
  resellerId: string;
  resellerName: string;
  fullName: string;
  username: string;
  email: string;
  status: "active" | "disabled";
  grants: Grants;
  lastSignInAt: string | null;
  createdAt: string;
};

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  read: boolean;
};

export type DashboardFilters = { from: string; to: string; granularity: "day" | "month" | "year"; resellerId?: string | null };

export type DashboardData = {
  stats: {
    totalEsims: number;
    activeEsims: number;
    dataUsedBytes: number;
    available: Money | null;
    revenue: Money | null;
    previous: { activeEsims: number; dataUsedBytes: number; revenue: Money | null };
  };
  /** Per bucket (day, month or year): final and estimated bytes. */
  usage: { bucket: string; finalBytes: number; estimatedBytes: number }[];
  monthly: { month: string; bytes: number }[];
  status: { key: "active" | "suspended" | "expired" | "pending" | "in_stock"; count: number }[];
  plansSold: { name: string; count: number }[];
  transactions: { bucket: string; credits: number; debits: number }[];
  topEsims: { id: string; iccid: string; bytes: number }[];
  byCountry: { iso2: string; country: string; bytes: number }[];
  revenue: { bucket: string; revenue: number; cost: number; profit: number }[] | null;
  recentCountries: string[];
};

export type CoverageCountry = {
  iso2: string;
  name: string;
  networkCount: number;
  pricedCount: number;
  lte: boolean;
  nr: boolean;
  planCount: number;
  /** The viewer's cheapest price per MB in this country (null = nothing priced). */
  fromPerMb: number | null;
};

export type CoverageCountryDetail = {
  iso2: string;
  name: string;
  networks: PricedNetwork[];
  plans: { id: string; name: string; dataBytes: number; validityDays: number; zoneName: string }[];
  zones: { id: string; name: string; demoZone: boolean; usable: boolean }[];
  priceBasis: "own" | "cost";
};

export type PriceListRow = PricedNetwork & {
  zones: string[];
  /** Admin/staff with a reseller picked: that reseller's price per MB. */
  resellerPricePerMb?: number | null;
  /** Admin/staff: retail price per MB for direct sales. */
  retailPricePerMb?: number | null;
};

export type PriceList = {
  rows: PriceListRow[];
  syncedAt: string;
  version: number;
  /** own = the viewer's own prices (reseller side); cost = supplier cost (admin/staff). */
  basis: "own" | "cost";
  resellerName: string | null;
};

export type ZoneNetworkPrice = PricedNetwork & { costPerMb: number | null; examples: { resellerName: string; pricePerMb: number | null }[] };

export type PlanDetail = Plan & { networks: ZoneNetworkPrice[]; countries: string[]; resellerPlans: number };

export type AuditEntry = { id: string; actor: string; action: string; summary: string; createdAt: string };

export type DocumentRow = { id: string; number: string; kind: "statement" | "receipt" | "invoice"; title: string; amount: Money; issuedAt: string };

export type PermissionContext = { envelope: Grants; resellerName: string | null };

// ------------------------------------------------------------- finance (spec 8.32)

/** One reseller's price on a network: the chain Yesim → markup → discount → price. */
export type ResellerPriceCell = {
  resellerId: string;
  resellerName: string;
  markupPercent: number;
  discountPercent: number;
  pricePerMb: number | null;
  profitPerGb: number | null;
  marginPercent: number | null;
};

export type PriceBreakdown = {
  version: number;
  syncedAt: string;
  resellers: { id: string; name: string; markupPercent: number; discountPercent: number }[];
  rows: (PricedNetwork & { costPerMb: number | null; cells: ResellerPriceCell[] })[];
};

export type SimulationLine = {
  networkId: string;
  operator: string;
  iso2: string;
  country: string;
  mb: number;
  costPerMb: number;
  markupPercent: number;
  discountPercent: number;
  /** Yesim cost for the amount. */
  cost: number;
  /** After markup, before discount. */
  beforeDiscount: number;
  discountAmount: number;
  /** What the reseller pays (or the retail price for direct sales). */
  price: number;
  profit: number;
  marginPercent: number;
};

export type Simulation = { buyer: string; direct: boolean; bytes: number; lines: SimulationLine[] };

/** A usage charge explained (spec 8.32). Cost, markup, discount and profit are null for resellers. */
export type ChargeLine = {
  date: string;
  networkId: string;
  operator: string;
  iso2: string;
  country: string;
  planName: string;
  iccid: string;
  mb: number;
  costPerMb: number | null;
  cost: number | null;
  markupPercent: number | null;
  discountPercent: number | null;
  pricePerMb: number;
  charge: number;
  /** Our revenue from the line (tenant only). */
  revenue: number | null;
  profit: number | null;
  estimated: boolean;
  version: number;
};

export type ChargeBreakdown = {
  title: string;
  subtitle: string;
  lines: ChargeLine[];
  /** The charge as booked (cents; package-day charges are rounded once). */
  total: number;
  totalCost: number | null;
  /** Our revenue: the reseller charge, or the retail price for direct sales (tenant only). */
  totalRevenue: number | null;
  totalProfit: number | null;
  estimated: boolean;
  viewer: "tenant" | "reseller";
  /** A direct sale: the house wallet pays Yesim cost; revenue is the retail price. */
  direct: boolean;
};

export type ProfitRow = { key: string; label: string; mb: number; revenue: number; cost: number; profit: number; marginPercent: number };

export type ProfitReport = {
  totals: { revenue: number; cost: number; profit: number; marginPercent: number; mb: number; estimatedRevenue: number };
  series: { bucket: string; revenue: number; cost: number; profit: number }[];
  waterfall: { cost: number; markup: number; discount: number; revenue: number; profit: number };
  byReseller: ProfitRow[];
  byCountry: ProfitRow[];
  byNetwork: ProfitRow[];
  byPlan: ProfitRow[];
  reconciliation: {
    deposits: number;
    costToDate: number;
    implied: number;
    reported: number;
    difference: number;
    tolerance: number;
    reportedAt: string;
    depositsList: { date: string; amount: number; reference: string }[];
  };
};

export type PriceVersion = { version: number; effectiveFrom: string; syncedAt: string; changes: number; rises: number; falls: number; current: boolean };

export type PriceChange = {
  networkId: string;
  operator: string;
  iso2: string;
  country: string;
  oldCost: number;
  newCost: number;
  deltaPercent: number;
  impact: { resellerId: string; resellerName: string; oldPerGb: number; newPerGb: number }[];
};

export type MarkupChange = {
  id: string;
  resellerId: string;
  resellerName: string;
  effectiveFrom: string;
  markupPercent: number;
  previousPercent: number | null;
  changedAt: string;
  changedBy: string;
  reason: string;
};

export type InvoiceKind = "statement" | "receipt" | "invoice";

export type InvoiceSummary = {
  id: string;
  number: string;
  kind: InvoiceKind;
  title: string;
  resellerId: string | null;
  resellerName: string | null;
  period: string | null;
  amount: Money;
  issuedAt: string;
};

export type InvoiceDetail = InvoiceSummary & {
  usage: { date: string; planName: string; mb: number; amount: number; estimated: boolean }[];
  topups: { date: string; reference: string; amount: number }[];
  releases: { date: string; planName: string; amount: number }[];
  /** Statements: opening + top-ups − usage + other = closing (EUR). */
  totals: { opening: number; usage: number; topups: number; other: number; closing: number; releases: number };
  taxWording: string;
  /** Watermark this document type's PDFs (Settings). */
  watermark: boolean;
  lines: { label: string; amount: number }[];
};

export type TenantSettings = {
  timeZone: string;
  currency: "EUR";
  defaultMarkupPercent: number;
  retailMarkupPercent: number;
  spreadWarningRatio: number;
  waitingPlanCancelDays: number;
  houseWalletLowThreshold: number;
  lowWalletThreshold: number;
  lowStockThreshold: number;
  watermark: Record<"statement" | "receipt" | "invoice" | "usage_report" | "price_list", boolean>;
  taxWording: string;
  mfaRequired: boolean;
};

// ---------------------------------------------------------------- operations (spec 8.7–8.9, 8.16, 8.27)

export type AlertType =
  | "usage_threshold"
  | "low_stock"
  | "low_wallet"
  | "house_wallet_low"
  | "order_needs_check"
  | "unpriced_network_usage"
  | "usage_rating_late"
  | "plan_held_by_daily_limit"
  | "outstanding_balance"
  | "price_list_changed";
export type AlertStatus = "open" | "acknowledged" | "resolved";

export type Alert = {
  id: string;
  type: AlertType;
  severity: "info" | "warning" | "danger";
  title: string;
  detail: string;
  resellerId: string | null;
  resellerName: string | null;
  esimId: string | null;
  href: string | null;
  /** The rule that raised it, e.g. "80% · notify". */
  rule: string | null;
  status: AlertStatus;
  createdAt: string;
  updatedAt: string;
  updatedByName: string | null;
};

export type AlertRule = {
  id: string;
  thresholdPercent: number;
  action: "notify" | "auto_suspend";
  enabled: boolean;
  createdAt: string;
  createdByName: string;
  updatedAt: string;
  /** Alerts this rule raised in the last 30 days. */
  raised30d: number;
};

export type UsageReportRow = {
  esimId: string;
  iccid: string;
  customerName: string | null;
  resellerName: string | null;
  plans: string[];
  /** Countries used, most data first (ISO2). */
  countries: string[];
  topNetwork: string | null;
  bytes: number;
  /** What the eSIM's owner was charged (resellers: their own cost). */
  charge: number;
  /** Admin/staff only. */
  yesimCost: number | null;
  estimated: boolean;
};

export type UsageReport = {
  totals: { bytes: number; charge: number; estimatedCharge: number; esims: number; yesimCost: number | null };
  series: { bucket: string; finalBytes: number; estimatedBytes: number }[];
  byCountry: { iso2: string; country: string; bytes: number }[];
  rows: UsageReportRow[];
  options: { plans: { id: string; name: string }[]; countries: { iso2: string; name: string }[] };
  /** Watermark usage-report PDFs (Settings). */
  watermark: boolean;
};

export type Inventory = {
  free: number;
  assigned: number;
  threshold: number;
  series: { date: string; free: number; assigned: number }[];
  deliveries: { date: string; count: number; reference: string }[];
  /** New eSIMs in the last 30 days. */
  sold30d: number;
};

export type SupplierJobId = "catalogue_sync" | "price_list_sync" | "usage_meter" | "nightly_reprice" | "funding_queue" | "order_reconcile";

export type SupplierJob = {
  id: SupplierJobId;
  label: string;
  schedule: string;
  lastRunAt: string;
  nextRunAt: string | null;
  durationMs: number;
  result: "ok" | "warning" | "failed";
  message: string;
  /** "Sync now" allowed (catalogue and price list). */
  manual: boolean;
};

export type SupplierEvent = { id: string; at: string; type: string; esimId: string | null; iccid: string | null; detail: string; result: "processed" | "ignored" };

export type SupplierStatus = {
  status: "ok" | "degraded" | "down";
  checkedAt: string;
  account: { reseller: string; sponsor: string; networkProfile: string; writeMode: "read_only" | "enabled" };
  limits: { dailySaleLimit: number; salesToday: number; saleCap: number; capUsed: number };
  jobs: SupplierJob[];
  priceList: { version: number; effectiveFrom: string; syncedAt: string; rises: number; falls: number };
  webhooks: { label: string; path: string }[];
  events: SupplierEvent[];
  balance: { reported: number; reportedAt: string; implied: number; difference: number; tolerance: number; houseWallet: number };
};

export type CustomerDetail = Customer & {
  esims: { id: string; iccid: string; status: import("./status").EsimStatus; suspendedBy: import("./status").SuspendedBy | null; planName: string | null; lastActivityAt: string | null }[];
};
