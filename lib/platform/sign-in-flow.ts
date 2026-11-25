/**
 * The sign-in step machine (spec 8.31). Every step is a face of one card:
 *
 *   credentials → mfa ⇄ recovery
 *   credentials → change-password → mfa-setup → workspace
 *   credentials → forgot-password → reset-link-sent
 *   (email link) reset-password → reset-done → credentials
 *   (email link) reset-expired → forgot-password
 *
 * Pure: no React, no browser. The sign-in flow component feeds it events and
 * turns the card when the step changes. The step after the password relies only
 * on the server's short-lived 2FA challenge (cookie), never on browser data.
 */

export type SignInStep =
  | "credentials"
  | "mfa"
  | "recovery"
  | "change-password"
  | "mfa-setup"
  | "forgot-password"
  | "reset-link-sent"
  | "reset-password"
  | "reset-done"
  | "reset-expired";

/** How the card changes face: a full turn, a lighter turn (recovery ⇄ app), or none (restoring a refresh). */
export type TurnKind = "major" | "minor" | "none";

export type FlowState = {
  step: SignInStep;
  /** 1 = forward (turns left), -1 = back (turns right). */
  dir: 1 | -1;
  turn: TurnKind;
  /** A short message on the credentials face, e.g. after an expired 2FA challenge. */
  message: string | null;
  /** Signed in: the card fades out and the page hands off to the workspace. */
  exiting: boolean;
};

/** What decides the landing step after signing in. */
export type LandingUser = { id: string; mustChangePassword: boolean; mfaEnrolled: boolean; hasPasskey: boolean };

export type FlowEvent =
  /** Password accepted; a second factor is needed. */
  | { type: "mfa-required" }
  /** Signed in (password without 2FA, verified code, passkey, or a changed password). */
  | { type: "signed-in"; me: LandingUser; skippedSetup: boolean }
  | { type: "use-recovery" }
  | { type: "use-app" }
  /** "Back to sign in" from the code step, the forgot-password form, its confirmation or an expired link. */
  | { type: "back" }
  /** "Forgot password?" on the password face. */
  | { type: "forgot" }
  /** The reset link was requested (the same answer whether or not the account exists). */
  | { type: "link-sent" }
  /** The new password was saved. */
  | { type: "reset-done" }
  /** The reset link turned out to be expired or used (on submit). */
  | { type: "link-invalid" }
  /** "Sign in" after a reset. */
  | { type: "sign-in" }
  /** "Send a new link" on the expired-link face. */
  | { type: "new-link" }
  /** 2FA set up, or "Remind me next time". */
  | { type: "finish" }
  /** The URL changed (refresh, Back or Forward); `resolveStep` decided where that lands. */
  | { type: "restore"; to: Resolved; animate: boolean };

export const SESSION_EXPIRED = "Your sign-in timed out. Enter your password again.";

/** What the live region says when each face settles. */
export const STEP_ANNOUNCEMENT: Record<SignInStep, string> = {
  credentials: "Sign in with your username and password",
  mfa: "Enter the 6-digit code from your authenticator app",
  recovery: "Enter one of your recovery codes",
  "change-password": "Choose a new password",
  "mfa-setup": "Set up two-factor authentication",
  "forgot-password": "Reset your password. Enter your username or email",
  "reset-link-sent": "Check your email for a reset link",
  "reset-password": "Choose a new password",
  "reset-done": "Password updated. You can now sign in",
  "reset-expired": "This reset link has expired",
};

export function initialFlow(step: SignInStep): FlowState {
  return { step, dir: 1, turn: "none", message: null, exiting: false };
}

/** Where a signed-in user goes next: the forced password change, then the 2FA set-up prompt, then the workspace. */
export function landingStep(me: LandingUser, skippedSetup: boolean): "change-password" | "mfa-setup" | "workspace" {
  if (me.mustChangePassword) return "change-password";
  if (!me.mfaEnrolled && !me.hasPasskey && !skippedSetup) return "mfa-setup";
  return "workspace";
}

