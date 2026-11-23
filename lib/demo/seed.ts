/**
 * Demo seed (docs/demo-data.md). Deterministic for a given day: one PRNG with
 * a fixed seed, dates relative to "today" in Asia/Colombo so the demo always
 * looks current. Wallet balances are the sum of their ledger; holds and
 * charges follow the pricing rules in ./pricing.
 */
import { isPriced, type Network } from "@/lib/platform/coverage";
import { addDays, dateInZone, DEFAULT_TIME_ZONE } from "@/lib/platform/dates";
import type { Grants } from "@/lib/platform/permission-matrix";
import type { InstallStatus } from "@/lib/platform/status";
import { BYTES } from "@/lib/platform/units";
import { NETWORK_BY_ID, zoneNetworks } from "./catalogue";
import type { DAudit, DEsim, DHold, DLedger, DNotification, DOrder, DPackage, DPlan, DState, DTopup, DUsage, DUser } from "./model";
import { SCHEMA_VERSION } from "./model";
import { buyerPricePerMb, holdFor, round2, type Buyer } from "./pricing";
import { createRng, luhn, type Rng } from "./rng";

export const SEED = 20261119;
export const SMDP_ADDRESS = "smdp.demo-supplier.example";
const DAYS = 90;

/** ISO instant for a Colombo local time on `today + offset` days. */
function instant(today: string, offset: number, hour = 10, minute = 0) {
  const d = addDays(today, offset);
  return new Date(`${d}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`).toISOString();
}

const POPULAR: Record<string, number> = {
  IT: 6, FR: 4, ES: 4, DE: 3, GB: 3, GR: 3, PT: 2, NL: 2, CH: 1, AT: 1, TH: 5, JP: 4, SG: 3, AE: 4, LK: 4, IN: 2, MV: 3,
  ID: 2, MY: 2, VN: 2, KR: 2, US: 4, TR: 3, AU: 2, HK: 2, CA: 1, MX: 1, EG: 1, ZA: 1,
};

function pickNetwork(rng: Rng, zoneId: string, opts: { maxCost?: number; minCost?: number } = {}): Network {
  const nets = zoneNetworks(zoneId).filter(
    (n) => isPriced(n) && n.iso2 !== "--" && (opts.maxCost === undefined || n.costPerMb! <= opts.maxCost) && (opts.minCost === undefined || n.costPerMb! >= opts.minCost),
  );
  const countries = [...new Set(nets.map((n) => n.iso2))];
  const iso = rng.weighted(countries.map((c) => [c, POPULAR[c] ?? 0.25] as const));
  return rng.pick(nets.filter((n) => n.iso2 === iso));
}

