import { beforeEach, describe, expect, it } from "vitest";
import { __resetForgotPasswordLimit, demoAuth, RESET_REQUESTS_PER_WINDOW } from "@/lib/api/auth.demo";
import { ApiError } from "@/lib/api/errors";
import { createSeed } from "./seed";
import { __setLatency, __setState, db } from "./store";

beforeEach(() => {
  __setLatency(false);
  __setState(createSeed(new Date()));
  __resetForgotPasswordLimit();
});

const tokenOf = (link: string | null) => new URL(link!, "http://x").searchParams.get("token")!;

describe("password reset (demo)", () => {
  it("answers the same for known and unknown accounts (only demo mode adds the link)", async () => {
    const known = await demoAuth.forgotPassword({ identifier: "nadeesha" });
    const unknown = await demoAuth.forgotPassword({ identifier: "nobody@example.com" });
    expect(known.sent).toBe(true);
    expect(unknown).toEqual({ sent: true, demoLink: null });
  });

  it("links last an hour", async () => {
    await demoAuth.forgotPassword({ identifier: "nadeesha" });
    const t = db().resetTokens[0]!;
    const minutes = (Date.parse(t.expiresAt) - Date.now()) / 60000;
    expect(minutes).toBeGreaterThan(59);
    expect(minutes).toBeLessThanOrEqual(60);
  });

  it("rate-limits requests whatever was typed", async () => {
    for (let i = 0; i < RESET_REQUESTS_PER_WINDOW; i++) await demoAuth.forgotPassword({ identifier: i % 2 ? "nadeesha" : `x${i}` });
    const e = await demoAuth.forgotPassword({ identifier: "someone-else" }).catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(429);
    expect((e as ApiError).details?.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("a link works once, signs the user out everywhere, and 2FA is still asked next time", async () => {
    const r = await demoAuth.forgotPassword({ identifier: "nadeesha" });
    const token = tokenOf(r.demoLink);
    const user = db().users.find((u) => u.username === "nadeesha")!;
    db().session = { userId: user.id, pendingMfaUserId: null };
    expect((await demoAuth.checkResetToken(token)).valid).toBe(true);
    await demoAuth.resetPassword({ token, newPassword: "a-new-password-123" });
    expect(db().session.userId).toBeNull();
    expect((await demoAuth.checkResetToken(token)).valid).toBe(false);
    await expect(demoAuth.resetPassword({ token, newPassword: "another-password-1" })).rejects.toMatchObject({ code: "RESET_LINK_EXPIRED" });
    const login = await demoAuth.login({ username: "nadeesha", password: "a-new-password-123" });
    expect(login.mfaRequired).toBe(true);
  });
});