const isCode = (s: SignInStep) => s === "mfa" || s === "recovery";
/** Faces of the password recovery: they don't depend on being signed in. */
export const isRecoveryStep = (s: SignInStep) =>
  s === "forgot-password" || s === "reset-link-sent" || s === "reset-password" || s === "reset-done" || s === "reset-expired";

export function flowReducer(state: FlowState, event: FlowEvent): FlowState {
  if (state.exiting) return state;
  const to = (step: SignInStep, dir: 1 | -1, turn: TurnKind, message: string | null = null): FlowState =>
    step === state.step && message === state.message ? state : { step, dir, turn, message, exiting: false };

  switch (event.type) {
    case "mfa-required":
      return state.step === "credentials" ? to("mfa", 1, "major") : state;
    case "signed-in": {
      const next = landingStep(event.me, event.skippedSetup);
      if (next === "workspace") return { ...state, exiting: true, message: null };
      return to(next, 1, "major");
    }
    case "use-recovery":
      return state.step === "mfa" ? to("recovery", 1, "minor") : state;
    case "use-app":
      return state.step === "recovery" ? to("mfa", -1, "minor") : state;
    case "back":
      return isCode(state.step) || state.step === "forgot-password" || state.step === "reset-link-sent" || state.step === "reset-expired"
        ? to("credentials", -1, "major")
        : state;
    case "forgot":
      return state.step === "credentials" ? to("forgot-password", 1, "major") : state;
    case "link-sent":
      return state.step === "forgot-password" ? to("reset-link-sent", 1, "major") : state;
    case "reset-done":
      return state.step === "reset-password" ? to("reset-done", 1, "major") : state;
    case "link-invalid":
      return state.step === "reset-password" ? to("reset-expired", 1, "major") : state;
    case "sign-in":
      return state.step === "reset-done" ? to("credentials", 1, "major") : state;
    case "new-link":
      return state.step === "reset-expired" ? to("forgot-password", 1, "major") : state;
    case "finish":
      return state.step === "mfa-setup" ? { ...state, exiting: true } : state;
    case "restore": {
      const r = event.to;
      if (r.step === "workspace") return { ...state, exiting: true, message: null };
      if (r.step === state.step) return r.message === state.message ? state : { ...state, message: r.message };
      const dir = ORDER[r.step] < ORDER[state.step] ? -1 : 1;
      const turn: TurnKind = !event.animate ? "none" : isCode(r.step) && isCode(state.step) ? "minor" : "major";
      return { step: r.step, dir, turn, message: r.message, exiting: false };
    }
  }
}

const ORDER: Record<SignInStep, number> = {
  credentials: 0,
  mfa: 1,
  recovery: 2,
  "change-password": 3,
  "mfa-setup": 4,
  "forgot-password": 1,
  "reset-link-sent": 2,
  "reset-expired": 2,
  "reset-password": 3,
  "reset-done": 4,
};

// ------------------------------------------------------------------ the URL --

export const STEP_PATH: Record<SignInStep, string> = {
  credentials: "/",
  mfa: "/login/2fa",
  recovery: "/login/2fa",
  "change-password": "/login/change-password",
  "mfa-setup": "/login/setup-2fa",
  "forgot-password": "/forgot-password",
  "reset-link-sent": "/forgot-password",
  "reset-password": "/reset-password",
  "reset-done": "/reset-password",
  "reset-expired": "/reset-password",
};

export const STEP_TITLE: Record<SignInStep, string> = {
  credentials: "Sign in",
  mfa: "Two-factor authentication",
  recovery: "Two-factor authentication",
  "change-password": "Set a new password",
  "mfa-setup": "Set up two-factor authentication",
  "forgot-password": "Reset your password",
  "reset-link-sent": "Reset your password",
  "reset-password": "Choose a new password",
  "reset-done": "Password updated",
  "reset-expired": "Reset link expired",
};

/** The step a URL path stands for (recovery shares the code step's URL). */
export function stepFromPath(pathname: string): SignInStep {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/login/2fa") return "mfa";
  if (p === "/login/change-password") return "change-password";
  if (p === "/login/setup-2fa") return "mfa-setup";
  if (p === "/forgot-password") return "forgot-password";
  if (p === "/reset-password") return "reset-password";
  return "credentials";
}

