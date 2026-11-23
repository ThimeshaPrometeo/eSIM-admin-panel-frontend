import { beforeEach, describe, expect, it } from "vitest";
import { demoEsims } from "@/lib/api/esims.demo";
import { demoWallets } from "@/lib/api/wallets.demo";
import { ApiError } from "@/lib/api/errors";
import { available, planState, reserved } from "./derive";
import { createSeed } from "./seed";
import { __setLatency, __setState, db } from "./store";

const as = (userId: string) => {
  db().session = { userId, pendingMfaUserId: null };
};
const wallet = (id: string) => db().wallets.find((w) => w.id === id)!;
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof ApiError ? e.code : String(e);
  }
};

beforeEach(() => {
  __setLatency(false);
  __setState(createSeed(new Date("2026-11-23T06:00:00Z")));
});

describe("sell eSIM outcomes", () => {
  it("not enough funds: only On first use; the new eSIM is blocked until funded", async () => {
    as("u-r1"); // available €0.40
    expect(await code(demoEsims.createEsimOrder({ planId: "p-it3", activation: { mode: "now" } }, "k1"))).toBe("ACTIVATION_REQUIRES_FUNDS");
    const r = await demoEsims.createEsimOrder({ planId: "p-it3", activation: { mode: "first_use" } }, "k2");
    expect(r.outcome).toBe("completed");
    if (r.outcome !== "completed") return;
    expect(r.funding).toBe("waiting");
    const pkg = db().packages.find((p) => p.esimId === r.esimId)!;
    expect(planState(db(), pkg)).toBe("blocked_no_funds");
  });

  it("add plan without funds waits as Awaiting funds", async () => {
    as("u-r1");
    const esim = db().esims.find((e) => e.resellerId === "r1" && e.status === "ACTIVE")!;
    const r = await demoEsims.addPlanToEsim(esim.id, { planId: "p-it1", activation: { mode: "now" } }, "k3");
    expect(r.outcome).toBe("awaiting_funds");
    const pkg = db().packages.find((p) => p.orderId === r.orderId)!;
    expect(planState(db(), pkg)).toBe("awaiting_funds");
  });

  it("enough funds: the hold is reserved and the plan starts", async () => {
    as("u-r2");
    const before = available(db(), wallet("w-r2"));
    const r = await demoEsims.createEsimOrder({ planId: "p-it3", activation: { mode: "now" } }, "k4");
    expect(r.outcome).toBe("completed");
    const hold = db().holds.find((h) => h.orderId === r.orderId)!;
    expect(hold.status).toBe("active");
    expect(available(db(), wallet("w-r2"))).toBeCloseTo(before - hold.amount, 2);
  });

  it("an outstanding amount refuses new orders", async () => {
    as("u-r5");
    expect(await code(demoEsims.createEsimOrder({ planId: "p-it1", activation: { mode: "first_use" } }, "k5"))).toBe("OUTSTANDING_BALANCE");
  });

  it("the same idempotency key returns the original result", async () => {
    as("u-r2");
    const a = await demoEsims.createEsimOrder({ planId: "p-it1", activation: { mode: "first_use" } }, "same");
    const b = await demoEsims.createEsimOrder({ planId: "p-it1", activation: { mode: "first_use" } }, "same");
    expect(b).toEqual(a);
    expect(db().orders.filter((o) => o.idempotencyKey === "same").length).toBe(1);
  });

  it("being verified and failed outcomes", async () => {
    as("u-r2");
    const v = await demoEsims.createEsimOrder({ planId: "p-it1", activation: { mode: "first_use" } }, "k6", "needs_check");
    expect(v.outcome).toBe("needs_check");
    const f = await demoEsims.createEsimOrder({ planId: "p-it1", activation: { mode: "first_use" } }, "k7", "failed");
    expect(f.outcome).toBe("failed");
    expect(db().orders.find((o) => o.id === f.orderId)!.status).toBe("failed");
  });

  it("daily sale limit", async () => {
    as("u-r2");
    db().salesToday = { date: db().salesToday.date, count: db().settings.dailySaleLimit, capUsed: 0 };
    db().salesToday.date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date());
    expect(await code(demoEsims.createEsimOrder({ planId: "p-it1", activation: { mode: "first_use" } }, "k8"))).toBe("DAILY_LIMIT_REACHED");
  });
});

describe("top-up approval and the funding queue", () => {
  it("funds waiting plans oldest first, skipping ones that don't fit", async () => {
    const s = db();
    const queue = s.holds.filter((h) => h.walletId === "w-r1" && h.status === "waiting").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    expect(queue.length).toBe(2);
    const [older, newer] = queue as [(typeof queue)[0], (typeof queue)[0]];
    // a top-up that covers only the newer (smaller) one: the older is skipped, the newer funded
    expect(older.amount).toBeGreaterThan(newer.amount);
    as("u-r1");
    const req = await demoWallets.createTopupRequest({ amount: Math.ceil(newer.amount + 1), paymentReference: "BT1", note: "" });
    as("u-admin");
    const done = await demoWallets.approveTopupRequest(req.id);
    expect(done.effect?.plansFunded).toBe(1);
    expect(s.holds.find((h) => h.id === older.id)!.status).toBe("waiting");
    expect(s.holds.find((h) => h.id === newer.id)!.status).toBe("active");
    expect(planState(s, s.packages.find((p) => p.id === newer.packageId)!)).toBe("pending_first_use");
    // a second top-up funds the older one; its order completes
    as("u-r1");
    const req2 = await demoWallets.createTopupRequest({ amount: Math.ceil(older.amount + 1), paymentReference: "BT2", note: "" });
    as("u-admin");
    await demoWallets.approveTopupRequest(req2.id);
    expect(s.holds.find((h) => h.id === older.id)!.status).toBe("active");
    expect(s.orders.find((o) => o.id === older.orderId)!.status).toBe("completed");
    expect(available(s, wallet("w-r1"))).toBeGreaterThanOrEqual(0);
  });

  it("pays the outstanding amount first", async () => {
    as("u-r5");
    const req = await demoWallets.createTopupRequest({ amount: 100, paymentReference: "BT3", note: "" });
    as("u-admin");
    const done = await demoWallets.approveTopupRequest(req.id);
    expect(done.effect?.outstandingPaid).toBe("14.37");
    expect(wallet("w-r5").outstanding).toBe(0);
    expect(wallet("w-r5").balance).toBeCloseTo(100 - 14.37, 2);
  });

  it("a wallet never goes below its reserved amount", async () => {
    as("u-admin");
    const w = wallet("w-r1");
    expect(await code(demoWallets.createWalletAdjustment(w.id, { direction: "debit", amount: 5, description: "test" }))).toBe("INSUFFICIENT_AVAILABLE");
    expect(w.balance).toBeGreaterThanOrEqual(reserved(db(), w.id) - 0.01);
  });

  it("staff can approve; resellers can't, and can't see other wallets", async () => {
    as("u-r1");
    expect(await code(demoWallets.approveTopupRequest("t-pending-r4"))).toBe("FORBIDDEN");
    expect(await code(demoWallets.getWallet("w-r2"))).toBe("NOT_FOUND");
  });
});
