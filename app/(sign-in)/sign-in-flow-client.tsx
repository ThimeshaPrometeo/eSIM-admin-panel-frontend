"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { SetupTwoFactorCard } from "@/components/platform/auth-cards";
import { CardTurn } from "@/components/platform/card-turn";
import { ForgotPasswordFace, RESEND_SECONDS, ResetDoneFace, ResetExpiredFace, ResetLinkSentFace, ResetPasswordFace } from "@/components/platform/recovery-cards";
import { ChangePasswordCard, CodeCard, DetachedCardRef, SignInCard, SignInView, useCardRef, type TwoFactorValues } from "@/components/platform/sign-in-view";
import { usePlatform } from "@/contexts/platform-context";
import { useResource } from "@/hooks/use-resource";
import { accountsApi } from "@/lib/api/accounts";
import { authApi } from "@/lib/api/auth";
import { ApiError, errorMessage, retryAfterSeconds } from "@/lib/api/errors";
import {
  flowReducer,
  historyMode,
  initialFlow,
  isRecoveryStep,
  landingStep,
  nextPath,
  resolveStep,
  SESSION_EXPIRED,
  STEP_ANNOUNCEMENT,
  STEP_PATH,
  STEP_TITLE,
  stepFromPath,
  stepUrl,
  takeResetToken,
  tokenFromLink,
  type SignInStep,
} from "@/lib/platform/sign-in-flow";
import { skippedTwoFactor, skipTwoFactor } from "@/lib/platform/two-factor";
import { SIGN_IN_DATA } from "../sign-in-shared";

const isCode = (s: SignInStep) => s === "mfa" || s === "recovery";
const isResetStep = (s: SignInStep) => s === "reset-password" || s === "reset-done" || s === "reset-expired";

/**
 * Asking for a reset link always takes at least this long, so the answer
 * time doesn't hint whether the account exists.
 */
const RESET_REQUEST_MIN_MS = 900;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tryAgainIn = (seconds: number) => {
  const m = Math.max(1, Math.ceil(seconds / 60));
  return `Too many requests. Try again in ${m} minute${m === 1 ? "" : "s"}.`;
};

/**
 * The whole sign-in as one card (spec 8.31): password → code (or recovery
 * code) → forced password change → 2FA set-up prompt → workspace. Each step
 * is a face of the same card; the URL follows the step with shallow history
 * updates, so the browser Back button turns the card back. The globe and the
 * background never remount.
 */
