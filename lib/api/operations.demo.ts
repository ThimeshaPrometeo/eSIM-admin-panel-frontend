/**
 * Demo operations (spec 8.7 usage, 8.8 inventory, 8.9 alerts and rules,
 * 8.16 customers, 8.27 Yesim connection). Usage figures come from the rated
 * lines in lib/demo/rating, so the usage report agrees with wallets,
 * statements and the profit report.
 */
import { ApiError } from "./errors";
import { NETWORK_BY_ID } from "@/lib/demo/catalogue";
import type { DAlert, DAlertRule, DState } from "@/lib/demo/model";
import { forEachPackageDay, round2 } from "@/lib/demo/rating";
import { read, write } from "@/lib/demo/run";
import { audit, authorize, inScope, nowIso, requireRole, type Caller } from "@/lib/demo/session";
import { priceListSyncedAt, supplierBalance } from "@/lib/demo/supplier";
import { addDays, dateInZone, formatDate } from "@/lib/platform/dates";
import { bucketOf, bucketsIn, type Period } from "@/lib/platform/period";
import type { Alert, AlertRule, AlertStatus, AlertType, Customer, CustomerDetail, Inventory, SupplierEvent, SupplierJob, SupplierJobId, SupplierStatus, UsageReport, UsageReportRow } from "@/lib/platform/types";
import { BYTES } from "@/lib/platform/units";

const resellerName = (s: DState, id: string | null) => (id ? (s.resellers.find((r) => r.id === id)?.companyName ?? id) : null);
const userName = (s: DState, id: string | null) => (id ? (s.users.find((u) => u.id === id)?.fullName ?? "System") : null);

export type UsageFilters = { resellerId?: string | null; planId?: string | null; iso2?: string | null };
export type AlertFilters = { status?: AlertStatus | "active" | null; type?: AlertType | null; resellerId?: string | null };
export type RuleInput = { thresholdPercent: number; action: AlertRule["action"]; enabled: boolean };
export type CustomerInput = { name: string; email: string; phone: string };

function ruleLabel(r: DAlertRule | undefined) {
  return r ? `${r.thresholdPercent}% · ${r.action === "notify" ? "notify" : "auto-suspend"}` : null;
}

function alertView(s: DState, a: DAlert): Alert {
  return {
    id: a.id,
    type: a.type,
    severity: a.severity,
    title: a.title,
    detail: a.detail,
    resellerId: a.resellerId,
    resellerName: resellerName(s, a.resellerId),
    esimId: a.esimId,
    href: a.href,
    rule: ruleLabel(s.alertRules.find((r) => r.id === a.ruleId)),
    status: a.status,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    updatedByName: userName(s, a.updatedBy),
  };
}

function ruleView(s: DState, r: DAlertRule): AlertRule {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  return {
    id: r.id,
    thresholdPercent: r.thresholdPercent,
    action: r.action,
    enabled: r.enabled,
    createdAt: r.createdAt,
    createdByName: userName(s, r.createdBy) ?? "System",
    updatedAt: r.updatedAt,
    raised30d: s.alerts.filter((a) => a.ruleId === r.id && a.createdAt >= since).length,
  };
}

function customerView(s: DState, x: DState["customers"][number]): Customer {
  return {
    id: x.id,
    name: x.name,
    email: x.email,
    phone: x.phone,
    resellerId: x.resellerId,
    resellerName: resellerName(s, x.resellerId),
    esimCount: s.esims.filter((e) => e.customerId === x.id).length,
    createdAt: x.createdAt,
  };
}

function findAlert(c: Caller, id: string) {
  const a = c.s.alerts.find((x) => x.id === id);
  if (!a || !inScope(c, a.resellerId)) throw new ApiError(404, "NOT_FOUND");
  return a;
}

function validRule(input: RuleInput) {
  if (!Number.isFinite(input.thresholdPercent) || input.thresholdPercent < 1 || input.thresholdPercent > 100)
    throw new ApiError(400, "INVALID_THRESHOLD", "Enter a threshold between 1% and 100%.");
}

// ----------------------------------------------------------- supplier jobs

const MIN = 60000;
/** The last scheduled run of an every-n-minutes job, and the next one. */
function every(now: number, minutes: number) {
  const last = Math.floor(now / (minutes * MIN)) * minutes * MIN;
  return { last: new Date(last).toISOString(), next: new Date(last + minutes * MIN).toISOString() };
}
/** The last run of a daily job at hh:mm Colombo time. */
function daily(now: number, hhmm: string) {
  const today = dateInZone(new Date(now));
  let t = Date.parse(`${today}T${hhmm}:00+05:30`);
  if (t > now) t -= 86400000;
  return { last: new Date(t).toISOString(), next: new Date(t + 86400000).toISOString() };
}

