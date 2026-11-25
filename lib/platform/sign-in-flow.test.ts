import { describe, expect, it } from "vitest";
import {
  flowReducer,
  historyMode,
  initialFlow,
  landingStep,
  resolveStep,
  SESSION_EXPIRED,
  stepFromPath,
  stepUrl,
  takeResetToken,
  tokenFromLink,
  type FlowEvent,
  type FlowState,
  type LandingUser,
  type SignInStep,
} from "./sign-in-flow";

const ready: LandingUser = { id: "u1", mustChangePassword: false, mfaEnrolled: true, hasPasskey: false };
const firstSignIn: LandingUser = { id: "u2", mustChangePassword: true, mfaEnrolled: false, hasPasskey: false };
const noTwoFactor: LandingUser = { id: "u3", mustChangePassword: false, mfaEnrolled: false, hasPasskey: false };

const run = (start: SignInStep, ...events: FlowEvent[]) => events.reduce<FlowState>(flowReducer, initialFlow(start));
const signedIn = (me: LandingUser, skippedSetup = false): FlowEvent => ({ type: "signed-in", me, skippedSetup });

describe("landingStep", () => {
  it("forces the password change first, then the 2FA set-up, then the workspace", () => {
    expect(landingStep(firstSignIn, false)).toBe("change-password");
    expect(landingStep(noTwoFactor, false)).toBe("mfa-setup");
    expect(landingStep(noTwoFactor, true)).toBe("workspace");
    expect(landingStep({ ...noTwoFactor, hasPasskey: true }, false)).toBe("workspace");
    expect(landingStep(ready, false)).toBe("workspace");
  });
});

describe("flowReducer", () => {
  it("credentials → mfa turns forward (left) with a full turn", () => {
    const s = run("credentials", { type: "mfa-required" });
    expect(s).toMatchObject({ step: "mfa", dir: 1, turn: "major", exiting: false });
  });

  it("mfa ⇄ recovery is the lighter turn", () => {
    const toRecovery = run("credentials", { type: "mfa-required" }, { type: "use-recovery" });
    expect(toRecovery).toMatchObject({ step: "recovery", dir: 1, turn: "minor" });
    const back = flowReducer(toRecovery, { type: "use-app" });
    expect(back).toMatchObject({ step: "mfa", dir: -1, turn: "minor" });
  });

  it("Back from the code step (either kind) turns right to the password", () => {
    expect(run("mfa", { type: "back" })).toMatchObject({ step: "credentials", dir: -1, turn: "major" });
    expect(run("recovery", { type: "back" })).toMatchObject({ step: "credentials", dir: -1, turn: "major" });
  });

  it("Back does nothing outside the code step", () => {
    for (const step of ["credentials", "change-password", "mfa-setup"] as const) {
      const s = initialFlow(step);
      expect(flowReducer(s, { type: "back" })).toBe(s);
    }
  });

  it("a verified code leaves for the workspace when nothing else is due", () => {
    const s = run("credentials", { type: "mfa-required" }, signedIn(ready));
    expect(s.exiting).toBe(true);
    expect(s.step).toBe("mfa");
  });

  it("first sign-in: credentials → change-password → mfa-setup → workspace", () => {
    let s = run("credentials", signedIn(firstSignIn));
    expect(s).toMatchObject({ step: "change-password", dir: 1, turn: "major" });
    s = flowReducer(s, signedIn({ ...firstSignIn, mustChangePassword: false }));
    expect(s).toMatchObject({ step: "mfa-setup", turn: "major" });
    s = flowReducer(s, { type: "finish" });
    expect(s.exiting).toBe(true);
  });

  it("a skipped set-up prompt goes straight to the workspace", () => {
    expect(run("credentials", signedIn(noTwoFactor, true)).exiting).toBe(true);
  });

  it("passkey sign-in from the password face goes straight to the exit", () => {
    expect(run("credentials", signedIn(ready))).toMatchObject({ step: "credentials", exiting: true });
  });

  it("ignores events that don't belong to the current step", () => {
    const pw = initialFlow("credentials");
    expect(flowReducer(pw, { type: "use-recovery" })).toBe(pw);
    expect(flowReducer(pw, { type: "use-app" })).toBe(pw);
    expect(flowReducer(pw, { type: "finish" })).toBe(pw);
    const code = initialFlow("mfa");
    expect(flowReducer(code, { type: "mfa-required" })).toBe(code);
  });

  it("nothing changes once the card is leaving", () => {
    const leaving = run("credentials", signedIn(ready));
    expect(flowReducer(leaving, { type: "mfa-required" })).toBe(leaving);
    expect(flowReducer(leaving, { type: "back" })).toBe(leaving);
  });

  it("restore without animation swaps at once (refresh), with animation turns (Back / Forward)", () => {
    const refreshed = flowReducer(initialFlow("mfa"), { type: "restore", to: { step: "credentials", message: SESSION_EXPIRED }, animate: false });
    expect(refreshed).toMatchObject({ step: "credentials", turn: "none", message: SESSION_EXPIRED });
    const popped = flowReducer(initialFlow("mfa"), { type: "restore", to: { step: "credentials", message: null }, animate: true });
    expect(popped).toMatchObject({ step: "credentials", dir: -1, turn: "major" });
    const forward = flowReducer(initialFlow("credentials"), { type: "restore", to: { step: "mfa", message: null }, animate: true });
    expect(forward).toMatchObject({ step: "mfa", dir: 1, turn: "major" });
  });

  it("restore to the workspace leaves", () => {
    expect(flowReducer(initialFlow("credentials"), { type: "restore", to: { step: "workspace", message: null }, animate: false }).exiting).toBe(true);
  });

  it("a new step clears the expired-challenge message", () => {
    const s = flowReducer(initialFlow("credentials"), { type: "restore", to: { step: "credentials", message: SESSION_EXPIRED }, animate: false });
    expect(s.message).toBe(SESSION_EXPIRED);
    expect(flowReducer(s, { type: "mfa-required" }).message).toBeNull();
  });
});

