/**
 * The sign-in step machine (spec 8.31). Every step is a face of one card:
 *
 *   credentials → mfa ⇄ recovery
 *   credentials → change-password → mfa-setup → workspace
 *
 * Pure: no React, no browser. The sign-in flow component feeds it events and
 * turns the card when the step changes. The step after the password relies only
 * on the server's short-lived 2FA challenge (cookie), never on browser data.
 */

export type SignInStep = "credentials" | "mfa" | "recovery" | "change-password" | "mfa-setup";

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
  /** "Back to sign in", or the browser Back button from the code step. */
  | { type: "back" }
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
      return isCode(state.step) ? to("credentials", -1, "major") : state;
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

const ORDER: Record<SignInStep, number> = { credentials: 0, mfa: 1, recovery: 2, "change-password": 3, "mfa-setup": 4 };

// ------------------------------------------------------------------ the URL --

export const STEP_PATH: Record<SignInStep, string> = {
  credentials: "/",
  mfa: "/login/2fa",
  recovery: "/login/2fa",
  "change-password": "/login/change-password",
  "mfa-setup": "/login/setup-2fa",
};

export const STEP_TITLE: Record<SignInStep, string> = {
  credentials: "Sign in",
  mfa: "Two-factor authentication",
  recovery: "Two-factor authentication",
  "change-password": "Set a new password",
  "mfa-setup": "Set up two-factor authentication",
};

/** The step a URL path stands for (recovery shares the code step's URL). */
export function stepFromPath(pathname: string): SignInStep {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/login/2fa") return "mfa";
  if (p === "/login/change-password") return "change-password";
  if (p === "/login/setup-2fa") return "mfa-setup";
  return "credentials";
}

/** Two steps share a URL: switching between them never adds a history entry. */
export const samePath = (a: SignInStep, b: SignInStep) => STEP_PATH[a] === STEP_PATH[b];

/**
 * Forward from the password to the code is a new history entry (so Back turns
 * the card back); later steps replace it, because once signed in there is no
 * going back to the password.
 */
export function historyMode(from: SignInStep, to: SignInStep): "push" | "replace" | "none" {
  if (samePath(from, to)) return "none";
  return from === "credentials" && isCode(to) ? "push" : "replace";
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
};

/**
 * Where a URL really lands, given what the server knows: a refresh on the
 * code step without a live challenge goes back to the password with a short
 * message; a signed-in user never sees the password or code again.
 */
export function resolveStep(urlStep: SignInStep, ctx: ResolveContext): Resolved {
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