function supplierJobs(s: DState): SupplierJob[] {
  const now = Date.now();
  const meter = every(now, 15);
  const funding = every(now, 5);
  const reconcile = every(now, 10);
  const nightly = daily(now, "02:00");
  const catalogue = daily(now, "03:00");
  const metered = s.packages.filter((p) => p.state === "active").length;
  const waiting = s.holds.filter((h) => h.status === "waiting").length;
  const checking = s.orders.filter((o) => o.status === "needs_check").length;
  const late = Object.entries(s.lateDays).filter(([, days]) => days.length > 0);
  const v = s.priceVersions[s.priceVersions.length - 1]!;
  const manualCatalogue = s.jobRuns.catalogue_sync;
  return [
    {
      id: "catalogue_sync",
      label: "Catalogue sync",
      schedule: "Daily at 03:00",
      lastRunAt: manualCatalogue && manualCatalogue > catalogue.last ? manualCatalogue : catalogue.last,
      nextRunAt: catalogue.next,
      durationMs: 8400,
      result: "ok",
      message: `${s.plans.length} plans and their networks checked; no changes.`,
      manual: true,
    },
    {
      id: "price_list_sync",
      label: "Price list sync",
      schedule: "Every 6 hours",
      lastRunAt: priceListSyncedAt(s, now),
      nextRunAt: new Date(Date.parse(priceListSyncedAt(s, now)) + 6 * 60 * MIN).toISOString(),
      durationMs: 5200,
      result: "ok",
      message: `Version ${v.version} is current; no price changes since ${formatDate(`${v.effectiveFrom}T12:00:00Z`)}.`,
      manual: true,
    },
    {
      id: "usage_meter",
      label: "Usage meter",
      schedule: "Every 15 minutes",
      lastRunAt: meter.last,
      nextRunAt: meter.next,
      durationMs: 4100,
      result: "ok",
      message: `Usage read for ${metered} running plans.`,
      manual: false,
    },
    {
      id: "nightly_reprice",
      label: "Nightly re-pricing",
      schedule: "Daily at 02:00",
      lastRunAt: nightly.last,
      nextRunAt: nightly.next,
      durationMs: 61000,
      result: late.length ? "warning" : "ok",
      message: late.length
        ? `Yesterday's usage made final. Late report for ${late.map(([r]) => resellerName(s, r) ?? "direct sales").join(", ")}; those days stay estimated.`
        : "Yesterday's usage made final.",
      manual: false,
    },
    {
      id: "funding_queue",
      label: "Funding queue",
      schedule: "Every 5 minutes",
      lastRunAt: funding.last,
      nextRunAt: funding.next,
      durationMs: 900,
      result: "ok",
      message: waiting ? `${waiting} plan${waiting === 1 ? "" : "s"} still waiting for funds.` : "No plans waiting for funds.",
      manual: false,
    },
    {
      id: "order_reconcile",
      label: "Order reconcile",
      schedule: "Every 10 minutes",
      lastRunAt: reconcile.last,
      nextRunAt: reconcile.next,
      durationMs: 2300,
      result: checking ? "warning" : "ok",
      message: checking ? `${checking} order${checking === 1 ? "" : "s"} being verified; no match at the supplier yet.` : "Every order matches the supplier.",
      manual: false,
    },
  ];
}

/** The latest notifications the supplier sent us, from recent eSIM activity. */
function supplierEvents(s: DState): SupplierEvent[] {
  const TYPE: Partial<Record<string, [string, string]>> = {
    installed: ["esim.installed", "Profile installed on the phone"],
    enabled: ["esim.enabled", "Profile switched on"],
    downloaded: ["esim.downloaded", "Profile downloaded"],
    disabled: ["esim.disabled", "Profile switched off"],
    deleted: ["esim.deleted", "Profile deleted from the phone"],
  };
  return s.esims
    .filter((e) => e.lastActivityAt)
    .sort((a, b) => b.lastActivityAt!.localeCompare(a.lastActivityAt!))
    .slice(0, 12)
    .map((e, i) => {
      const [type, detail] = i % 3 === 0 ? ["usage.reported", "Usage counter updated"] : (TYPE[e.installStatus] ?? ["usage.reported", "Usage counter updated"]);
      return { id: `ev-${e.id}`, at: e.lastActivityAt!, type, esimId: e.id, iccid: e.iccid, detail, result: "processed" as const };
    });
}