describe("resolveStep (refresh and direct visits)", () => {
  const out = { status: "signed_out" as const, me: null, skippedSetup: false };

  it("refresh on the code step with a live challenge stays there", () => {
    expect(resolveStep("mfa", { ...out, pendingMfa: true })).toEqual({ step: "mfa", message: null });
  });

  it("refresh on the code step without a challenge goes back to the password with a message", () => {
    expect(resolveStep("mfa", { ...out, pendingMfa: false })).toEqual({ step: "credentials", message: SESSION_EXPIRED });
  });

  it("change-password and set-up need a session", () => {
    expect(resolveStep("change-password", { ...out, pendingMfa: false })).toEqual({ step: "credentials", message: null });
    expect(resolveStep("mfa-setup", { ...out, pendingMfa: true })).toEqual({ step: "credentials", message: null });
  });

  it("a signed-in user lands where they're due, never on the password or code", () => {
    const signed = (me: LandingUser) => ({ status: "signed_in" as const, me, pendingMfa: false, skippedSetup: false });
    expect(resolveStep("credentials", signed(ready)).step).toBe("workspace");
    expect(resolveStep("mfa", signed(ready)).step).toBe("workspace");
    expect(resolveStep("credentials", signed(firstSignIn)).step).toBe("change-password");
    expect(resolveStep("mfa-setup", signed(firstSignIn)).step).toBe("change-password");
    expect(resolveStep("change-password", signed(noTwoFactor)).step).toBe("mfa-setup");
  });

  it("the set-up prompt stays reachable by URL until 2FA is on, even after skipping", () => {
    expect(resolveStep("mfa-setup", { status: "signed_in", me: noTwoFactor, pendingMfa: false, skippedSetup: true }).step).toBe("mfa-setup");
    expect(resolveStep("mfa-setup", { status: "signed_in", me: ready, pendingMfa: false, skippedSetup: false }).step).toBe("workspace");
  });
});

describe("URL", () => {
  it("maps paths to steps", () => {
    expect(stepFromPath("/")).toBe("credentials");
    expect(stepFromPath("/login/2fa")).toBe("mfa");
    expect(stepFromPath("/login/2fa/")).toBe("mfa");
    expect(stepFromPath("/login/change-password")).toBe("change-password");
    expect(stepFromPath("/login/setup-2fa")).toBe("mfa-setup");
  });

  it("keeps ?next= and ?invite=1", () => {
    expect(stepUrl("mfa", "/esim/dashboard")).toBe("/login/2fa");
    expect(stepUrl("mfa", "/esim/orders")).toBe("/login/2fa?next=%2Fesim%2Forders");
    expect(stepUrl("mfa-setup", "/esim/dashboard", true)).toBe("/login/setup-2fa?invite=1");
    expect(stepUrl("credentials", "/esim/dashboard", true)).toBe("/");
  });

  it("pushes only password → code; later steps replace; recovery shares the code URL", () => {
    expect(historyMode("credentials", "mfa")).toBe("push");
    expect(historyMode("mfa", "recovery")).toBe("none");
    expect(historyMode("mfa", "change-password")).toBe("replace");
    expect(historyMode("credentials", "change-password")).toBe("replace");
    expect(historyMode("change-password", "mfa-setup")).toBe("replace");
    expect(historyMode("mfa", "credentials")).toBe("replace");
  });
});