export function createSeed(now: Date = new Date()): DState {
  const rng = createRng(SEED);
  const today = dateInZone(now, DEFAULT_TIME_ZONE);
  const at = (offset: number, h?: number, m?: number) => instant(today, offset, h, m);
  let seq = 1000;
  const id = (prefix: string) => `${prefix}${++seq}`;

  // ---------------------------------------------------------------- people
  const staffRoles = [
    {
      id: "sr-support",
      name: "Support",
      grants: {
        dashboard: "view", sell_esim: "manage", esims: "manage", usage: "view", orders: "manage", alerts: "manage", customers: "manage",
        coverage: "view", price_lists: "view", plans: "view", discounts: "view", resellers: "view", assistants: "view", wallets: "view",
        transactions: "view", topup_requests: "view", audit_log: "view", reseller_plans: "view",
      } as Grants,
    },
    {
      id: "sr-finance",
      name: "Finance",
      grants: {
        dashboard: "view", wallets: "manage", transactions: "view", topup_requests: "manage", invoices: "manage", profit_reports: "view",
        resellers: "view", price_lists: "view", coverage: "view", plans: "view", discounts: "view",
      } as Grants,
    },
  ];

  const resellers = [
    { id: "r1", companyName: "Lanka Roam Travels", contactName: "Amaya Jayasuriya", email: "amaya@lankaroam.example", phone: "+94 77 412 3388", status: "active" as const, markupPercent: 25, createdAt: at(-240) },
    { id: "r2", companyName: "Blue Horizon Tours", contactName: "Thilan Wickramasinghe", email: "thilan@bluehorizon.example", phone: "+94 71 220 9145", status: "active" as const, markupPercent: 15, createdAt: at(-300) },
    { id: "r3", companyName: "Nomad Connect", contactName: "Rehan Gunawardena", email: "rehan@nomadconnect.example", phone: "+94 76 551 0072", status: "active" as const, markupPercent: 40, createdAt: at(-180) },
    { id: "r4", companyName: "Coral Bay Holidays", contactName: "Shanika de Silva", email: "shanika@coralbay.example", phone: "+94 70 318 6620", status: "active" as const, markupPercent: 30, createdAt: at(-120) },
    { id: "r5", companyName: "Atlas Mobile Partners", contactName: "Pradeep Kumara", email: "pradeep@atlasmobile.example", phone: "+94 75 904 2231", status: "active" as const, markupPercent: 20, createdAt: at(-150) },
    { id: "r6", companyName: "Sunset Trails", contactName: "Malsha Herath", email: "malsha@sunsettrails.example", phone: "+94 72 667 1409", status: "suspended" as const, markupPercent: 35, createdAt: at(-200) },
  ];

  const user = (u: Partial<DUser> & Pick<DUser, "id" | "username" | "fullName" | "email" | "role">): DUser => ({
    resellerId: null,
    staffRoleId: null,
    grants: {},
    status: "active",
    locked: false,
    mfaEnrolled: true,
    mustChangePassword: false,
    lastSignInAt: at(-rng.int(0, 6), rng.int(8, 18), rng.int(0, 59)),
    createdAt: at(-rng.int(120, 320)),
    ...u,
  });
  const users: DUser[] = [
    user({ id: "u-admin", username: "nadeesha", fullName: "Nadeesha Perera", email: "nadeesha@company.example", role: "admin" }),
    user({ id: "u-support", username: "kasun", fullName: "Kasun Silva", email: "kasun@company.example", role: "staff", staffRoleId: "sr-support" }),
    // a new Finance colleague: first sign-in still to come (forced password change, 2FA not set up yet)
    user({ id: "u-finance", username: "dilini", fullName: "Dilini Fernando", email: "dilini@company.example", role: "staff", staffRoleId: "sr-finance", mfaEnrolled: false, mustChangePassword: true, lastSignInAt: null, createdAt: at(-2) }),
    ...resellers.map((r, i) =>
      user({
        id: `u-${r.id}`,
        username: ["amaya", "thilan", "rehan", "shanika", "pradeep", "malsha"][i]!,
        fullName: r.contactName,
        email: r.email,
        role: "reseller",
        resellerId: r.id,
      }),
    ),
    user({
      id: "u-sahan",
      username: "sahan",
      fullName: "Sahan Bandara",
      email: "sahan@lankaroam.example",
      role: "assistant",
      resellerId: "r1",
      grants: { dashboard: "view", sell_esim: "manage", esims: "manage", customers: "manage", coverage: "view", price_lists: "view" },
    }),
    user({
      id: "u-ishara",
      username: "ishara",
      fullName: "Ishara Weerasinghe",
      email: "ishara@lankaroam.example",
      role: "assistant",
      resellerId: "r1",
      grants: { dashboard: "view", wallets: "view", transactions: "view", invoices: "view", topup_requests: "manage" },
    }),
    user({ id: "u-ruwan", username: "ruwan", fullName: "Ruwan Dissanayake", email: "ruwan@lankaroam.example", role: "assistant", resellerId: "r1", status: "disabled", grants: { dashboard: "view" } }),
  ];

  const FIRST = ["Nimal", "Dinithi", "Ayesha", "Chamara", "Hiruni", "Kavindu", "Sanduni", "Tharindu", "Isuru", "Nethmi", "Sachini", "Lahiru", "Oshadi", "Ravindu", "Anjali", "Mihiri", "Yasas", "Pasindu", "Gayani", "Dulaj", "Emma", "Lucas", "Sofia", "Noah", "Mia", "Leo", "Hana", "Arjun", "Priya", "Omar"];
  // Sri Lankan first names with Sri Lankan surnames; travellers from abroad with surnames from abroad
  const LAST_LK = ["Perera", "Fernando", "de Silva", "Jayawardena", "Ranasinghe", "Wijesinghe", "Abeysekera", "Karunaratne", "Senanayake", "Mendis"];
  const LAST_INTL = ["Rossi", "Müller", "Tanaka", "Khan", "Nair", "Haddad", "Martin", "Novak"];
  const owners: (string | null)[] = [null, "r1", "r2", "r3", "r4", "r5", "r6"];
  const customers = Array.from({ length: 60 }, (_, i) => {
    const first = FIRST[i % FIRST.length]!;
    const lastNames = i % FIRST.length < 20 ? LAST_LK : LAST_INTL;
    const last = lastNames[(i * 7) % lastNames.length]!;
    const resellerId = i < 20 ? null : owners[1 + (i % 6)]!;
    return {
      id: `c${i + 1}`,
      name: `${first} ${last}`,
      email: `${first}.${last}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z.]/g, "") + "@mail.example",
      phone: `+94 7${rng.int(0, 8)} ${rng.digits(3)} ${rng.digits(4)}`,
      resellerId,
      createdAt: at(-rng.int(10, 160)),
    };
  });

  // ------------------------------------------------------------ catalogue
  const GB = BYTES.GB;
  const plans: DPlan[] = [
    { id: "p-it1", name: "Italy 1 GB", zoneId: "lz79313", dataBytes: 1 * GB, validityDays: 7, status: "active", holdOverride: null, createdAt: at(-200) },
    { id: "p-it3", name: "Italy 3 GB", zoneId: "lz79313", dataBytes: 3 * GB, validityDays: 15, status: "active", holdOverride: null, createdAt: at(-200) },
    { id: "p-it5", name: "Italy 5 GB", zoneId: "lz79313", dataBytes: 5 * GB, validityDays: 30, status: "active", holdOverride: null, createdAt: at(-200) },
    { id: "p-eu5", name: "Europe 5 GB", zoneId: "z-europe30", dataBytes: 5 * GB, validityDays: 15, status: "active", holdOverride: null, createdAt: at(-180) },
    { id: "p-eu10", name: "Europe 10 GB", zoneId: "z-europe30", dataBytes: 10 * GB, validityDays: 30, status: "active", holdOverride: null, createdAt: at(-180) },
    { id: "p-eu20", name: "Europe 20 GB", zoneId: "z-europe30", dataBytes: 20 * GB, validityDays: 30, status: "active", holdOverride: null, createdAt: at(-180) },
    { id: "p-asia5", name: "Asia 5 GB", zoneId: "z-asia", dataBytes: 5 * GB, validityDays: 15, status: "active", holdOverride: null, createdAt: at(-160) },
    { id: "p-world10", name: "Worldwide 10 GB", zoneId: "z-world", dataBytes: 10 * GB, validityDays: 30, status: "active", holdOverride: 150, createdAt: at(-150) },
    { id: "p-it10", name: "Italy 10 GB", zoneId: "lz79313", dataBytes: 10 * GB, validityDays: 30, status: "draft", holdOverride: null, createdAt: at(-6) },
    { id: "p-eu3", name: "Europe 3 GB", zoneId: "z-europe30", dataBytes: 3 * GB, validityDays: 7, status: "inactive", holdOverride: null, createdAt: at(-220) },
  ];
  const planById = new Map(plans.map((p) => [p.id, p]));

  const discounts = [
    { id: "d1", resellerId: "r1", planId: null, percent: 5, status: "active" as const, createdAt: at(-90) },
    { id: "d2", resellerId: "r1", planId: "p-it3", percent: 10, status: "active" as const, createdAt: at(-60) },
    { id: "d3", resellerId: "r3", planId: null, percent: 8, status: "active" as const, createdAt: at(-75) },
    { id: "d4", resellerId: "r5", planId: "p-eu10", percent: 3, status: "active" as const, createdAt: at(-40) },
  ];

  const resellerPlans = [
    { id: "rp1", resellerId: "r1", planId: "p-it3", name: "Rome weekend", description: "Three days of maps, messages and photos around Rome.", sellingPrice: 19, status: "active" as const, createdAt: at(-80) },
    { id: "rp2", resellerId: "r1", planId: "p-eu10", name: "Europe explorer", description: "A month across 30 countries.", sellingPrice: 39, status: "active" as const, createdAt: at(-70) },
    { id: "rp3", resellerId: "r1", planId: "p-asia5", name: "Maldives and beyond", description: "", sellingPrice: 24, status: "inactive" as const, createdAt: at(-110) },
    { id: "rp4", resellerId: "r2", planId: "p-eu5", name: "Blue Europe 5", description: "Our best seller for two-week tours.", sellingPrice: 22, status: "active" as const, createdAt: at(-150) },
    { id: "rp5", resellerId: "r3", planId: "p-world10", name: "Nomad anywhere", description: "", sellingPrice: 79, status: "active" as const, createdAt: at(-60) },
  ];

  const settings = {
    defaultMarkupPercent: 25,
    retailMarkupPercent: 60,
    spreadWarningRatio: 3,
    waitingPlanCancelDays: 30,
    houseWalletLowThreshold: 500,
    lowWalletThreshold: 50,
    lowStockThreshold: 20,
    dailySaleLimit: 50,
    saleCap: 500,
    freeStock: 23,
  };

  const s: DState = {
    schema: SCHEMA_VERSION,
    seededOn: today,
    session: { userId: null, pendingMfaUserId: null },
    seq: 0,
    settings,
    salesToday: { date: today, count: 12, capUsed: 183 },
    staffRoles,
    users,
    resellers,
    customers,
    plans,
    resellerPlans,
    discounts,
    esims: [],
    packages: [],
    orders: [],
    wallets: [
      { id: "w-house", kind: "house", resellerId: null, balance: 0, outstanding: 0, lowThreshold: settings.houseWalletLowThreshold },
      ...resellers.map((r) => ({ id: `w-${r.id}`, kind: "reseller" as const, resellerId: r.id, balance: 0, outstanding: 0, lowThreshold: settings.lowWalletThreshold })),
    ],
    holds: [],
    ledger: [],
    topups: [],
    notifications: [],
    audit: [],
    usage: {},
    lateDays: { r2: [addDays(today, -3)] },
  };

  const walletOf = (resellerId: string | null) => (resellerId ? `w-${resellerId}` : "w-house");
  const buyerOf = (resellerId: string | null): Buyer => (resellerId ? { kind: "reseller", resellerId } : { kind: "house" });
  const userFor = (resellerId: string | null) =>
    resellerId ? (rng.chance(0.25) && resellerId === "r1" ? "u-sahan" : `u-${resellerId}`) : rng.chance(0.6) ? "u-support" : "u-admin";

  // -------------------------------------------------------- eSIMs and plans
  const newIccid = () => {
    const body = `893720401${rng.digits(9)}`;
    return body + luhn(body);
  };
  const newCode = () => {
    const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const part = (n: number) => Array.from({ length: n }, () => A[rng.int(0, A.length - 1)]).join("");
    return `${part(4)}-${part(4)}-${part(4)}-${part(4)}`;
  };

  type PlanStory = "active" | "pending" | "expired" | "deleted";

  /** Adds a package with its order, hold and usage. `start` = first day of use (offset), null = not started. */
  const addPackage = (e: DEsim, plan: DPlan, opts: { start: number | null; created: number; story: PlanStory; type: "new_esim" | "add_plan"; network?: Network; maxCost?: number }) => {
    const buyer = buyerOf(e.resellerId);
    const network = opts.network ?? pickNetwork(rng, plan.zoneId, { maxCost: opts.maxCost ?? (plan.zoneId === "z-world" ? 0.004 : undefined) });
    const holdAmount = holdFor(s, plan, buyer);
    const limitMb = plan.dataBytes / BYTES.MB;
    const pkgId = id("pk");
    const orderId = id("o");
    const holdId = id("h");
    const activation = opts.story === "pending" ? (rng.chance(0.85) ? "first_use" : "date") : rng.weighted([["first_use", 65], ["now", 30], ["date", 5]] as const);
    const createdAt = at(opts.created, rng.int(8, 20), rng.int(0, 59));
    let chargedFinal = 0;
    let chargedEstimated = 0;
    let state: DPackage["state"] = "pending_activation";
    let startedAt: string | null = null;
    let expiresAt: string | null = null;

    if (opts.start !== null) {
      startedAt = at(opts.start, rng.int(6, 22), rng.int(0, 59));
      expiresAt = at(opts.start + plan.validityDays, 23, 59);
      // a deleted plan stops using data on the day it was deleted
      const deletedOn = opts.story === "deleted" ? Math.min(0, opts.start + rng.int(1, 5)) : null;
      const lastDay = Math.min(opts.start + plan.validityDays - 1, 0, deletedOn ?? 0);
      const days = lastDay - opts.start + 1;
      const mb: number[] = [];
      let total = 0;
      const intensity = rng.float(0.25, 1.35);
      for (let d = 0; d < days; d++) {
        const want = rng.chance(0.12) ? 0 : (limitMb / plan.validityDays) * intensity * rng.float(0.3, 1.7);
        const v = Math.max(0, Math.min(want, limitMb - total));
        const rounded = Math.round(v * 10) / 10;
        mb.push(rounded);
        total += rounded;
      }
      s.usage[pkgId] = { start: addDays(today, opts.start), mb } satisfies DUsage;
      const price = buyerPricePerMb(s, buyer, network, plan.id) ?? 0;
      const late = s.lateDays[e.resellerId ?? "house"] ?? [];
      mb.forEach((v, d) => {
        const day = addDays(today, opts.start! + d);
        const amount = v * price;
        if (opts.start! + d >= -1 || late.includes(day)) chargedEstimated += amount;
        else chargedFinal += amount;
      });
      const depleted = total >= limitMb - 0.05;
      state = opts.story === "deleted" ? "deleted" : opts.start + plan.validityDays <= 0 ? (depleted ? "depleted" : "expired") : depleted ? "depleted" : "active";
      if (deletedOn !== null) expiresAt = at(deletedOn, 12);
    }

    const used = round2(chargedFinal + chargedEstimated);
    const live = state === "active" || state === "pending_activation";
    const hold: DHold = {
      id: holdId,
      walletId: walletOf(e.resellerId),
      packageId: pkgId,
      esimId: e.id,
      orderId,
      amount: holdAmount,
      used: Math.min(used, holdAmount),
      status: live ? "active" : "settled",
      createdAt,
      fundedAt: createdAt,
    };
    const pkg: DPackage = {
      id: pkgId,
      esimId: e.id,
      orderId,
      planId: plan.id,
      resellerPlanId: null,
      name: plan.name,
      activation,
      activationDate: activation === "date" ? at(opts.start ?? opts.created + 3, 9) : null,
      startedAt,
      expiresAt,
      limitBytes: plan.dataBytes,
      state,
      adminBlocked: false,
      networkId: network.id,
      holdId,
      chargedFinal: round2(chargedFinal),
      chargedEstimated: round2(chargedEstimated),
      createdAt,
    };
    const order: DOrder = {
      id: orderId,
      type: opts.type,
      esimId: e.id,
      packageId: pkgId,
      planId: plan.id,
      resellerId: e.resellerId,
      userId: userFor(e.resellerId),
      status: "completed",
      funding: "active",
      holdAmount,
      failureReason: null,
      idempotencyKey: null,
      retailAmount: e.resellerId === null && rng.chance(0.5) ? Math.round(holdAmount * 0.6 + 8) : null,
      createdAt,
    };
    s.packages.push(pkg);
    s.holds.push(hold);
    s.orders.push(order);
    return { pkg, hold, order };
  };

  const newEsim = (resellerId: string | null, created: number): DEsim => {
    const own = customers.filter((c) => c.resellerId === resellerId);
    const e: DEsim = {
      id: id("e"),
      iccid: newIccid(),
      status: "ACTIVE",
      suspendedBy: null,
      installStatus: "installed",
      installStatusRaw: null,
      resellerId,
      customerId: own.length && rng.chance(0.8) ? rng.pick(own).id : null,
      activationCode: newCode(),
      smdpAddress: SMDP_ADDRESS,
      createdAt: at(created, rng.int(8, 20), rng.int(0, 59)),
      lastActivityAt: null,
    };
    s.esims.push(e);
    return e;
  };

  const PLAN_WEIGHTS = [["p-it3", 6], ["p-it1", 2], ["p-it5", 2], ["p-eu5", 3], ["p-eu10", 3], ["p-eu20", 1], ["p-asia5", 3], ["p-world10", 1]] as const;
  const COUNTS: [string | null, number][] = [[null, 25], ["r2", 35], ["r1", 28], ["r3", 14], ["r5", 8], ["r4", 6], ["r6", 4]];

  for (const [owner, count] of COUNTS) {
    for (let i = 0; i < count; i++) {
      // r4, r5 and r6 have no running plans (zero balance, outstanding, suspended)
      const quiet = owner === "r4" || owner === "r5" || owner === "r6";
      const n = rng.weighted([[1, 60], [2, 30], [3, 10]] as const);
      const lastStory: PlanStory = quiet ? "expired" : rng.weighted([["active", 55], ["pending", 12], ["expired", 28], ["deleted", 5]] as const);
      const chosen = Array.from({ length: n }, () => planById.get(rng.weighted(PLAN_WEIGHTS))!);
      // timeline from the last plan backwards
      const starts: (number | null)[] = [];
      const created: number[] = [];
      let next: number | null = null;
      for (let k = n - 1; k >= 0; k--) {
        const plan = chosen[k]!;
        const v = plan.validityDays;
        let start: number | null;
        if (k === n - 1) {
          if (lastStory === "pending") start = null;
          else if (lastStory === "expired") start = -(v + rng.int(1, quiet ? 25 : 30));
          else start = -rng.int(0, Math.min(v - 1, 20));
        } else {
          start = (next ?? 0) - v - rng.int(1, 12);
        }
        if (start !== null && start < -(DAYS - 1)) break;
        starts.unshift(start);
        created.unshift(start === null ? -rng.int(0, 12) : start - rng.int(0, 2));
        if (start !== null) next = start;
      }
      if (starts.length === 0) {
        starts.push(-(DAYS - 1) + rng.int(0, 10));
        created.push(starts[0]! - 1);
        chosen.splice(0, chosen.length - 1);
      }
      const used = chosen.slice(chosen.length - starts.length);
      const e = newEsim(owner, Math.min(...created));
      used.forEach((plan, k) => {
        const story: PlanStory = k === used.length - 1 ? lastStory : "expired";
        addPackage(e, plan, { start: starts[k]!, created: created[k]!, story, type: k === 0 ? "new_esim" : "add_plan" });
      });
    }
  }

  const pkgsOf = (esimId: string) => s.packages.filter((p) => p.esimId === esimId);
  const esimsOf = (resellerId: string | null) => s.esims.filter((e) => e.resellerId === resellerId);
  const liveEsims = (resellerId: string | null) => esimsOf(resellerId).filter((e) => pkgsOf(e.id).some((p) => p.state === "active"));

  // ---------------------------------------------------------------- stories
  // r1: one add-plan waiting for funds (3 days ago) and one new eSIM blocked until funded (yesterday)
  {
    const target = liveEsims("r1")[0]!;
    const plan = planById.get("p-eu10")!;
    const { pkg, hold, order } = addPackage(target, plan, { start: null, created: -3, story: "pending", type: "add_plan" });
    hold.status = "waiting";
    hold.fundedAt = null;
    order.status = "awaiting_funds";
    order.funding = "waiting";
    pkg.activation = "first_use";
    pkg.activationDate = null;
  }
  {
    const e = newEsim("r1", -1);
    e.installStatus = "not_installed";
    const { hold, order, pkg } = addPackage(e, planById.get("p-it5")!, { start: null, created: -1, story: "pending", type: "new_esim" });
    hold.status = "waiting";
    hold.fundedAt = null;
    order.funding = "waiting";
    pkg.activation = "first_use";
    pkg.activationDate = null;
  }
  // r2: a plan blocked by an admin
  {
    const p = s.packages.find((x) => x.state === "active" && s.esims.find((e) => e.id === x.esimId)?.resellerId === "r2")!;
    p.adminBlocked = true;
  }
  // r5: Worldwide plan whose hold was used up on an expensive network; the overrun became an outstanding amount
  {
    const e = newEsim("r5", -12);
    const expensive = zoneNetworks("z-world").find((n) => n.iso2 === "ID" && (n.costPerMb ?? 0) > 0.05) ?? zoneNetworks("z-world").filter(isPriced).sort((a, b) => b.costPerMb! - a.costPerMb!)[0]!;
    const { pkg, hold } = addPackage(e, planById.get("p-world10")!, { start: -10, created: -11, story: "active", type: "new_esim", network: expensive });
    hold.used = hold.amount;
    hold.status = "exhausted";
    pkg.state = "active";
    const price = buyerPricePerMb(s, { kind: "reseller", resellerId: "r5" }, expensive, pkg.planId)!;
    // keep usage consistent with the hold: the charged amount equals the hold plus the outstanding overrun
    const mbTotal = (hold.amount + 14.37) / price;
    const u = s.usage[pkg.id]!;
    const per = mbTotal / u.mb.length;
    u.mb = u.mb.map(() => Math.round(per * 10) / 10);
    pkg.chargedFinal = round2(hold.amount + 14.37 - per * 2 * price);
    pkg.chargedEstimated = round2(per * 2 * price);
    s.wallets.find((w) => w.id === "w-r5")!.outstanding = 14.37;
  }

  // ------------------------------------------------------- eSIM statuses
  const allR = s.esims.filter((e) => e.resellerId === "r1" || e.resellerId === "r2");
  const pool = allR.filter((e) => pkgsOf(e.id).every((p) => p.state !== "pending_activation"));
  const take = (n: number, from: DEsim[]) => from.splice(0, n);
  const shuffled = [...pool].sort(() => 0).filter((_, i) => i % 3 === 1);
  take(5, shuffled).forEach((e) => {
    e.status = "SUSPENDED";
    e.suspendedBy = "reseller";
  });
  take(3, shuffled).forEach((e) => {
    e.status = "SUSPENDED";
    e.suspendedBy = "admin";
  });
  take(1, shuffled).forEach((e) => {
    e.status = "SUSPENDED";
    e.suspendedBy = "rule";
  });
  const directPool = esimsOf(null).filter((e) => pkgsOf(e.id).every((p) => p.state !== "active" && p.state !== "pending_activation"));
  take(2, directPool).forEach((e) => {
    e.status = "END_OF_LIFE";
    pkgsOf(e.id).forEach((p) => (p.state = p.state === "expired" || p.state === "depleted" ? p.state : "deleted"));
  });
  take(1, directPool).forEach((e) => (e.status = "INACTIVE"));

  // install statuses and last activity
  for (const e of s.esims) {
    const pk = pkgsOf(e.id);
    const started = pk.filter((p) => p.startedAt);
    const lastUse = started
      .map((p) => {
        const u = s.usage[p.id];
        if (!u) return null;
        const lastIdx = u.mb.map((v, i) => (v > 0 ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
        return lastIdx >= 0 ? addDays(u.start, lastIdx) : null;
      })
      .filter((x): x is string => !!x)
      .sort()
      .pop();
    const lastAt = lastUse ? new Date(`${lastUse}T${String(rng.int(8, 22)).padStart(2, "0")}:${String(rng.int(0, 59)).padStart(2, "0")}:00+05:30`) : null;
    // today's activity can't be later than now
    e.lastActivityAt = lastAt ? new Date(Math.min(lastAt.getTime(), now.getTime() - rng.int(4, 90) * 60000)).toISOString() : null;
    if (!started.length) e.installStatus = rng.weighted([["not_installed", 6], ["downloaded", 3]] as const) as InstallStatus;
    else e.installStatus = rng.weighted([["installed", 5], ["enabled", 4], ["disabled", 1]] as const) as InstallStatus;
  }
  const odd = s.esims.find((e) => e.resellerId === "r2" && e.installStatus === "downloaded") ?? s.esims.find((e) => e.installStatus === "not_installed")!;
  odd.installStatus = "unknown";
  odd.installStatusRaw = "Pending-Download-Retry";

  // ---------------------------------------------------------------- orders
  const failed = (resellerId: string | null, planId: string, created: number, reason: string) => {
    s.orders.push({
      id: id("o"),
      type: "new_esim",
      esimId: null,
      packageId: null,
      planId,
      resellerId,
      userId: userFor(resellerId),
      status: "failed",
      funding: null,
      holdAmount: holdFor(s, planById.get(planId)!, buyerOf(resellerId)),
      failureReason: reason,
      idempotencyKey: null,
      retailAmount: null,
      createdAt: at(created, rng.int(9, 19), rng.int(0, 59)),
    });
  };
  failed("r2", "p-eu5", -21, "The supplier rejected the request. No money was taken; the hold was released.");
  failed("r3", "p-asia5", -14, "The supplier did not answer in time. No money was taken; the hold was released.");
  failed(null, "p-it3", -9, "The supplier rejected the request. No money was taken; the hold was released.");
  failed("r1", "p-it1", -33, "No free eSIM was available. No money was taken; the hold was released.");
  s.orders.push({
    id: "o-verify",
    type: "new_esim",
    esimId: null,
    packageId: null,
    planId: "p-it3",
    resellerId: "r2",
    userId: "u-r2",
    status: "needs_check",
    funding: "active",
    holdAmount: holdFor(s, planById.get("p-it3")!, buyerOf("r2")),
    failureReason: null,
    idempotencyKey: null,
    retailAmount: null,
    createdAt: new Date(now.getTime() - 50 * 60000).toISOString(),
  });
  for (const [r, plan, created] of [["r3", "p-eu10", -46], ["r1", "p-world10", -27]] as const)
    s.orders.push({
      id: id("o"),
      type: "add_plan",
      esimId: esimsOf(r)[0]?.id ?? null,
      packageId: null,
      planId: plan,
      resellerId: r,
      userId: `u-${r}`,
      status: "cancelled",
      funding: "waiting",
      holdAmount: holdFor(s, planById.get(plan)!, buyerOf(r)),
      failureReason: "Cancelled after 30 days without funds.",
      idempotencyKey: null,
      retailAmount: null,
      createdAt: at(created, 11),
    });

  // ------------------------------------------------------ ledger and top-ups
  const ledger: DLedger[] = [];
  const reservedOf = (walletId: string) =>
    s.holds.filter((h) => h.walletId === walletId && h.status === "active").reduce((sum, h) => sum + (h.amount - h.used), 0);

  // usage charges per wallet per day
  const chargesByWallet = new Map<string, number[]>();
  for (const p of s.packages) {
    const u = s.usage[p.id];
    if (!u) continue;
    const e = s.esims.find((x) => x.id === p.esimId)!;
    const w = walletOf(e.resellerId);
    const arr = chargesByWallet.get(w) ?? new Array<number>(DAYS).fill(0);
    const price = buyerPricePerMb(s, buyerOf(e.resellerId), NETWORK_BY_ID.get(p.networkId)!, p.planId) ?? 0;
    u.mb.forEach((v, i) => {
      const offset = Math.round((new Date(`${u.start}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86400000) + i;
      const idx = offset + DAYS - 1;
      if (idx >= 0 && idx < DAYS) arr[idx]! += v * price;
    });
    chargesByWallet.set(w, arr);
  }
  // the r5 overrun beyond its hold: charged until the wallet was empty, the rest is outstanding
  const TARGET_AVAILABLE: Record<string, number | "zero"> = { "w-house": 2480, "w-r1": 0.4, "w-r2": 1240, "w-r3": 18, "w-r4": "zero", "w-r5": "zero", "w-r6": 85 };
  let receiptSeq = 0;

  for (const [wi, w] of s.wallets.entries()) {
    // top-ups every 10–12 days, staggered per wallet
    // (the first one on the first seeded day, so no charge comes before it)
    const TOPUP_DAYS: number[] = [-(DAYS - 1)];
    for (let d = -80 + ((wi * 3) % 7); d <= -3; d += 10 + (wi % 3)) TOPUP_DAYS.push(d);
    const charges = (chargesByWallet.get(w.id) ?? new Array<number>(DAYS).fill(0)).map((v) => round2(v));
    if (w.id === "w-r5") charges[DAYS - 1]! -= 14.37; // the uncovered part never hit the ledger
    const totalCharges = charges.reduce((a, b) => a + b, 0);
    const reserved = reservedOf(w.id);
    const target = TARGET_AVAILABLE[w.id];
    const finalBalance = target === "zero" ? reserved : reserved + (target ?? 100);
    const windows = TOPUP_DAYS.map((d, i) => [d, TOPUP_DAYS[i + 1] ?? 1] as const);
    const windowSums = windows.map(([from, to]) => {
      let sum = 0;
      for (let d = from; d < to; d++) sum += charges[d + DAYS - 1] ?? 0;
      return sum;
    });
    // round top-ups up to €10; if that leaves too little for the last one, use exact amounts
    let amounts = windowSums.map((sum) => Math.ceil((sum * 1.02) / 10) * 10);
    const lastFor = (a: number[]) => round2(finalBalance + totalCharges - a.slice(0, -1).reduce((x, y) => x + y, 0));
    if (lastFor(amounts) < 10) amounts = windowSums.map((sum) => round2(sum));
    amounts[amounts.length - 1] = lastFor(amounts);

    // walk the days in order
    let balance = 0;
    const events: { day: number; kind: "topup" | "charge"; amount: number; i?: number }[] = [];
    TOPUP_DAYS.forEach((d, i) => amounts[i]! > 0 && events.push({ day: d, kind: "topup", amount: amounts[i]!, i }));
    charges.forEach((c, idx) => c > 0 && events.push({ day: idx - (DAYS - 1), kind: "charge", amount: c }));
    events.sort((a, b) => a.day - b.day || (a.kind === "topup" ? -1 : 1));
    for (const ev of events) {
      if (ev.kind === "topup") {
        balance = round2(balance + ev.amount);
        const created = at(ev.day, 11, 20);
        if (w.kind === "house") {
          ledger.push({ id: id("l"), walletId: w.id, type: "deposit", amount: ev.amount, balanceAfter: balance, reference: `DEP-${String(ev.i! + 1).padStart(3, "0")}`, description: "Deposit to the house wallet", estimated: null, createdAt: created });
        } else {
          const receipt = `RC-${today.slice(0, 4)}-${String(++receiptSeq).padStart(4, "0")}`;
          const t: DTopup = {
            id: id("t"),
            resellerId: w.resellerId!,
            walletId: w.id,
            amount: ev.amount,
            paymentReference: `BT${rng.digits(8)}`,
            note: "",
            status: "approved",
            requestedBy: `u-${w.resellerId}`,
            createdAt: at(ev.day - 1, 15, 10),
            decidedAt: created,
            decidedBy: "u-admin",
            decisionNote: null,
            receiptNumber: receipt,
            outstandingPaid: 0,
            plansFunded: 0,
          };
          s.topups.push(t);
          ledger.push({ id: id("l"), walletId: w.id, type: "topup", amount: ev.amount, balanceAfter: balance, reference: receipt, description: "Wallet top-up (bank transfer)", estimated: null, createdAt: created });
        }
      } else {
        balance = round2(balance - ev.amount);
        const date = addDays(today, ev.day);
        const est = ev.day >= -1 || (s.lateDays[w.resellerId ?? "house"] ?? []).includes(date);
        ledger.push({ id: id("l"), walletId: w.id, type: "usage_charge", amount: -ev.amount, balanceAfter: balance, reference: `UC-${date}`, description: `Data usage on ${date}`, estimated: est, createdAt: at(ev.day, 23, 50) });
      }
    }
    w.balance = round2(balance);
  }

  // holds reserved recently show in the ledger (balance unchanged)
  for (const h of s.holds) {
    if (h.status !== "active" || !h.fundedAt) continue;
    const w = s.wallets.find((x) => x.id === h.walletId)!;
    if (new Date(h.fundedAt).getTime() < now.getTime() - 20 * 86400000) continue;
    const before = [...ledger].filter((l) => l.walletId === w.id && l.createdAt <= h.fundedAt!).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).pop();
    const pkg = s.packages.find((p) => p.id === h.packageId)!;
    ledger.push({ id: id("l"), walletId: w.id, type: "hold", amount: -h.amount, balanceAfter: before?.balanceAfter ?? 0, reference: h.orderId.toUpperCase(), description: `Hold for ${pkg.name}`, estimated: null, createdAt: h.fundedAt });
  }
  ledger.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  s.ledger = ledger;

  // more top-up requests: pending, rejected, cancelled
  s.topups.push(
    { id: "t-pending-r4", resellerId: "r4", walletId: "w-r4", amount: 250, paymentReference: "BT40221873", note: "Transfer sent this morning.", status: "pending", requestedBy: "u-r4", createdAt: new Date(now.getTime() - 2 * 3600000).toISOString(), decidedAt: null, decidedBy: null, decisionNote: null, receiptNumber: null, outstandingPaid: null, plansFunded: null },
    { id: id("t"), resellerId: "r3", walletId: "w-r3", amount: 500, paymentReference: "BT11930455", note: "", status: "rejected", requestedBy: "u-r3", createdAt: at(-6, 16), decidedAt: at(-5, 10), decidedBy: "u-finance", decisionNote: "Payment not received. Please check the bank reference.", receiptNumber: null, outstandingPaid: null, plansFunded: null },
    { id: id("t"), resellerId: "r1", walletId: "w-r1", amount: 100, paymentReference: "", note: "Wrong amount", status: "cancelled", requestedBy: "u-r1", createdAt: at(-18, 12), decidedAt: at(-18, 12, 20), decidedBy: "u-r1", decisionNote: null, receiptNumber: null, outstandingPaid: null, plansFunded: null },
  );

  // -------------------------------------------------- notifications, audit
  const notify = (userId: string, title: string, body: string, href: string | null, offsetMin: number, read = false): DNotification => ({
    id: id("n"),
    userId,
    title,
    body,
    href,
    createdAt: new Date(now.getTime() - offsetMin * 60000).toISOString(),
    read,
  });
  const v = s.esims.find((e) => e.resellerId === "r1" && pkgsOf(e.id).some((p) => p.state === "active"))!;
  s.notifications.push(
    notify("u-admin", "Top-up request from Coral Bay Holidays", "€250.00 is waiting for approval.", "/esim/topup-requests", 120),
    notify("u-admin", "An order is being verified", "The supplier didn't confirm an Italy 3 GB sale for Blue Horizon Tours.", "/esim/orders/o-verify", 50),
    notify("u-admin", "Low wallet: Nomad Connect", "Available balance is below €50.00.", "/esim/wallets/w-r3", 60 * 9),
    notify("u-admin", "Usage report is late", "Blue Horizon Tours: usage for 3 days ago is still estimated.", "/esim/transactions", 60 * 20, true),
    notify("u-admin", "Outstanding amount: Atlas Mobile Partners", "€14.37 of usage wasn't covered. New plans are refused until it's paid.", "/esim/wallets/w-r5", 60 * 30, true),
    notify("u-admin", "Low stock", "23 free eSIMs left (threshold 20).", null, 60 * 50, true),
    notify("u-support", "An order is being verified", "The supplier didn't confirm an Italy 3 GB sale for Blue Horizon Tours.", "/esim/orders/o-verify", 50),
    notify("u-support", "eSIM suspended by a rule", "Data use reached 100% on an eSIM with auto-suspend.", "/esim/esims", 60 * 26, true),
    notify("u-r1", "2 plans are waiting for funds", "Top up your wallet to start them. They're funded oldest first.", "/esim/wallet", 60 * 20),
    notify("u-r1", "Data use at 80%", `eSIM …${v.iccid.slice(-6)} has used 80% of its plan.`, `/esim/esims/${v.id}`, 60 * 5),
    notify("u-r1", "Top-up approved", "Your top-up was added to your wallet.", "/esim/wallet", 60 * 24 * 12, true),
    notify("u-sahan", "Data use at 80%", `eSIM …${v.iccid.slice(-6)} has used 80% of its plan.`, `/esim/esims/${v.id}`, 60 * 5),
  );
  const audit = (actorId: string | null, action: string, entityType: string, entityId: string, summary: string, resellerId: string | null, offsetDays: number): DAudit => ({
    id: id("a"),
    actorId,
    action,
    entityType,
    entityId,
    summary,
    resellerId,
    createdAt: at(offsetDays, rng.int(9, 18), rng.int(0, 59)),
  });
  s.audit.push(
    audit("u-admin", "reseller.markup_changed", "reseller", "r3", "Markup changed from 35% to 40%", "r3", -20),
    audit("u-admin", "discount.created", "discount", "d2", "Discount 10% on Italy 3 GB", "r1", -60),
    audit("u-r1", "assistant.disabled", "user", "u-ruwan", "Assistant Ruwan Dissanayake disabled", "r1", -15),
    audit("u-r1", "esim.credentials_viewed", "esim", v.id, "PIN and PUK shown", "r1", -2),
    audit("u-finance", "topup.rejected", "topup_request", "t-r3", "Top-up of €500.00 rejected", "r3", -5),
    audit("u-admin", "reseller.status_changed", "reseller", "r6", "Reseller suspended", "r6", -30),
    audit("u-admin", "document.downloaded", "invoice", "ST-2026-0007", "Statement downloaded", "r2", -4),
  );

  s.seq = seq;
  return s;
}