/** Two steps share a URL: switching between them never adds a history entry. */
export const samePath = (a: SignInStep, b: SignInStep) => STEP_PATH[a] === STEP_PATH[b];

/**
 * Leaving the password face for the code or the forgot-password form is a new
 * history entry (so Back turns the card back), as is asking for a new link
 * from an expired one. Other steps replace the entry: once signed in there is
 * no going back to the password, and a used reset link can't be reopened.
 */
export function historyMode(from: SignInStep, to: SignInStep): "push" | "replace" | "none" {
  if (samePath(from, to)) return "none";
  if (from === "credentials" && (isCode(to) || to === "forgot-password")) return "push";
  if (from === "reset-expired" && to === "forgot-password") return "push";
  if (from === "reset-link-sent" && (to === "reset-password" || to === "reset-expired")) return "push";
  return "replace";
}

/** Where to go after signing in: the ?next= path when it is one of ours, else the dashboard. */
export function nextPath(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/login") ? raw : "/esim/dashboard";
}

/** The URL for a step, keeping ?next= (and ?invite=1 on the set-up step). */
export function stepUrl(step: SignInStep, next: string, invite = false) {
  const q = new URLSearchParams();
  if (next !== "/esim/dashboard") q.set("next", next);
  if (invite && step === "mfa-setup") q.set("invite", "1");
  const s = q.toString();
  return `${STEP_PATH[step]}${s ? `?${s}` : ""}`;
}

// ---------------------------------------------------------- refresh / Back --

export type Resolved = { step: SignInStep | "workspace"; message: string | null };

export type ResolveContext = {
  status: "signed_in" | "signed_out";
  me: LandingUser | null;
  /** The server still holds a 2FA challenge for this browser. */
  pendingMfa: boolean;
  skippedSetup: boolean;
  /** The reset token taken from the link (kept in memory only), checked with the server. */
  resetToken?: "valid" | "invalid" | "none";
};

/**
 * Where a URL really lands, given what the server knows: a refresh on the
 * code step without a live challenge goes back to the password with a short
 * message; a signed-in user never sees the password or code again.
 */
export function resolveStep(urlStep: SignInStep, ctx: ResolveContext): Resolved {
  // password recovery works signed in or out; the entered value and the token live in memory only,
  // so a refresh on the confirmation shows the form, and a reset face without a valid token is "expired"
  if (urlStep === "forgot-password" || urlStep === "reset-link-sent") return { step: "forgot-password", message: null };
  if (urlStep === "reset-password" || urlStep === "reset-done" || urlStep === "reset-expired")
    return { step: ctx.resetToken === "valid" ? "reset-password" : "reset-expired", message: null };
  if (ctx.status === "signed_in" && ctx.me) {
    const landing = landingStep(ctx.me, ctx.skippedSetup);
    // the set-up prompt stays reachable by URL until 2FA is on
    if (urlStep === "mfa-setup" && !ctx.me.mustChangePassword && !ctx.me.mfaEnrolled && !ctx.me.hasPasskey) return { step: "mfa-setup", message: null };
    return { step: landing, message: null };
  }
  if (isCode(urlStep)) return ctx.pendingMfa ? { step: urlStep, message: null } : { step: "credentials", message: SESSION_EXPIRED };
  // change-password and set-up need a session
  return { step: "credentials", message: null };
}

// ------------------------------------------------------------ reset token --

/**
 * Takes the reset token out of the address bar: reads `?token=` once and
 * replaces the URL without it (history.replaceState), so the token isn't left
 * in history or shared by accident. The caller keeps it in memory only.
 */
export function takeResetToken(win: Pick<Window, "location" | "history"> = window): string | null {
  const url = new URL(win.location.href);
  const token = url.searchParams.get("token");
  if (token === null) return null;
  url.searchParams.delete("token");
  win.history.replaceState(win.history.state, "", url.pathname + url.search + url.hash);
  return token || null;
}

/** The token inside a reset link (the demo "email" hands the link over). */
export function tokenFromLink(link: string): string | null {
  try {
    return new URL(link, "http://x").searchParams.get("token") || null;
  } catch {
    return null;
  }
}