export function SignInFlowClient() {
  const { status, me, isDemo, signIn, signInWithPasskey, verifyMfa, changePassword, reloadMe } = usePlatform();
  const router = useRouter();
  const params = useSearchParams();
  const next = nextPath(params.get("next"));
  const invite = params.get("invite") === "1";

  const pathname = usePathname();
  // the step this page was opened (or refreshed) on; later URL changes come from the card itself or from Back / Forward
  const [urlStep] = useState(() => stepFromPath(pathname));
  const [flow, dispatch] = useReducer(flowReducer, urlStep, initialFlow);
  const [resolved, setResolved] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  /** Signed in and on the way to the workspace: nothing more to submit. */
  const leaving = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [lock, setLock] = useState<{ until: number; minutes: number } | null>(null);
  /** We added a history entry right above the password face, so "Back to sign in" can simply go back. */
  const pushedOverCredentials = useRef(false);
  const lastStep = useRef<SignInStep>(urlStep);

  // ---- password recovery: what was typed (for the confirmation and "Send again") and the reset token, in memory only
  const [identifier, setIdentifier] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const resetToken = useRef<string | null | undefined>(undefined);
  const tokenState = useRef<"valid" | "invalid" | "none">("none");

  // the token leaves the address bar before anything else runs (and before anyone can copy the URL)
  useLayoutEffect(() => {
    if (resetToken.current === undefined && isResetStep(urlStep)) resetToken.current = takeResetToken();
  }, [urlStep]);

  const checkToken = async (token: string | null | undefined) => {
    const valid = token ? await authApi.checkResetToken(token).then((r) => r.valid, () => false) : false;
    tokenState.current = valid ? "valid" : token ? "invalid" : "none";
    return tokenState.current;
  };

  // ---- first load (or refresh): where does this URL really land?
  useEffect(() => {
    // password recovery doesn't wait for the session
    if (resolved || (status === "loading" && !isRecoveryStep(urlStep))) return;
    let live = true;
    void (async () => {
      const pendingMfa = status === "signed_out" && isCode(urlStep) ? await authApi.hasPendingMfa().catch(() => false) : false;
      const resetTokenState = isResetStep(urlStep) ? await checkToken(resetToken.current) : "none";
      if (!live) return;
      const to = resolveStep(urlStep, {
        status: status === "signed_in" ? "signed_in" : "signed_out",
        me,
        pendingMfa,
        skippedSetup: !!me && skippedTwoFactor(me.id),
        resetToken: resetTokenState,
      });
      dispatch({ type: "restore", to, animate: false });
      if (to.step !== "workspace" && STEP_PATH[to.step] !== window.location.pathname) window.history.replaceState(null, "", stepUrl(to.step, next, invite));
      lastStep.current = to.step === "workspace" ? lastStep.current : to.step;
      setResolved(true);
    })();
    return () => {
      live = false;
    };
  }, [resolved, status, me, urlStep, next, invite]);

  // ---- the URL follows the step (shallow: no navigation, nothing re-renders but the card)
  useEffect(() => {
    if (!resolved) return;
    const from = lastStep.current;
    lastStep.current = flow.step;
    document.title = `${STEP_TITLE[flow.step]} · eSIM platform`;
    if (window.location.pathname === STEP_PATH[flow.step]) return;
    const mode = historyMode(from, flow.step);
    const url = stepUrl(flow.step, next, invite);
    if (mode === "push") {
      window.history.pushState(null, "", url);
      pushedOverCredentials.current = from === "credentials";
    } else window.history.replaceState(null, "", url);
    // only when the step changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.step, resolved]);

  // ---- browser Back / Forward: turn the card to the URL's step (if the server agrees)
  const ctx = useRef({ status, me, next, invite });
  useEffect(() => {
    ctx.current = { status, me, next, invite };
  });
  useEffect(() => {
    const onPop = async () => {
      const target = stepFromPath(window.location.pathname);
      const c = ctx.current;
      if (c.status === "loading" && !isRecoveryStep(target)) return;
      const pendingMfa = c.status === "signed_out" && isCode(target) ? await authApi.hasPendingMfa().catch(() => false) : false;
      const to = resolveStep(target, {
        status: c.status === "signed_in" ? "signed_in" : "signed_out",
        me: c.me,
        pendingMfa,
        skippedSetup: !!c.me && skippedTwoFactor(c.me.id),
        resetToken: tokenState.current,
      });
      if (to.step !== "workspace" && STEP_PATH[to.step] !== window.location.pathname) window.history.replaceState(null, "", stepUrl(to.step, c.next, c.invite));
      if (to.step !== "workspace") lastStep.current = to.step;
      if (to.step === "credentials") pushedOverCredentials.current = false;
      setError(null);
      dispatch({ type: "restore", to, animate: true });
    };
    const handler = () => void onPop();
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  // ---- the code step: have the workspace ready for the hand-off
  useEffect(() => {
    if (isCode(flow.step) || flow.step === "mfa-setup") router.prefetch(next);
  }, [flow.step, next, router]);

  // ---- a code lock lifts by itself
  useEffect(() => {
    if (!lock) return;
    const t = setTimeout(() => setLock(null), Math.max(0, lock.until - Date.now()));
    return () => clearTimeout(t);
  }, [lock]);

  const onExited = useCallback(() => {
    leaving.current = true;
    router.replace(next);
  }, [router, next]);

  /** Runs one submit at a time; busy stays on when the card leaves. */
  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (submitting.current || leaving.current) return undefined;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } finally {
      submitting.current = false;
      // leaving: the button keeps its spinner while the card fades out
      if (!leaving.current) setBusy(false);
    }
  };

  const signedIn = (m: NonNullable<typeof me>) => {
    setError(null);
    const skippedSetup = skippedTwoFactor(m.id);
    if (landingStep(m, skippedSetup) === "workspace") leaving.current = true;
    dispatch({ type: "signed-in", me: m, skippedSetup });
  };

  const onPassword = async ({ username, password }: { username: string; password: string }) => {
    const ok = await run(async () => {
      try {
        const r = await signIn(username, password);
        if (r.mfaRequired) dispatch({ type: "mfa-required" });
        else signedIn(r.me);
        return true;
      } catch (e) {
        setError(errorMessage(e));
        return false;
      }
    });
    return ok === true;
  };

  const onPasskey = () =>
    void run(async () => {
      try {
        const m = await signInWithPasskey();
        toast.success("Signed in with a passkey");
        signedIn(m);
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  const onVerify = async ({ code, method }: TwoFactorValues) => {
    if (submitting.current || leaving.current) return true; // a second submit of the same code: leave the boxes alone
    const ok = await run(async () => {
      try {
        signedIn(await verifyMfa(code, method));
        return true;
      } catch (e) {
        const wait = retryAfterSeconds(e);
        if (wait) setLock({ until: Date.now() + wait * 1000, minutes: Math.ceil(wait / 60) });
        else if (e instanceof ApiError && e.code === "UNAUTHENTICATED") {
          // the server's challenge expired: start again from the password
          dispatch({ type: "restore", to: { step: "credentials", message: SESSION_EXPIRED }, animate: true });
          pushedOverCredentials.current = false;
        } else setError(errorMessage(e));
        return false;
      }
    });
    return ok !== false;
  };

  const onBack = () => {
    setError(null);
    // our own history entry: Back pops it and the popstate handler turns the card
    if (pushedOverCredentials.current) window.history.back();
    else dispatch({ type: "back" });
  };

  const onChangePassword = (v: { currentPassword: string; newPassword: string }) =>
    void run(async () => {
      try {
        const m = await changePassword(v.currentPassword, v.newPassword);
        toast.success("Password changed");
        signedIn(m);
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  // ---- password recovery
  /** Opens a reset link inside the card: the token stays in memory and never reaches the address bar. */
  const openResetLink = async (link: string) => {
    if (leaving.current) return;
    const token = tokenFromLink(link);
    resetToken.current = token;
    const state = await checkToken(token);
    setError(null);
    dispatch({ type: "restore", to: { step: state === "valid" ? "reset-password" : "reset-expired", message: null }, animate: true });
  };

  const sendLink = (value: string) =>
    void run(async () => {
      const started = Date.now();
      try {
        const r = await authApi.forgotPassword({ identifier: value });
        await wait(RESET_REQUEST_MIN_MS - (Date.now() - started));
        setIdentifier(value);
        setResendAt(Date.now() + RESEND_SECONDS * 1000);
        dispatch({ type: "link-sent" });
        // demo mode has no email: the "email" is a toast with the link
        if (isDemo)
          toast("Demo email", {
            description: r.demoLink ? `A reset link for ${value}. No email is sent in demo mode.` : `No account matches ${value}, so no email would be sent. Shown in demo mode only.`,
            action: r.demoLink ? { label: "Open reset link", onClick: () => void openResetLink(r.demoLink!) } : undefined,
            duration: 30000,
          });
      } catch (e) {
        await wait(RESET_REQUEST_MIN_MS - (Date.now() - started));
        const secs = retryAfterSeconds(e);
        setError(secs ? tryAgainIn(secs) : errorMessage(e));
      }
    });

  const onResetPassword = (password: string) =>
    void run(async () => {
      try {
        await authApi.resetPassword({ token: resetToken.current ?? "", newPassword: password });
        // the link is used up; the server signed this user out everywhere
        resetToken.current = null;
        tokenState.current = "invalid";
        await reloadMe().catch(() => null);
        dispatch({ type: "reset-done" });
      } catch (e) {
        if (e instanceof ApiError && e.code === "RESET_LINK_EXPIRED") {
          resetToken.current = null;
          tokenState.current = "invalid";
          dispatch({ type: "link-invalid" });
          return;
        }
        const secs = retryAfterSeconds(e);
        setError(secs ? tryAgainIn(secs) : errorMessage(e));
      }
    });

  const face = (key: string): ReactNode => {
    const step = key as SignInStep;
    const active = step === flow.step;
    const err = active ? error : null;
    switch (step) {
      case "credentials":
        return (
          <SignInCard
            onSubmit={onPassword}
            onPasskey={onPasskey}
            onForgot={() => {
              setError(null);
              dispatch({ type: "forgot" });
            }}
            busy={active && busy}
            error={err}
            notice={
              active && flow.message ? (
                <p role="status" className="text-[13px] text-[var(--si-fg-muted)]">
                  {flow.message}
                </p>
              ) : null
            }
          />
        );
      case "mfa":
      case "recovery":
        return (
          <CodeCard
            method={step === "mfa" ? "totp" : "recovery"}
            onVerify={onVerify}
            onSwitch={() => {
              setError(null);
              dispatch({ type: step === "mfa" ? "use-recovery" : "use-app" });
            }}
            onBack={onBack}
            busy={active && busy}
            error={err}
            lockedMinutes={lock?.minutes ?? null}
          />
        );
      case "change-password":
        return <ChangePasswordCard onSubmit={onChangePassword} busy={active && busy} error={err} />;
      case "forgot-password":
        return <ForgotPasswordFace initialValue={identifier} onSubmit={sendLink} onBack={onBack} busy={active && busy} error={err} />;
      case "reset-link-sent":
        return <ResetLinkSentFace identifier={identifier} resendAt={resendAt} onResend={() => sendLink(identifier)} onBack={onBack} busy={active && busy} error={err} />;
      case "reset-password":
        return <ResetPasswordFace onSubmit={onResetPassword} busy={active && busy} error={err} checking={!resolved} />;
      case "reset-done":
        return (
          <ResetDoneFace
            onSignIn={() => {
              setError(null);
              dispatch({ type: "sign-in" });
            }}
          />
        );
      case "reset-expired":
        return (
          <ResetExpiredFace
            onNewLink={() => {
              setError(null);
              dispatch({ type: "new-link" });
            }}
            onBack={onBack}
          />
        );
      case "mfa-setup":
        return (
          <SetupFace
            invite={invite}
            onFinish={() => dispatch({ type: "finish" })}
            reloadMe={reloadMe}
            username={me?.username ?? ""}
            userId={me?.id ?? null}
            signedIn={status === "signed_in"}
          />
        );
    }
  };

  return (
    <SignInView
      countryCount={SIGN_IN_DATA.countryCount}
      events={SIGN_IN_DATA.events}
      systemStatus={SIGN_IN_DATA.systemStatus}
      tall={flow.step === "mfa-setup" || flow.step === "reset-password"}
      leaving={flow.exiting}
      card={
        <TurningCard
          faceKey={flow.step}
          turn={{ kind: flow.turn, dir: flow.dir }}
          render={face}
          focusOnMount={urlStep !== "credentials"}
          ready={resolved}
          exiting={flow.exiting}
          onExited={onExited}
        />
      }
    />
  );
}

/** The turning card takes the page's card ref (the globe's signal lands on it); its faces don't. */
function TurningCard(props: Omit<Parameters<typeof CardTurn>[0], "ref" | "announce">) {
  const ref = useCardRef();
  const { render } = props;
  return <CardTurn {...props} ref={ref} announce={(k) => STEP_ANNOUNCEMENT[k as SignInStep]} render={(k) => <DetachedCardRef>{render(k)}</DetachedCardRef>} />;
}

/** The 2FA set-up prompt (Q-ROUTE2FA): skippable until go-live, but not after accepting an invitation. */
function SetupFace({
  invite,
  onFinish,
  reloadMe,
  username,
  userId,
  signedIn,
}: {
  invite: boolean;
  onFinish: () => void;
  reloadMe: () => Promise<unknown>;
  username: string;
  userId: string | null;
  signedIn: boolean;
}) {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setup = useResource(() => accountsApi.startTotpSetup(), ["totp-setup", userId], signedIn && !codes);
  return (
    <SetupTwoFactorCard
      setup={setup.data ?? null}
      codes={codes}
      username={username}
      busy={busy}
      error={error ?? (setup.error ? errorMessage(setup.error) : null)}
      onConfirm={async (code) => {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
          const r = await accountsApi.confirmTotp(code);
          setCodes(r.recoveryCodes);
        } catch (e) {
          setError(errorMessage(e));
        } finally {
          setBusy(false);
        }
      }}
      onDone={async () => {
        await reloadMe();
        toast.success("Two-factor authentication is on");
        onFinish();
      }}
      onSkip={
        invite
          ? undefined
          : () => {
              if (userId) skipTwoFactor(userId);
              onFinish();
            }
      }
    />
  );
}
