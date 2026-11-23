/**
 * Navigation (spec 5.4): sections with tabs, one tree per role family.
 * A tab shows when the user can `view` one of its modules; a section without
 * visible tabs is hidden. Tabs not built for the demo show as disabled
 * "Coming soon" items (spec 15). The route guard reads the same tree, so the
 * navigation and direct URL access always agree.
 */
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Contact,
  LayoutGrid,
  Package,
  Server,
  ShoppingBag,
  Smartphone,
  UserCog,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import { canAny } from "./permissions";
import type { Module, Permissions, Role } from "./types";

export type NavTab = {
  id: string;
  label: string;
  href: string;
  /** Visible with `view` on any of these. */
  modules: Module[];
  /** Built for the demo; otherwise a disabled "Coming soon" item. */
  ready: boolean;
};
export type NavSection = { id: string; label: string; short: string; icon: LucideIcon; tabs: NavTab[] };

const tab = (id: string, label: string, href: string, modules: Module[], ready: boolean): NavTab => ({ id, label, href, modules, ready });

/** Orders follows Sell eSIM or Transactions (backend; backlog BB-1). */
const ORDERS: Module[] = ["sell_esim", "transactions"];

export const TENANT_NAV: NavSection[] = [
  { id: "overview", label: "Overview", short: "Overview", icon: LayoutGrid, tabs: [tab("dashboard", "Dashboard", "/esim/dashboard", ["dashboard"], true)] },
  {
    id: "esims",
    label: "eSIM management",
    short: "eSIMs",
    icon: Smartphone,
    tabs: [
      tab("esims", "All eSIMs", "/esim/esims", ["esims"], true),
      tab("sell", "Sell eSIM", "/esim/sell", ["sell_esim"], true),
      tab("orders", "Orders", "/esim/orders", ORDERS, true),
      tab("usage", "Usage", "/esim/usage", ["usage"], true),
      tab("inventory", "Inventory", "/esim/inventory", ["inventory"], true),
      tab("alerts", "Alerts and rules", "/esim/alerts", ["alerts"], true),
    ],
  },
  {
    id: "products",
    label: "Product management",
    short: "Products",
    icon: Package,
    tabs: [
      tab("plans", "Plans", "/esim/plans", ["plans"], true),
      tab("coverage", "Coverage", "/esim/coverage", ["coverage"], true),
      tab("price-list", "Price list", "/esim/price-list", ["price_lists"], true),
      tab("discounts", "Discounts", "/esim/discounts", ["discounts"], true),
    ],
  },
  {
    id: "resellers",
    label: "Reseller management",
    short: "Resellers",
    icon: Building2,
    tabs: [
      tab("resellers", "Resellers", "/esim/resellers", ["resellers"], true),
      tab("customers", "Customers", "/esim/customers", ["customers"], true),
      tab("assistants", "Assistants", "/esim/assistants", ["assistants"], true),
    ],
  },
  {
    id: "finance",
    label: "Finance",
    short: "Finance",
    icon: Wallet,
    tabs: [
      tab("wallets", "Wallets", "/esim/wallets", ["wallets"], true),
      tab("transactions", "Transactions", "/esim/transactions", ["transactions"], true),
      tab("topup-requests", "Top-up requests", "/esim/topup-requests", ["topup_requests"], true),
      tab("invoices", "Invoices", "/esim/invoices", ["invoices"], true),
      tab("profit", "Profit and costs", "/esim/profit", ["profit_reports"], true),
    ],
  },
  {
    id: "users",
    label: "User management",
    short: "Users",
    icon: Users,
    tabs: [
      tab("users", "Users", "/esim/users", ["users"], true),
      tab("staff-roles", "Staff roles", "/esim/staff-roles", ["staff_roles"], true),
    ],
  },
  {
    id: "system",
    label: "System",
    short: "System",
    icon: Server,
    tabs: [
      tab("settings", "Settings", "/esim/settings", ["settings"], true),
      tab("yesim", "Yesim connection", "/esim/yesim", ["yesim_connection"], true),
      tab("audit-log", "Audit log", "/esim/audit-log", ["audit_log"], true),
    ],
  },
];