export const demoOperations = {
  // ----------------------------------------------------------------- usage
  /** Usage per eSIM in a period (spec 8.7). Charges are what the eSIM's owner paid; Yesim cost for admin/staff. */
  getUsageReport: (period: Pick<Period, "from" | "to" | "granularity">, f: UsageFilters = {}) =>
    read((): UsageReport => {
      const c = authorize("usage");
      const s = c.s;
      const resellerFilter = c.tenant ? (f.resellerId ?? undefined) : c.resellerId;
      const rows = new Map<string, UsageReportRow & { countryMb: Map<string, number>; netMb: Map<string, number>; planSet: Set<string> }>();
      const series = new Map(bucketsIn(period).map((b) => [b, { finalBytes: 0, estimatedBytes: 0 }]));
      const byCountry = new Map<string, number>();
      const plans = new Map<string, string>();
      const countries = new Map<string, string>();
      let estimatedCharge = 0;
      forEachPackageDay(
        s,
        (p, date, lines, charge) => {
          const e = s.esims.find((x) => x.id === p.esimId)!;
          plans.set(p.planId, s.plans.find((x) => x.id === p.planId)?.name ?? p.name);
          for (const l of lines) countries.set(l.iso2, NETWORK_BY_ID.get(l.networkId)?.country ?? l.iso2);
          const ls = f.iso2 ? lines.filter((l) => l.iso2 === f.iso2) : lines;
          if (!ls.length || (f.planId && p.planId !== f.planId)) return;
          // a whole day's charge is rounded once; with a country filter, the lines in that country
          const amount = f.iso2 ? round2(ls.reduce((a, l) => a + l.amount, 0)) : charge;
          const row =
            rows.get(e.id) ??
            ({ esimId: e.id, iccid: e.iccid, customerName: s.customers.find((x) => x.id === e.customerId)?.name ?? null, resellerName: resellerName(s, e.resellerId), plans: [], countries: [], topNetwork: null, bytes: 0, charge: 0, yesimCost: c.tenant ? 0 : null, estimated: false, countryMb: new Map(), netMb: new Map(), planSet: new Set() } as UsageReportRow & { countryMb: Map<string, number>; netMb: Map<string, number>; planSet: Set<string> });
          row.planSet.add(p.name);
          row.charge = round2(row.charge + amount);
          for (const l of ls) {
            const bytes = l.mb * BYTES.MB;
            row.bytes += bytes;
            if (row.yesimCost !== null) row.yesimCost += l.cost;
            row.estimated ||= l.estimated;
            row.countryMb.set(l.iso2, (row.countryMb.get(l.iso2) ?? 0) + l.mb);
            row.netMb.set(l.networkId, (row.netMb.get(l.networkId) ?? 0) + l.mb);
            byCountry.set(l.iso2, (byCountry.get(l.iso2) ?? 0) + bytes);
            const b = series.get(bucketOf(date, period.granularity));
            if (b) {
              if (l.estimated) b.estimatedBytes += bytes;
              else b.finalBytes += bytes;
            }
          }
          if (ls[0]!.estimated) estimatedCharge += amount;
          rows.set(e.id, row);
        },
        { packages: (_p, owner) => (resellerFilter === undefined ? true : resellerFilter === "direct" ? owner === null : owner === resellerFilter), from: period.from, to: period.to },
      );
      const out: UsageReportRow[] = [...rows.values()].map(({ countryMb, netMb, planSet, ...r }) => {
        const top = [...netMb].sort((a, b) => b[1] - a[1])[0]?.[0];
        return {
          ...r,
          plans: [...planSet],
          countries: [...countryMb].sort((a, b) => b[1] - a[1]).map(([k]) => k),
          topNetwork: top ? (NETWORK_BY_ID.get(top)?.operator ?? null) : null,
          yesimCost: r.yesimCost === null ? null : round2(r.yesimCost),
        };
      });
      out.sort((a, b) => b.bytes - a.bytes);
      return {
        totals: {
          bytes: out.reduce((a, r) => a + r.bytes, 0),
          charge: round2(out.reduce((a, r) => a + r.charge, 0)),
          estimatedCharge: round2(estimatedCharge),
          esims: out.length,
          yesimCost: c.tenant ? round2(out.reduce((a, r) => a + (r.yesimCost ?? 0), 0)) : null,
        },
        series: [...series].map(([bucket, v]) => ({ bucket, ...v })),
        byCountry: [...byCountry].map(([iso2, bytes]) => ({ iso2, country: countries.get(iso2) ?? iso2, bytes })).sort((a, b) => b.bytes - a.bytes),
        rows: out,
        options: {
          plans: [...plans].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
          countries: [...countries].map(([iso2, name]) => ({ iso2, name })).sort((a, b) => a.name.localeCompare(b.name)),
        },
        watermark: s.settings.watermark.usage_report,
      };
    }),

  // ------------------------------------------------------------- inventory
  /** Free and assigned eSIMs, 90-day trend (spec 8.8). */
  getInventory: () =>
    read((): Inventory => {
      const c = authorize("inventory");
      requireRole(c, "admin", "staff");
      const s = c.s;
      const today = dateInZone(new Date());
      const createdOn = s.esims.map((e) => dateInZone(new Date(e.createdAt)));
      const series: Inventory["series"] = [];
      for (let i = 89; i >= 0; i--) {
        const d = addDays(today, -i);
        const soldAfter = createdOn.filter((x) => x > d).length;
        const deliveredAfter = s.stockDeliveries.filter((x) => x.date > d).reduce((a, x) => a + x.count, 0);
        series.push({ date: d, free: s.settings.freeStock + soldAfter - deliveredAfter, assigned: createdOn.filter((x) => x <= d).length });
      }
      return {
        free: s.settings.freeStock,
        assigned: s.esims.length,
        threshold: s.settings.lowStockThreshold,
        series,
        deliveries: s.stockDeliveries.map((d) => ({ date: d.date, count: d.count, reference: d.reference })).sort((a, b) => b.date.localeCompare(a.date)),
        sold30d: createdOn.filter((x) => x > addDays(today, -30)).length,
      };
    }),

  // ------------------------------------------------------- alerts and rules
  listAlerts: (f: AlertFilters = {}) =>
    read((): Alert[] => {
      const c = authorize("alerts");
      return c.s.alerts
        .filter((a) => inScope(c, a.resellerId))
        .filter((a) => !f.status || (f.status === "active" ? a.status !== "resolved" : a.status === f.status))
        .filter((a) => (!f.type || a.type === f.type) && (!c.tenant || !f.resellerId || a.resellerId === f.resellerId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((a) => alertView(c.s, a));
    }),
  /** Admin/staff: acknowledge (seen, being handled) or resolve an alert. */
  setAlertStatus: (id: string, status: Exclude<AlertStatus, "open">) =>
    write((): Alert => {
      const c = authorize("alerts", "manage");
      requireRole(c, "admin", "staff");
      const a = findAlert(c, id);
      if (a.status === "resolved") throw new ApiError(409, "ALREADY_RESOLVED", "This alert is already resolved.");
      a.status = status;
      a.updatedAt = nowIso();
      a.updatedBy = c.u.id;
      audit(c, `alert.${status}`, "alert", a.id, `${a.title}: ${status}`, a.resellerId);
      return alertView(c.s, a);
    }),
  listAlertRules: () =>
    read((): AlertRule[] => {
      const c = authorize("alerts");
      return c.s.alertRules.map((r) => ruleView(c.s, r)).sort((a, b) => a.thresholdPercent - b.thresholdPercent);
    }),
  createAlertRule: (input: RuleInput) =>
    write((): AlertRule => {
      const c = authorize("alerts", "manage");
      requireRole(c, "admin", "staff");
      validRule(input);
      if (c.s.alertRules.some((r) => r.thresholdPercent === input.thresholdPercent && r.action === input.action))
        throw new ApiError(409, "RULE_EXISTS", "A rule with this threshold and action already exists.");
      const r: DAlertRule = { id: `rule-${++c.s.seq}`, ...input, createdAt: nowIso(), createdBy: c.u.id, updatedAt: nowIso() };
      c.s.alertRules.push(r);
      audit(c, "alert_rule.created", "alert_rule", r.id, `Rule ${ruleLabel(r)} created`, null);
      return ruleView(c.s, r);
    }),
  updateAlertRule: (id: string, input: RuleInput) =>
    write((): AlertRule => {
      const c = authorize("alerts", "manage");
      requireRole(c, "admin", "staff");
      validRule(input);
      const r = c.s.alertRules.find((x) => x.id === id);
      if (!r) throw new ApiError(404, "NOT_FOUND");
      const before = ruleLabel(r);
      Object.assign(r, input, { updatedAt: nowIso() });
      audit(c, "alert_rule.updated", "alert_rule", r.id, `Rule ${before} → ${ruleLabel(r)}${r.enabled ? "" : " (off)"}`, null);
      return ruleView(c.s, r);
    }),
  deleteAlertRule: (id: string) =>
    write(() => {
      const c = authorize("alerts", "manage");
      requireRole(c, "admin", "staff");
      const r = c.s.alertRules.find((x) => x.id === id);
      if (!r) throw new ApiError(404, "NOT_FOUND");
      c.s.alertRules = c.s.alertRules.filter((x) => x.id !== id);
      audit(c, "alert_rule.deleted", "alert_rule", id, `Rule ${ruleLabel(r)} deleted`, null);
    }),

  // ------------------------------------------------------------- customers
  getCustomer: (id: string) =>
    read((): CustomerDetail => {
      const c = authorize(["customers", "sell_esim"]);
      const x = c.s.customers.find((y) => y.id === id);
      if (!x || !inScope(c, x.resellerId)) throw new ApiError(404, "NOT_FOUND");
      return {
        ...customerView(c.s, x),
        esims: c.s.esims
          .filter((e) => e.customerId === x.id)
          .map((e) => {
            const live = c.s.packages.filter((p) => p.esimId === e.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            const current = live.find((p) => p.state === "active") ?? live.find((p) => p.state === "pending_activation") ?? live[0];
            return { id: e.id, iccid: e.iccid, status: e.status, suspendedBy: e.suspendedBy, planName: current?.name ?? null, lastActivityAt: e.lastActivityAt };
          }),
      };
    }),
  updateCustomer: (id: string, input: CustomerInput) =>
    write((): Customer => {
      const c = authorize(["customers"], "manage");
      const x = c.s.customers.find((y) => y.id === id);
      if (!x || !inScope(c, x.resellerId)) throw new ApiError(404, "NOT_FOUND");
      if (!input.name.trim()) throw new ApiError(400, "NAME_REQUIRED", "Enter the customer's name.");
      if (input.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) throw new ApiError(400, "INVALID_EMAIL", "Enter a valid email address.");
      x.name = input.name.trim();
      x.email = input.email.trim();
      x.phone = input.phone.trim();
      audit(c, "customer.updated", "customer", x.id, `Customer ${x.name} updated`, x.resellerId);
      return customerView(c.s, x);
    }),

  // ------------------------------------------------------- Yesim connection
  getSupplierStatus: () =>
    read((): SupplierStatus => {
      const c = authorize("yesim_connection");
      requireRole(c, "admin", "staff");
      const s = c.s;
      const v = s.priceVersions[s.priceVersions.length - 1]!;
      const bal = supplierBalance(s);
      const house = s.wallets.find((w) => w.kind === "house")!;
      return {
        status: "ok",
        checkedAt: new Date(Math.floor(Date.now() / MIN) * MIN).toISOString(),
        account: { reseller: "B2B_ENIGMA", sponsor: "SP05", networkProfile: "SP05_YESEN01", writeMode: "read_only" },
        limits: { dailySaleLimit: s.settings.dailySaleLimit, salesToday: s.salesToday.count, saleCap: s.settings.saleCap, capUsed: s.salesToday.capUsed },
        jobs: supplierJobs(s),
        priceList: { version: v.version, effectiveFrom: v.effectiveFrom, syncedAt: priceListSyncedAt(s), rises: v.changes.filter((x) => x.newCost > x.oldCost).length, falls: v.changes.filter((x) => x.newCost < x.oldCost).length },
        webhooks: [
          { label: "eSIM events (install, status)", path: "/api/v1/webhooks/yesim/esim-events" },
          { label: "Usage reports", path: "/api/v1/webhooks/yesim/usage-reports" },
        ],
        events: supplierEvents(s),
        balance: { reported: bal.reported, reportedAt: bal.reportedAt, implied: bal.implied, difference: bal.difference, tolerance: bal.tolerance, houseWallet: round2(house.balance) },
      };
    }),
  /** Admin: "Sync now" for the catalogue or the price list. Demo: nothing changed at the supplier. */
  runSupplierJob: (id: Extract<SupplierJobId, "catalogue_sync" | "price_list_sync">) =>
    write(() => {
      const c = authorize("yesim_connection", "manage");
      requireRole(c, "admin");
      const at = nowIso();
      c.s.jobRuns[id] = at;
      audit(c, id === "catalogue_sync" ? "catalogue.synced" : "price_list.synced", id === "catalogue_sync" ? "catalogue" : "price_list", "current", `${id === "catalogue_sync" ? "Catalogue" : "Price list"} sync: no changes`, null);
      return { status: "unchanged" as const, at };
    }),
};

export type OperationsApi = typeof demoOperations;
