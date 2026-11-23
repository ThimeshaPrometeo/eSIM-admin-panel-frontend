/**
 * Demo seed (docs/demo-data.md). Deterministic for a given day: one PRNG with
 * a fixed seed, dates relative to "today" in Asia/Colombo so the demo always
 * looks current. Wallet balances are the sum of their ledger; holds and
 * charges follow the pricing rules in ./pricing.
 */
import { isPriced, type Network } from "@/lib/platform/coverage";
import { addDays, dateInZone, daysBetween, DEFAULT_TIME_ZONE, formatDate } from "@/lib/platform/dates";
import type { Grants } from "@/lib/platform/permission-matrix";
import type { InstallStatus } from "@/lib/platform/status";
import { BYTES } from "@/lib/platform/units";
import { CATALOGUE, zoneNetworks } from "./catalogue";
import { forEachPackageDay, packageCharges } from "./rating";
import { available } from "./derive";
import { demoIp } from "./ip";
import type { DAlert, DAudit, DEsim, DHold, DLedger, DNotification, DOrder, DPackage, DPlan, DState, DTopup, DUsage, DUser } from "./model";
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
    lockedUntil: null,
    mfaEnrolled: true,
    mfaEnrolledAt: null,
    recoveryCodesLeft: 10,
    passkeys: [],
    mustChangePassword: false,
    invitePending: false,
    lastSignInAt: at(-rng.int(0, 6), rng.int(8, 18), rng.int(0, 59)),
    createdAt: at(-rng.int(120, 320)),
    ...u,
  });
  const users: DUser[] = [
    user({
      id: "u-admin",
      username: "nadeesha",
      fullName: "Nadeesha Perera",
      email: "nadeesha@company.example",
      role: "admin",
      recoveryCodesLeft: 8,
      passkeys: [{ id: "pk-1", name: "MacBook Touch ID", createdAt: at(-140, 10, 12), lastUsedAt: at(-1, 9, 2) }],
    }),
    user({ id: "u-support", username: "kasun", fullName: "Kasun Silva", email: "kasun@company.example", role: "staff", staffRoleId: "sr-support" }),
    // a new Finance colleague, invited two days ago: hasn't set a password or 2FA yet (link valid for 72 hours)
    user({ id: "u-finance", username: "dilini", fullName: "Dilini Fernando", email: "dilini@company.example", role: "staff", staffRoleId: "sr-finance", mfaEnrolled: false, recoveryCodesLeft: 0, invitePending: true, lastSignInAt: null, createdAt: at(-2) }),
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
      // 10 failed sign-ins a few minutes ago: locked until an admin unlocks or 15 minutes pass
      locked: true,
      lockedUntil: new Date(now.getTime() + 11 * 60000).toISOString(),
    }),
    user({ id: "u-ruwan", username: "ruwan", fullName: "Ruwan Dissanayake", email: "ruwan@lankaroam.example", role: "assistant", resellerId: "r1", status: "disabled", grants: { dashboard: "view" }, lastSignInAt: at(-16, 17, 40) }),
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

  const discount = (id: string, resellerId: string, planId: string | null, percent: number, offset: number) => ({
    id,
    resellerId,
    planId,
    percent,
    status: "active" as const,
    createdAt: at(offset),
    effectiveAt: at(offset),
    endedAt: null,
    createdBy: "u-admin",
  });
  const discounts = [discount("d1", "r1", null, 5, -90), discount("d2", "r1", "p-it3", 10, -60), discount("d3", "r3", null, 8, -75), discount("d4", "r5", "p-eu10", 3, -40)];

  // ---- Yesim price list history: two versions inside the last 90 days (some networks up, some down)
  const net = (iso2: string, operator: RegExp) => CATALOGUE.networks.find((n) => n.iso2 === iso2 && operator.test(n.operator) && isPriced(n));
  const change = (n: Network | undefined, pct: number) => (n ? [{ networkId: n.id, oldCost: Math.round((n.costPerMb! / (1 + pct / 100)) * 1e6) / 1e6, newCost: n.costPerMb! }] : []);
  const priceVersions = [
    { version: 12, effectiveFrom: addDays(today, -130), syncedAt: at(-130, 2, 10), changes: [] },
    { version: 13, effectiveFrom: addDays(today, -74), syncedAt: at(-74, 2, 10), changes: [...change(net("IT", /Vodafone/), -4), ...change(net("GR", /./), 6)] },
    {
      version: 14,
      effectiveFrom: addDays(today, -32),
      syncedAt: at(-32, 2, 10),
      changes: [
        ...change(net("IT", /TIM/), 12),
        ...change(net("ES", /Vodafone/), -8),
        ...change(net("AE", /Etisalat/), 18),
        ...change(net("JP", /Docomo/), -6),
        ...change(net("FR", /Orange/), -5),
        ...change(net("TH", /./), 10),
        ...change(net("LK", /./), 7),
        ...change(net("DE", /./), -9),
      ],
    },
  ];

  // ---- markup history: everyone starts at their first markup; two resellers changed since
  const houseRetail = { id: "mh-house-0", resellerId: "house", effectiveAt: at(-300), markupPercent: 60, previousPercent: null, changedAt: at(-300), changedBy: "u-admin", reason: "Starting retail markup" };
  const resellerMarkups = resellers.flatMap((r) => {
    // the starting markup applies from the moment the reseller was added
    const changes: Record<string, { from: number; offset: number; reason: string; first: number }> = {
      r2: { first: 12, from: 15, offset: -50, reason: "Volume agreement renewed" },
      r3: { first: 35, from: 40, offset: -20, reason: "Higher support cost for long-stay customers" },
    };
    const c = changes[r.id];
    const first = { id: `mh-${r.id}-0`, resellerId: r.id, effectiveAt: r.createdAt, markupPercent: c?.first ?? r.markupPercent, previousPercent: null, changedAt: r.createdAt, changedBy: "u-admin", reason: "Starting markup" };
    return c ? [first, { id: `mh-${r.id}-1`, resellerId: r.id, effectiveAt: at(c.offset, 16, 40), markupPercent: c.from, previousPercent: c.first, changedAt: at(c.offset, 16, 40), changedBy: "u-admin", reason: c.reason }] : [first];
  });
  const markupHistory = [houseRetail, ...resellerMarkups];

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
    watermark: { statement: true, receipt: true, invoice: true, usage_report: true, price_list: true },
    taxWording: "Prices exclude VAT. Telecommunication services supplied under the reverse charge where applicable.",
    lowWalletThreshold: 50,
    lowStockThreshold: 20,
    dailySaleLimit: 50,
    saleCap: 500,
    freeStock: 23,
  };

  const s: DState = {
    schema: SCHEMA_VERSION,
    seededOn: today,
    seededAt: now.toISOString(),
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
    priceVersions,
    markupHistory,
    supplier: { deposits: [], reportedBalance: 0, reportedAt: now.toISOString(), tolerance: 5 },
    alerts: [],
    alertRules: [
      { id: "rule-80", thresholdPercent: 80, action: "notify", enabled: true, createdAt: at(-200, 10), createdBy: "u-admin", updatedAt: at(-200, 10) },
      { id: "rule-100", thresholdPercent: 100, action: "auto_suspend", enabled: true, createdAt: at(-200, 10, 5), createdBy: "u-admin", updatedAt: at(-90, 15, 30) },
    ],
    stockDeliveries: [],
    jobRuns: {},
    mfaSetup: null,
    resetTokens: [],
    invitations: [],
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
    // some phones also use a second operator in the same country on some days
    const others = zoneNetworks(plan.zoneId).filter((n) => n.iso2 === network.iso2 && n.id !== network.id && isPriced(n) && (plan.zoneId !== "z-world" || n.costPerMb! <= 0.004));
    const altNetworkId = !opts.network && others.length && rng.chance(0.7) ? rng.pick(others).id : null;
    const holdAmount = holdFor(s, plan, buyer);
    const limitMb = plan.dataBytes / BYTES.MB;
    const pkgId = id("pk");
    const orderId = id("o");
    const holdId = id("h");
    const activation = opts.story === "pending" ? (rng.chance(0.85) ? "first_use" : "date") : rng.weighted([["first_use", 65], ["now", 30], ["date", 5]] as const);
    const createdAt = at(opts.created, rng.int(8, 20), rng.int(0, 59));
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
      const depleted = total >= limitMb - 0.05;
      state = opts.story === "deleted" ? "deleted" : opts.start + plan.validityDays <= 0 ? (depleted ? "depleted" : "expired") : depleted ? "depleted" : "active";
      if (deletedOn !== null) expiresAt = at(deletedOn, 12);
    }

    const live = state === "active" || state === "pending_activation";
    const hold: DHold = {
      id: holdId,
      walletId: walletOf(e.resellerId),
      packageId: pkgId,
      esimId: e.id,
      orderId,
      amount: holdAmount,
      used: 0,
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
      altNetworkId,
      holdId,
      chargedFinal: 0,
      chargedEstimated: 0,
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
    // charges come from the rated usage lines (the same rating every page uses)
    const charged = packageCharges(s, pkg);
    pkg.chargedFinal = charged.final;
    pkg.chargedEstimated = charged.estimated;
    hold.used = round2(charged.final + charged.estimated);
    if (hold.used > hold.amount) hold.amount = Math.ceil(hold.used);
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
    pkg.state = "active";
    pkg.altNetworkId = null;
    hold.amount = 150;
    // heavy use on an expensive network: about €14 more than the hold
    const price = buyerPricePerMb(s, { kind: "reseller", resellerId: "r5" }, expensive, pkg.planId)!;
    const u = s.usage[pkg.id]!;
    const per = (hold.amount + 14.4) / price / u.mb.length;
    u.mb = u.mb.map(() => Math.round(per * 10) / 10);
    const charged = packageCharges(s, pkg);
    pkg.chargedFinal = charged.final;
    pkg.chargedEstimated = charged.estimated;
    hold.used = hold.amount;
    hold.status = "exhausted";
    s.wallets.find((w) => w.id === "w-r5")!.outstanding = round2(charged.final + charged.estimated - hold.amount);
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
  {
    // the 100% rule suspends an eSIM whose plan really used all its data
    const i = Math.max(0, shuffled.findIndex((e) => pkgsOf(e.id).some((p) => p.state === "depleted")));
    const [e] = shuffled.splice(i, 1);
    if (e) {
      e.status = "SUSPENDED";
      e.suspendedBy = "rule";
    }
  }
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

  // usage charges per wallet per day: the sum of the rated package-day charges (cents)
  const chargesByWallet = new Map<string, number[]>();
  forEachPackageDay(s, (_p, date, _lines, charge, owner) => {
    const w = walletOf(owner);
    const arr = chargesByWallet.get(w) ?? new Array<number>(DAYS).fill(0);
    const idx = daysBetween(today, date) + DAYS - 1;
    if (idx >= 0 && idx < DAYS) arr[idx]! = round2(arr[idx]! + charge);
    chargesByWallet.set(w, arr);
  });
  const outstandingR5 = s.wallets.find((w) => w.id === "w-r5")!.outstanding;
  // the r5 overrun beyond its hold: charged until the wallet was empty, the rest is outstanding
  const TARGET_AVAILABLE: Record<string, number | "zero"> = { "w-house": 2480, "w-r1": 0.4, "w-r2": 1240, "w-r3": 18, "w-r4": "zero", "w-r5": "zero", "w-r6": 85 };
  let receiptSeq = 0;

  for (const [wi, w] of s.wallets.entries()) {
    // top-ups every 10–12 days, staggered per wallet
    // (the first one on the first seeded day, so no charge comes before it)
    const TOPUP_DAYS: number[] = [-(DAYS - 1)];
    for (let d = -80 + ((wi * 3) % 7); d <= -3; d += 10 + (wi % 3)) TOPUP_DAYS.push(d);
    const charges = (chargesByWallet.get(w.id) ?? new Array<number>(DAYS).fill(0)).map((v) => round2(v));
    // the r5 overrun beyond its hold was never charged to the wallet: it's the outstanding amount
    if (w.id === "w-r5") {
      let rem = outstandingR5;
      for (let i = DAYS - 1; i >= 0 && rem > 0; i--) {
        const take = Math.min(rem, charges[i]!);
        charges[i] = round2(charges[i]! - take);
        rem = round2(rem - take);
      }
    }
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

  // ---- our prepaid account at Yesim: deposits, and the balance Yesim reports (a late report makes a small difference)
  let yesimCost = 0;
  forEachPackageDay(s, (_p, _d, lines) => lines.forEach((l) => (yesimCost += l.cost)));
  const depositPlan: [number, number][] = [[-95, 2500], [-62, 2000], [-30, 2000], [-8, 1500]];
  s.supplier.deposits = depositPlan.map(([offset, amount], i) => ({ id: `sd${i + 1}`, date: addDays(today, offset), amount, reference: `YS-DEP-${String(i + 1).padStart(3, "0")}` }));
  const implied = depositPlan.reduce((a, [, amount]) => a + amount, 0) - yesimCost;
  s.supplier.reportedBalance = round2(implied - 3.82);
  s.supplier.reportedAt = new Date(now.getTime() - 35 * 60000).toISOString();

  // more top-up requests: pending, rejected, cancelled
  s.topups.push(
    { id: "t-pending-r4", resellerId: "r4", walletId: "w-r4", amount: 250, paymentReference: "BT40221873", note: "Transfer sent this morning.", status: "pending", requestedBy: "u-r4", createdAt: new Date(now.getTime() - 2 * 3600000).toISOString(), decidedAt: null, decidedBy: null, decisionNote: null, receiptNumber: null, outstandingPaid: null, plansFunded: null },
    { id: id("t"), resellerId: "r3", walletId: "w-r3", amount: 500, paymentReference: "BT11930455", note: "", status: "rejected", requestedBy: "u-r3", createdAt: at(-6, 16), decidedAt: at(-5, 10), decidedBy: "u-admin", decisionNote: "Payment not received. Please check the bank reference.", receiptNumber: null, outstandingPaid: null, plansFunded: null },
    { id: id("t"), resellerId: "r1", walletId: "w-r1", amount: 100, paymentReference: "", note: "Wrong amount", status: "cancelled", requestedBy: "u-r1", createdAt: at(-18, 12), decidedAt: at(-18, 12, 20), decidedBy: "u-r1", decisionNote: null, receiptNumber: null, outstandingPaid: null, plansFunded: null },
  );

  // -------------------------------------------------- stock deliveries
  // Free stock today is settings.freeStock; going back, add the eSIMs sold since and take away deliveries.
  // Two deliveries, sized so stock dipped just below the warning before each one arrived.
  {
    const soldOn = new Map<string, number>();
    for (const e of s.esims) {
      const d = dateInZone(new Date(e.createdAt));
      soldOn.set(d, (soldOn.get(d) ?? 0) + 1);
    }
    const soldBetween = (from: string, to: string) => [...soldOn].reduce((a, [d, n]) => a + (d > from && d <= to ? n : 0), 0);
    const d1 = addDays(today, -36);
    const d2 = addDays(today, -64);
    // free at the end of a day = today's free + sold after that day − deliveries after it
    const freeEnd1 = settings.freeStock + soldBetween(d1, today);
    // the day before the delivery ends at 17 free (below the warning at 20)
    const size1 = Math.max(10, freeEnd1 + (soldOn.get(d1) ?? 0) - 17);
    const freeEnd2 = freeEnd1 - size1 + soldBetween(d2, d1);
    // the earlier delivery came before stock reached the warning (no alert)
    const size2 = Math.max(10, freeEnd2 + (soldOn.get(d2) ?? 0) - 22);
    s.stockDeliveries.push({ id: "sd-1", date: d2, count: size2, reference: "STOCK-2026-03" }, { id: "sd-2", date: d1, count: size1, reference: "STOCK-2026-04" });
  }

  // -------------------------------------------------------------- alerts
  {
    const usedPct = (p: DPackage) => ((s.usage[p.id]?.mb ?? []).reduce((a, x) => a + x, 0) * BYTES.MB) / p.limitBytes;
    const label = (e: DEsim) => `eSIM …${e.iccid.slice(-6)}`;
    const alert = (a: Omit<DAlert, "id" | "updatedAt" | "updatedBy" | "ruleId" | "esimId" | "resellerId" | "href"> & Partial<DAlert>): DAlert => ({
      id: id("al"),
      ruleId: null,
      esimId: null,
      resellerId: null,
      href: null,
      updatedAt: a.createdAt,
      updatedBy: null,
      ...a,
    });
    const ago = (min: number) => new Date(now.getTime() - min * 60000).toISOString();
    // usage at 80% and 100%, from the real usage of running plans
    const running = s.packages.filter((p) => p.state === "active" || p.state === "depleted");
    const at80 = running.filter((p) => p.state === "active" && usedPct(p) >= 0.8 && usedPct(p) < 1).slice(0, 4);
    at80.forEach((p, i) => {
      const e = s.esims.find((x) => x.id === p.esimId)!;
      s.alerts.push(alert({ type: "usage_threshold", severity: "warning", title: `Data use at 80%: ${label(e)}`, detail: `${p.name} has used ${Math.floor(usedPct(p) * 100)}% of its data.`, resellerId: e.resellerId, esimId: e.id, href: `/esim/esims/${e.id}`, ruleId: "rule-80", status: i === 0 ? "open" : i === 1 ? "acknowledged" : "open", createdAt: ago(5 + i * 190) }));
    });
    const ruled = s.esims.find((e) => e.suspendedBy === "rule");
    if (ruled) {
      const p = [...pkgsOf(ruled.id)].sort((a, b) => usedPct(b) - usedPct(a))[0]!;
      s.alerts.push(alert({ type: "usage_threshold", severity: "danger", title: `Data use at 100%: ${label(ruled)} suspended`, detail: `${p.name} used ${Math.min(100, Math.floor(usedPct(p) * 100))}% of its data; the 100% rule suspended the eSIM.`, resellerId: ruled.resellerId, esimId: ruled.id, href: `/esim/esims/${ruled.id}`, ruleId: "rule-100", status: "open", createdAt: ago(60 * 26) }));
    }
    // wallets below their warning, from the real balances
    for (const w of s.wallets.filter((x) => x.kind === "reseller")) {
      const r = s.resellers.find((x) => x.id === w.resellerId)!;
      if (r.status !== "active" || available(s, w) >= w.lowThreshold) continue;
      s.alerts.push(alert({ type: "low_wallet", severity: "warning", title: `Low wallet: ${r.companyName}`, detail: `Available €${available(s, w).toFixed(2)}, below the €${w.lowThreshold.toFixed(2)} warning.`, resellerId: r.id, href: r.id === "r5" ? `/esim/wallets/${w.id}` : `/esim/wallets/${w.id}`, status: "open", createdAt: ago(60 * 9 + s.alerts.length * 37) }));
    }
    const r5 = s.wallets.find((w) => w.id === "w-r5")!;
    if (r5.outstanding > 0)
      s.alerts.push(alert({ type: "outstanding_balance", severity: "danger", title: "Outstanding amount: Atlas Mobile Partners", detail: `€${r5.outstanding.toFixed(2)} of usage wasn't covered by the hold. New plans are refused until it's paid.`, resellerId: "r5", href: "/esim/wallets/w-r5", status: "open", createdAt: ago(60 * 30) }));
    s.alerts.push(
      alert({ type: "order_needs_check", severity: "warning", title: "An order is being verified", detail: "The supplier didn't confirm an Italy 3 GB sale for Blue Horizon Tours. Don't sell again until it's checked.", resellerId: "r2", href: "/esim/orders/o-verify", status: "open", createdAt: ago(50) }),
      alert({ type: "usage_rating_late", severity: "warning", title: "Usage report is late: Blue Horizon Tours", detail: `Usage for ${formatDate(`${addDays(today, -3)}T12:00:00Z`)} is still estimated; the supplier's nightly report hasn't arrived.`, resellerId: "r2", href: "/esim/transactions", status: "acknowledged", createdAt: ago(60 * 20), updatedAt: ago(60 * 18), updatedBy: "u-support" }),
      alert({ type: "unpriced_network_usage", severity: "warning", title: "Usage on a network with no price", detail: "A phone used a network that has no Yesim price. That usage is held, not charged, until the price list has a price for it.", href: "/esim/coverage", status: "resolved", createdAt: at(-12, 4, 10), updatedAt: at(-11, 9, 30), updatedBy: "u-admin" }),
      alert({ type: "plan_held_by_daily_limit", severity: "danger", title: "Daily sale limit reached", detail: `All ${settings.dailySaleLimit} sales allowed by the supplier for the day were used; further sales were refused until midnight.`, status: "resolved", createdAt: at(-9, 17, 42), updatedAt: at(-8, 0, 1) }),
      alert({ type: "low_stock", severity: "warning", title: "Low stock", detail: `17 free eSIMs left, below the warning at ${settings.lowStockThreshold}. Resolved by delivery STOCK-2026-04.`, href: "/esim/inventory", status: "resolved", createdAt: at(-37, 11, 5), updatedAt: at(-36, 10, 0) }),
      alert({ type: "price_list_changed", severity: "info", title: "Yesim price list changed (version 14)", detail: "8 networks changed price: 4 up, 4 down.", href: "/esim/price-list?tab=history", status: "acknowledged", createdAt: at(-32, 2, 12), updatedAt: at(-32, 9, 40), updatedBy: "u-admin" }),
    );
    // house wallet: the last time it went below the warning, and the deposit that lifted it
    const house = s.ledger.filter((l) => l.walletId === "w-house" && l.type !== "hold");
    let low: DLedger | null = null;
    for (const l of house) {
      if (!low && l.balanceAfter < settings.houseWalletLowThreshold) low = l;
      else if (low && l.type === "deposit" && l.balanceAfter >= settings.houseWalletLowThreshold) {
        const lowAt = low;
        const last = s.alerts.find((a) => a.type === "house_wallet_low");
        const a = alert({ type: "house_wallet_low", severity: "warning", title: "House wallet low", detail: `The house wallet went below €${settings.houseWalletLowThreshold.toFixed(2)} (€${lowAt.balanceAfter.toFixed(2)}). Resolved by deposit ${l.reference}.`, href: "/esim/wallets/w-house", status: "resolved", createdAt: lowAt.createdAt, updatedAt: l.createdAt, updatedBy: "u-admin" });
        if (last) Object.assign(last, a);
        else s.alerts.push(a);
        low = null;
      }
    }
    if (low) s.alerts.push(alert({ type: "house_wallet_low", severity: "warning", title: "House wallet low", detail: `Balance €${low.balanceAfter.toFixed(2)}, below the €${settings.houseWalletLowThreshold.toFixed(2)} warning.`, href: "/esim/wallets/w-house", status: "open", createdAt: low.createdAt }));
    s.alerts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

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
    notify("u-admin", "Outstanding amount: Atlas Mobile Partners", `€${outstandingR5.toFixed(2)} of usage wasn't covered. New plans are refused until it's paid.`, "/esim/wallets/w-r5", 60 * 30, true),
    notify("u-admin", "Stock running low", "23 free eSIMs left; the warning is at 20.", "/esim/inventory", 60 * 50, true),
    notify("u-support", "An order is being verified", "The supplier didn't confirm an Italy 3 GB sale for Blue Horizon Tours.", "/esim/orders/o-verify", 50),
    notify("u-support", "eSIM suspended by a rule", "Data use reached 100% on an eSIM with auto-suspend.", "/esim/esims", 60 * 26, true),
    notify("u-r1", "2 plans are waiting for funds", "Top up your wallet to start them. They're funded oldest first.", "/esim/wallet", 60 * 20),
    notify("u-r1", "Data use at 80%", `eSIM …${v.iccid.slice(-6)} has used 80% of its plan.`, `/esim/esims/${v.id}`, 60 * 5),
    notify("u-r1", "Top-up approved", "Your top-up was added to your wallet.", "/esim/wallet", 60 * 24 * 12, true),
    notify("u-sahan", "Data use at 80%", `eSIM …${v.iccid.slice(-6)} has used 80% of its plan.`, `/esim/esims/${v.id}`, 60 * 5),
  );
  const audit = (actorId: string | null, action: string, entityType: string, entityId: string, summary: string, resellerId: string | null, createdAt: string, changes: DAudit["changes"] = null): DAudit => ({
    id: id("a"),
    actorId,
    action,
    entityType,
    entityId,
    summary,
    resellerId,
    createdAt,
    ip: demoIp(actorId),
    changes,
  });
  const nameOf = (rid: string | null) => s.resellers.find((r) => r.id === rid)?.companyName ?? "Direct sales";
  const planNameOf = (pid: string | null) => s.plans.find((p) => p.id === pid)?.name ?? "all plans";
  const nowIsoSeed = now.toISOString();
  const past = (iso: string) => (iso < nowIsoSeed ? iso : new Date(now.getTime() - 60000).toISOString());
  const entries: DAudit[] = [];
  // sign-ins: each user's last one, and daily ones for our own team
  for (const u of s.users) if (u.lastSignInAt) entries.push(audit(u.id, "auth.signed_in", "user", u.id, `${u.fullName} signed in${u.passkeys.length && u.id === "u-admin" ? " with a passkey" : ""}`, u.resellerId, past(u.lastSignInAt)));
  for (const uid of ["u-admin", "u-support"]) for (let d = 1; d <= 14; d++) entries.push(audit(uid, "auth.signed_in", "user", uid, `${s.users.find((u) => u.id === uid)!.fullName} signed in`, null, at(-d, 8, 30 + (d % 20))));
  const locked = s.users.find((u) => u.locked);
  if (locked) entries.push(audit(locked.id, "auth.locked", "user", locked.id, `${locked.fullName}: account locked after 10 failed sign-ins`, locked.resellerId, new Date(now.getTime() - 4 * 60000).toISOString()));
  // sales and added plans
  for (const o of s.orders) {
    const plan = planNameOf(o.planId);
    entries.push(audit(o.userId, o.type === "new_esim" ? "order.created" : "order.plan_added", "order", o.id, `${o.type === "new_esim" ? "Sold an eSIM" : "Added a plan"}: ${plan} (${nameOf(o.resellerId)})`, o.resellerId, past(o.createdAt)));
  }
  // top-up requests decided
  for (const t of s.topups)
    if (t.decidedAt && t.decidedBy && t.status !== "pending")
      entries.push(audit(t.decidedBy, `topup.${t.status}`, "topup_request", t.id, `Top-up of €${t.amount.toFixed(2)} ${t.status}${t.receiptNumber ? ` (${t.receiptNumber})` : ""}`, t.resellerId, past(t.decidedAt)));
  // markup and discount changes, price list versions
  for (const m of s.markupHistory)
    if (m.previousPercent !== null && m.resellerId !== "house")
      entries.push(audit(m.changedBy, "reseller.markup_changed", "reseller", m.resellerId, `Markup changed from ${m.previousPercent}% to ${m.markupPercent}%: ${m.reason}`, m.resellerId, m.changedAt, [{ field: "Markup", before: `${m.previousPercent}%`, after: `${m.markupPercent}%` }]));
  for (const d of s.discounts)
    entries.push(audit(d.createdBy ?? "u-admin", "discount.created", "discount", d.id, `Discount ${d.percent}% on ${planNameOf(d.planId)} for ${nameOf(d.resellerId)}`, d.resellerId, past(d.createdAt), [{ field: "Discount", before: "—", after: `${d.percent}%` }]));
  for (const v of s.priceVersions.slice(1))
    entries.push(audit(null, "price_list.synced", "price_list", `v${v.version}`, `Yesim price list version ${v.version}: ${v.changes.filter((c) => c.newCost > c.oldCost).length} up, ${v.changes.filter((c) => c.newCost < c.oldCost).length} down`, null, v.syncedAt));
  entries.push(
    audit("u-r1", "assistant.disabled", "user", "u-ruwan", "Assistant Ruwan Dissanayake disabled", "r1", at(-15, 11, 5), [{ field: "Status", before: "Active", after: "Disabled" }]),
    audit("u-r1", "esim.credentials_viewed", "esim", v.id, "PIN and PUK shown", "r1", at(-2, 14, 12)),
    audit("u-admin", "reseller.status_changed", "reseller", "r6", "Reseller suspended", "r6", at(-30, 16, 40), [{ field: "Status", before: "Active", after: "Suspended" }]),
    audit("u-admin", "user.created", "user", "u-finance", "Staff user Dilini Fernando created (Finance); invitation sent to dilini@company.example", null, s.users.find((u) => u.id === "u-finance")!.createdAt),
  );
  s.audit.push(...entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

  // Dilini's invitation (sent when her account was made)
  const dilini = s.users.find((u) => u.id === "u-finance")!;
  s.invitations.push({ token: "inv-u-finance-welcome", userId: dilini.id, sentAt: dilini.createdAt, expiresAt: new Date(Date.parse(dilini.createdAt) + 72 * 3600000).toISOString() });

  // set-up dates for authenticator apps: a few days after each account was created
  for (const u of s.users) if (u.mfaEnrolled) u.mfaEnrolledAt = new Date(Date.parse(u.createdAt) + 3 * 86400000).toISOString();

  s.seq = seq;
  return s;
}