export const RESELLER_NAV: NavSection[] = [
  { id: "overview", label: "Overview", short: "Overview", icon: LayoutGrid, tabs: [tab("dashboard", "Dashboard", "/esim/dashboard", ["dashboard"], true)] },
  {
    id: "sales",
    label: "Sales",
    short: "Sales",
    icon: ShoppingBag,
    tabs: [
      tab("sell", "Sell eSIM", "/esim/sell", ["sell_esim"], true),
      tab("my-plans", "My plans", "/esim/my-plans", ["reseller_plans"], true),
      tab("coverage", "Coverage", "/esim/coverage", ["coverage"], true),
      tab("price-list", "Price list", "/esim/price-list", ["price_lists"], true),
    ],
  },
  {
    id: "esims",
    label: "eSIM management",
    short: "eSIMs",
    icon: Smartphone,
    tabs: [
      tab("esims", "My eSIMs", "/esim/esims", ["esims"], true),
      tab("orders", "Orders", "/esim/orders", ORDERS, true),
      tab("usage", "Usage", "/esim/usage", ["usage"], true),
      // spec 8.9: resellers and assistants see alerts for their own eSIMs (view only)
      tab("alerts", "Alerts", "/esim/alerts", ["alerts"], true),
    ],
  },
  { id: "customers", label: "Customer management", short: "Customers", icon: Contact, tabs: [tab("customers", "Customers", "/esim/customers", ["customers"], true)] },
  {
    id: "finance",
    label: "Finance",
    short: "Finance",
    icon: Wallet,
    tabs: [
      tab("wallet", "Wallet", "/esim/wallet", ["wallets"], true),
      tab("transactions", "Transactions", "/esim/transactions", ["transactions"], true),
      tab("invoices", "Invoices", "/esim/invoices", ["invoices"], true),
    ],
  },
  { id: "team", label: "Team management", short: "Team", icon: UsersRound, tabs: [tab("assistants", "Assistants", "/esim/assistants", ["team"], true)] },
  {
    id: "settings",
    label: "Settings",
    short: "Settings",
    icon: UserCog,
    tabs: [
      tab("profile", "Profile", "/profile", [], true),
      tab("security", "Security", "/profile/security", [], true),
      tab("notifications", "Notifications", "/notifications", [], true),
    ],
  },
];

export function navTree(role: Role): NavSection[] {
  return role === "admin" || role === "staff" ? TENANT_NAV : RESELLER_NAV;
}

/** A tab with no modules is open to everyone (own profile, notifications). */
function tabVisible(t: NavTab, perms: Permissions) {
  return t.modules.length === 0 || canAny(perms, t.modules, "view");
}

/** The user's navigation: hidden tabs removed, empty sections removed. */
export function visibleNav(role: Role, perms: Permissions): NavSection[] {
  return navTree(role)
    .map((s) => ({ ...s, tabs: s.tabs.filter((t) => tabVisible(t, perms)) }))
    .filter((s) => s.tabs.length > 0);
}

export function isTabActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The tab a path belongs to in a tree (longest matching prefix), e.g. /esim/esims/12 -> All eSIMs. */
export function findTab(tree: NavSection[], pathname: string): { section: NavSection; tab: NavTab } | null {
  let best: { section: NavSection; tab: NavTab } | null = null;
  for (const section of tree)
    for (const t of section.tabs)
      if (isTabActive(t.href, pathname) && (!best || t.href.length > best.tab.href.length)) best = { section, tab: t };
  return best;
}

export type RouteAccess =
  | { kind: "ok"; section: NavSection; tab: NavTab }
  | { kind: "coming_soon"; section: NavSection; tab: NavTab }
  | { kind: "denied" }
  | { kind: "unknown" };

/**
 * Route guard decision for a workspace path (routes.md §5): a path in the
 * user's own tree with permission is ok (or "Coming soon" when not built);
 * a path without permission, or one that belongs only to the other role
 * family (e.g. /esim/wallets for a reseller), is denied.
 */
export function routeAccess(role: Role, perms: Permissions, pathname: string): RouteAccess {
  const own = findTab(navTree(role), pathname);
  if (own) {
    if (!tabVisible(own.tab, perms)) return { kind: "denied" };
    return own.tab.ready ? { kind: "ok", ...own } : { kind: "coming_soon", ...own };
  }
  const other = findTab(role === "admin" || role === "staff" ? RESELLER_NAV : TENANT_NAV, pathname);
  // pages for everyone (own profile, notifications) are open even when only the other tree lists them
  if (!other || other.tab.modules.length === 0) return { kind: "unknown" };
  return { kind: "denied" };
}
