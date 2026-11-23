/**
 * Rules of the permission matrix (spec 8.17, 8.25). Pure functions, used by
 * the PermissionMatrix component for assistants (reseller navigation) and
 * staff roles (admin navigation).
 *
 * - Levels: none < view < manage; manage implies view.
 * - Manage on turns view on; view off turns manage off.
 * - A row can be "view only" (Dashboard, Usage), "action only" (Sell eSIM:
 *   one switch, stored as manage) or view + manage.
 * - Nothing can exceed the envelope (assistant: their reseller's effective
 *   permissions; staff role: tenant ∩ staff envelope). Out-of-envelope
 *   switches are disabled and explained.
 * - A section switch turns every row of the section on (to the most it may
 *   have) or off.
 */
export type Level = "none" | "view" | "manage";
export type Grants = Record<string, Level>;

export type MatrixRow = {
  module: string;
  label: string;
  /** "both" = View + Manage switches; "view" = view only; "action" = one switch stored as manage. */
  kind: "both" | "view" | "action";
  /** Label for the manage switch when it means something specific ("Request"). */
  manageLabel?: string;
};
export type MatrixSection = { id: string; label: string; rows: MatrixRow[] };

const RANK: Record<Level, number> = { none: 0, view: 1, manage: 2 };

export function minLevel(a: Level, b: Level): Level {
  return RANK[a] <= RANK[b] ? a : b;
}
export function atLeast(level: Level, wanted: Level) {
  return RANK[level] >= RANK[wanted];
}

/** The most a row may have: its kind's maximum, capped by the envelope. */
export function rowMax(row: MatrixRow, envelope: Grants): Level {
  const kindMax: Level = row.kind === "view" ? "view" : "manage";
  return minLevel(kindMax, envelope[row.module] ?? "none");
}

export function levelOf(grants: Grants, module: string): Level {
  return grants[module] ?? "none";
}

/** Can the switch for `wanted` be changed for this row? */
export function canToggle(row: MatrixRow, envelope: Grants, wanted: "view" | "manage") {
  if (row.kind === "action") return atLeast(rowMax(row, envelope), "manage");
  if (wanted === "manage" && row.kind === "view") return false;
  return atLeast(rowMax(row, envelope), wanted);
}

/** View switch. Off also turns manage off; on never exceeds the envelope. */
export function setView(grants: Grants, row: MatrixRow, envelope: Grants, on: boolean): Grants {
  if (!canToggle(row, envelope, "view")) return grants;
  if (!on) return { ...grants, [row.module]: "none" };
  const current = levelOf(grants, row.module);
  return { ...grants, [row.module]: atLeast(current, "view") ? current : "view" };
}

/** Manage switch. On turns view on; off drops back to view. */
export function setManage(grants: Grants, row: MatrixRow, envelope: Grants, on: boolean): Grants {
  if (!canToggle(row, envelope, "manage")) return grants;
  return { ...grants, [row.module]: on ? "manage" : row.kind === "action" ? "none" : "view" };
}

/** The single switch of an action-only row (Sell eSIM). */
export function setAction(grants: Grants, row: MatrixRow, envelope: Grants, on: boolean) {
  return setManage(grants, row, envelope, on);
}

export type SectionState = "on" | "off" | "mixed";

export function sectionState(grants: Grants, section: MatrixSection, envelope: Grants): SectionState {
  const rows = section.rows.filter((r) => rowMax(r, envelope) !== "none");
  if (rows.length === 0) return "off";
  const on = rows.filter((r) => levelOf(grants, r.module) !== "none").length;
  const full = rows.filter((r) => levelOf(grants, r.module) === rowMax(r, envelope)).length;
  if (full === rows.length) return "on";
  if (on === 0) return "off";
  return "mixed";
}

/** Section switch: on = every row at its maximum, off = every row none. */
export function setSection(grants: Grants, section: MatrixSection, envelope: Grants, on: boolean): Grants {
  const next = { ...grants };
  for (const row of section.rows) {
    const max = rowMax(row, envelope);
    if (max === "none") continue;
    next[row.module] = on ? max : "none";
  }
  return next;
}

/** Drops anything above the envelope (e.g. after the reseller lost a feature). */
export function clampToEnvelope(grants: Grants, sections: MatrixSection[], envelope: Grants): Grants {
  const next: Grants = {};
  for (const row of sections.flatMap((s) => s.rows)) {
    next[row.module] = minLevel(levelOf(grants, row.module), rowMax(row, envelope));
  }
  return next;
}

/** "6 of 14 areas enabled". */
export function enabledCount(grants: Grants, sections: MatrixSection[]) {
  const rows = sections.flatMap((s) => s.rows);
  return { enabled: rows.filter((r) => levelOf(grants, r.module) !== "none").length, total: rows.length };
}

/**
 * The assistant matrix: the reseller navigation (spec 5.4) without Team
 * management and without Settings (own profile is always available).
 * Orders has no separate toggle: it follows Sell eSIM (backend; backlog BB-1).
 */
export const RESELLER_MATRIX: MatrixSection[] = [
  { id: "overview", label: "Overview", rows: [{ module: "dashboard", label: "Dashboard", kind: "view" }] },
  {
    id: "sales",
    label: "Sales",
    rows: [
      { module: "sell_esim", label: "Sell eSIM", kind: "action" },
      { module: "reseller_plans", label: "My plans", kind: "both" },
      { module: "coverage", label: "Coverage", kind: "view" },
      { module: "price_lists", label: "Price list", kind: "view" },
    ],
  },
  {
    id: "esims",
    label: "eSIM management",
    rows: [
      { module: "esims", label: "My eSIMs", kind: "both" },
      { module: "usage", label: "Usage", kind: "view" },
    ],
  },
  { id: "customers", label: "Customer management", rows: [{ module: "customers", label: "Customers", kind: "both" }] },
  {
    id: "finance",
    label: "Finance",
    rows: [
      { module: "wallets", label: "Wallet", kind: "view" },
      { module: "topup_requests", label: "Top-up requests", kind: "both", manageLabel: "Request" },
      { module: "transactions", label: "Transactions", kind: "view" },
      { module: "invoices", label: "Invoices", kind: "view" },
    ],
  },
];

/** Default reseller role envelope (spec 5.3), the upper limit for assistants. */
export const RESELLER_ENVELOPE: Grants = {
  dashboard: "view",
  sell_esim: "manage",
  esims: "manage",
  usage: "view",
  alerts: "view",
  reseller_plans: "manage",
  coverage: "view",
  price_lists: "view",
  discounts: "view",
  customers: "manage",
  wallets: "view",
  transactions: "view",
  topup_requests: "manage",
  invoices: "view",
};
