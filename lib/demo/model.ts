/**
 * The demo store's tables. Internal to lib/demo: money is a number in EUR
 * here and becomes a decimal string at the API boundary, like the backend.
 * Names follow the backend schema.
 */
import type { Grants } from "@/lib/platform/permission-matrix";
import type { EsimStatus, HoldStatus, InstallStatus, OrderStatus, SuspendedBy, TopupStatus } from "@/lib/platform/status";
import type { LedgerType, Role } from "@/lib/platform/types";

export const SCHEMA_VERSION = 3;

export type DUser = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: Role;
  resellerId: string | null;
  staffRoleId: string | null;
  /** Assistants: their toggles (set by their reseller). */
  grants: Grants;
  status: "active" | "disabled";
  locked: boolean;
  mfaEnrolled: boolean;
  mustChangePassword: boolean;
  lastSignInAt: string | null;
  createdAt: string;
};

export type DStaffRole = { id: string; name: string; grants: Grants };

export type DReseller = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  status: "active" | "suspended";
  markupPercent: number;
  createdAt: string;
};

export type DCustomer = { id: string; name: string; email: string; phone: string; resellerId: string | null; createdAt: string };

export type DPlan = {
  id: string;
  name: string;
  zoneId: string;
  dataBytes: number;
  validityDays: number;
  status: "draft" | "active" | "inactive";
  holdOverride: number | null;
  createdAt: string;
};

export type DResellerPlan = {
  id: string;
  resellerId: string;
  planId: string;
  name: string;
  description: string;
  sellingPrice: number;
  status: "active" | "inactive";
  createdAt: string;
};

export type DDiscount = { id: string; resellerId: string; planId: string | null; percent: number; status: "active" | "inactive"; createdAt: string };

export type DEsim = {
  id: string;
  iccid: string;
  status: EsimStatus;
  suspendedBy: SuspendedBy | null;
  installStatus: InstallStatus;
  installStatusRaw: string | null;
  resellerId: string | null;
  customerId: string | null;
  activationCode: string;
  smdpAddress: string;
  createdAt: string;
  lastActivityAt: string | null;
};

export type PackageState = "pending_activation" | "active" | "expired" | "depleted" | "deleted";

export type DPackage = {
  id: string;
  esimId: string;
  orderId: string;
  planId: string;
  resellerPlanId: string | null;
  name: string;
  activation: "now" | "first_use" | "date";
  activationDate: string | null;
  startedAt: string | null;
  expiresAt: string | null;
  limitBytes: number;
  state: PackageState;
  adminBlocked: boolean;
  /** Network the phone mostly used (drives country and price). */
  networkId: string;
  holdId: string;
  /** Charged so far, split by status (EUR, in the buyer's prices). */
  chargedFinal: number;
  chargedEstimated: number;
  createdAt: string;
};

export type DOrder = {
  id: string;
  type: "new_esim" | "add_plan";
  esimId: string | null;
  packageId: string | null;
  planId: string;
  resellerId: string | null;
  userId: string;
  status: OrderStatus;
  funding: "active" | "waiting" | null;
  holdAmount: number;
  failureReason: string | null;
  idempotencyKey: string | null;
  retailAmount: number | null;
  createdAt: string;
};

export type DWallet = { id: string; kind: "reseller" | "house"; resellerId: string | null; balance: number; outstanding: number; lowThreshold: number };

export type DHold = {
  id: string;
  walletId: string;
  packageId: string;
  esimId: string;
  orderId: string;
  amount: number;
  used: number;
  status: HoldStatus;
  createdAt: string;
  fundedAt: string | null;
};

export type DLedger = {
  id: string;
  walletId: string;
  type: LedgerType;
  amount: number;
  balanceAfter: number;
  reference: string;
  description: string;
  estimated: boolean | null;
  createdAt: string;
};

export type DTopup = {
  id: string;
  resellerId: string;
  walletId: string;
  amount: number;
  paymentReference: string;
  note: string;
  status: TopupStatus;
  requestedBy: string;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
  receiptNumber: string | null;
  outstandingPaid: number | null;
  plansFunded: number | null;
};

export type DNotification = { id: string; userId: string; title: string; body: string; href: string | null; createdAt: string; read: boolean };

export type DAudit = {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  resellerId: string | null;
  createdAt: string;
};

/** Daily usage per package: MB per day, index 0 = `start`. */
export type DUsage = { start: string; mb: number[] };

export type DSettings = {
  defaultMarkupPercent: number;
  retailMarkupPercent: number;
  spreadWarningRatio: number;
  waitingPlanCancelDays: number;
  houseWalletLowThreshold: number;
  lowWalletThreshold: number;
  lowStockThreshold: number;
  dailySaleLimit: number;
  saleCap: number;
  freeStock: number;
};

export type DState = {
  schema: number;
  /** The demo's "today" (Asia/Colombo) when it was seeded. */
  seededOn: string;
  session: { userId: string | null; pendingMfaUserId: string | null };
  seq: number;
  settings: DSettings;
  salesToday: { date: string; count: number; capUsed: number };
  staffRoles: DStaffRole[];
  users: DUser[];
  resellers: DReseller[];
  customers: DCustomer[];
  plans: DPlan[];
  resellerPlans: DResellerPlan[];
  discounts: DDiscount[];
  esims: DEsim[];
  packages: DPackage[];
  orders: DOrder[];
  wallets: DWallet[];
  holds: DHold[];
  ledger: DLedger[];
  topups: DTopup[];
  notifications: DNotification[];
  audit: DAudit[];
  usage: Record<string, DUsage>;
  /** Days whose usage report is late (still estimated), per reseller id ("house" for direct). */
  lateDays: Record<string, string[]>;
};