describe("password recovery", () => {
  it("credentials → forgot-password turns forward; Back turns right", () => {
    const forgot = run("credentials", { type: "forgot" });
    expect(forgot).toMatchObject({ step: "forgot-password", dir: 1, turn: "major" });
    expect(flowReducer(forgot, { type: "back" })).toMatchObject({ step: "credentials", dir: -1, turn: "major" });
  });

  it("forgot-password → reset-link-sent; Back from the confirmation goes to the password", () => {
    const sent = run("credentials", { type: "forgot" }, { type: "link-sent" });
    expect(sent).toMatchObject({ step: "reset-link-sent", dir: 1, turn: "major" });
    expect(flowReducer(sent, { type: "back" })).toMatchObject({ step: "credentials", dir: -1 });
    // "Send again" keeps the face
    expect(flowReducer(sent, { type: "link-sent" })).toBe(sent);
  });

  it("reset-password → reset-done → credentials", () => {
    const done = run("reset-password", { type: "reset-done" });
    expect(done).toMatchObject({ step: "reset-done", dir: 1, turn: "major" });
    expect(flowReducer(done, { type: "sign-in" })).toMatchObject({ step: "credentials", turn: "major", exiting: false });
  });

  it("a link that fails on submit turns to the expired face; 'Send a new link' turns to the form", () => {
    const expired = run("reset-password", { type: "link-invalid" });
    expect(expired).toMatchObject({ step: "reset-expired", turn: "major" });
    expect(flowReducer(expired, { type: "new-link" })).toMatchObject({ step: "forgot-password", dir: 1, turn: "major" });
    expect(flowReducer(expired, { type: "back" })).toMatchObject({ step: "credentials", dir: -1 });
  });

  it("recovery events only work on their own face", () => {
    const pw = initialFlow("credentials");
    for (const type of ["link-sent", "reset-done", "link-invalid", "sign-in", "new-link"] as const) expect(flowReducer(pw, { type })).toBe(pw);
    const reset = initialFlow("reset-password");
    expect(flowReducer(reset, { type: "back" })).toBe(reset);
    expect(flowReducer(reset, { type: "forgot" })).toBe(reset);
  });

  it("opening the demo reset link from the confirmation turns forward", () => {
    const opened = flowReducer(run("credentials", { type: "forgot" }, { type: "link-sent" }), { type: "restore", to: { step: "reset-password", message: null }, animate: true });
    expect(opened).toMatchObject({ step: "reset-password", dir: 1, turn: "major" });
  });

  describe("refresh and direct visits on each face", () => {
    const base = { status: "signed_out" as const, me: null, pendingMfa: false, skippedSetup: false };
    it("forgot-password and its confirmation land on the form (the typed value isn't kept)", () => {
      expect(resolveStep(stepFromPath("/forgot-password"), base)).toEqual({ step: "forgot-password", message: null });
      expect(resolveStep("reset-link-sent", base)).toEqual({ step: "forgot-password", message: null });
    });
    it("reset-password needs a valid token; without one it's the expired face", () => {
      expect(resolveStep(stepFromPath("/reset-password"), { ...base, resetToken: "valid" }).step).toBe("reset-password");
      expect(resolveStep("reset-password", { ...base, resetToken: "invalid" }).step).toBe("reset-expired");
      expect(resolveStep("reset-password", { ...base, resetToken: "none" }).step).toBe("reset-expired");
    });
    it("a refresh after the reset (token used up, gone from memory) shows the expired face", () => {
      expect(resolveStep("reset-done", { ...base, resetToken: "none" }).step).toBe("reset-expired");
      expect(resolveStep("reset-expired", base).step).toBe("reset-expired");
    });
    it("recovery works for a signed-in user too", () => {
      const signed = { status: "signed_in" as const, me: ready, pendingMfa: false, skippedSetup: false };
      expect(resolveStep("forgot-password", signed).step).toBe("forgot-password");
      expect(resolveStep("reset-password", { ...signed, resetToken: "valid" }).step).toBe("reset-password");
    });
  });

  it("URLs: the form and its confirmation share /forgot-password; reset faces share /reset-password, never with the token", () => {
    expect(stepUrl("reset-link-sent", "/esim/dashboard")).toBe("/forgot-password");
    expect(stepUrl("reset-password", "/esim/dashboard")).toBe("/reset-password");
    expect(stepUrl("reset-expired", "/esim/dashboard")).toBe("/reset-password");
    expect(historyMode("credentials", "forgot-password")).toBe("push");
    expect(historyMode("forgot-password", "reset-link-sent")).toBe("none");
    expect(historyMode("reset-expired", "forgot-password")).toBe("push");
    expect(historyMode("reset-link-sent", "reset-password")).toBe("push");
    expect(historyMode("reset-done", "credentials")).toBe("replace");
    expect(historyMode("forgot-password", "credentials")).toBe("replace");
  });
});

describe("reset token", () => {
  it("is read once and removed from the address bar with replaceState", () => {
    window.history.replaceState(null, "", "/reset-password?token=demo-u-admin-42&next=%2Fesim%2Forders");
    const before = window.history.length;
    expect(takeResetToken()).toBe("demo-u-admin-42");
    expect(window.location.pathname).toBe("/reset-password");
    expect(window.location.search).toBe("?next=%2Fesim%2Forders");
    expect(window.location.href).not.toContain("token");
    // replaced, not pushed: the old URL with the token isn't in history
    expect(window.history.length).toBe(before);
    // a second read finds nothing
    expect(takeResetToken()).toBeNull();
  });

  it("returns null when the link has no token", () => {
    window.history.replaceState(null, "", "/reset-password");
    expect(takeResetToken()).toBeNull();
    expect(window.location.pathname).toBe("/reset-password");
  });

  it("reads the token from a link (the demo email)", () => {
    expect(tokenFromLink("/reset-password?token=abc%2B1")).toBe("abc+1");
    expect(tokenFromLink("/reset-password")).toBeNull();
  });
});
