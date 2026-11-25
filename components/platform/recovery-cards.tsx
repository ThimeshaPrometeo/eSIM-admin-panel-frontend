"use client";

import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Lock, Mail, UserRound } from "lucide-react";
import { MIN_PASSWORD_LENGTH, passwordRules, passwordStrength } from "@/lib/platform/password";
import { cn } from "@/lib/utils";
import { CardFoot, CardShell, labelClass, linkClass, Spinner } from "./sign-in-view";

/*
 * The password-recovery faces of the sign-in card (spec 8.31). They turn like
 * the other steps (sign-in-flow-client.tsx). Copy lives here.
 */
export const RECOVERY_COPY = {
  forgot: {
    title: "Reset your password",
    sub: "Enter your username or email and we'll send you a link to choose a new password.",
    field: "Username or email",
    submit: "Send reset link",
  },
  sent: {
    title: "Check your email",
    text: (who: string) => (
      <>
        If an account exists for <strong className="break-all font-medium text-[var(--si-fg)]">{who}</strong>, we&apos;ve sent a link to reset your password. The
        link expires in 1 hour.
      </>
    ),
    resend: "Didn't get it? Send again",
    resendIn: (s: number) => `Didn't get it? Send again in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`,
  },
  reset: {
    title: "Choose a new password",
    sub: "Choose a password only you know.",
    next: "New password",
    confirm: "Confirm password",
    mismatch: "The two passwords don't match.",
    match: "Passwords match.",
    submit: "Save new password",
  },
  done: {
    title: "Password updated",
    text: "You can now sign in with your new password. For your security, you've been signed out on all devices.",
    submit: "Sign in",
  },
  expired: {
    title: "This link has expired",
    text: "Reset links are valid for 1 hour and can be used once.",
    submit: "Send a new link",
  },
  back: "Back to sign in",
} as const;

/** Seconds between two reset emails. */
export const RESEND_SECONDS = 60;

function ErrorLine({ id, error }: { id?: string; error?: string | null }) {
  return error ? (
    <p id={id} role="alert" className="text-[13px] text-[var(--si-danger)]">
      {error}
    </p>
  ) : null;
}

function Primary({ busy, disabled, children, type = "submit", onClick }: { busy?: boolean; disabled?: boolean; children: ReactNode; type?: "submit" | "button"; onClick?: () => void }) {
  return (
    <button type={type} onClick={onClick} className="si-btn si-btn-primary mt-2 w-full short:mt-1" disabled={busy || disabled}>
      {children}
      {busy ? <Spinner /> : <ArrowRight aria-hidden="true" className="si-arrow size-[18px]" strokeWidth={2} />}
    </button>
  );
}

function Back({ onBack, disabled }: { onBack: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onBack} className="si-btn si-btn-ghost w-full" disabled={disabled}>
      <ArrowLeft aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
      {RECOVERY_COPY.back}
    </button>
  );
}

const noSubmit = (e: FormEvent) => e.preventDefault();

/** Ask for a reset link. */
export function ForgotPasswordFace({
  onSubmit,
  onBack,
  busy,
  error,
  initialValue = "",
}: {
  onSubmit: (identifier: string) => void | Promise<void>;
  onBack: () => void;
  busy?: boolean;
  error?: string | null;
  initialValue?: string;
}) {
  const id = useId();
  const t = RECOVERY_COPY.forgot;
  const [value, setValue] = useState(initialValue);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!busy && value.trim()) await onSubmit(value.trim());
  };
  return (
    <CardShell title={t.title} sub={t.sub} onSubmit={submit} busy={busy}>
      <div className="mt-5 flex flex-col gap-4 short:mt-4 short:gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-user`} className={labelClass}>
            {t.field}
          </label>
          <div className="si-field px-3.5" data-invalid={error ? "true" : undefined}>
            <UserRound aria-hidden="true" className="mr-3 size-[18px] shrink-0 text-[var(--si-fg-subtle)]" strokeWidth={1.75} />
            <input
              id={`${id}-user`}
              name="identifier"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="name@company.com"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              required
            />
          </div>
        </div>
        <ErrorLine id={`${id}-error`} error={error} />
        <Primary busy={busy} disabled={!value.trim()}>
          {t.submit}
        </Primary>
        <Back onBack={onBack} disabled={busy} />
      </div>
      <CardFoot />
    </CardShell>
  );
}

/** Ticks once a second while a countdown runs. */
function useSecondsLeft(until: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  return Math.min(RESEND_SECONDS, Math.max(0, Math.ceil((until - now) / 1000)));
}

/** The same answer whether or not the account exists. */
export function ResetLinkSentFace({
  identifier,
  resendAt,
  onResend,
  onBack,
  busy,
  error,
}: {
  identifier: string;
  /** When "Send again" opens up (60 s after each send). */
  resendAt: number;
  onResend: () => void;
  onBack: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const t = RECOVERY_COPY.sent;
  const left = useSecondsLeft(resendAt);
  return (
    <CardShell title={t.title} sub="" onSubmit={noSubmit} busy={busy}>
      <div className="-mt-1 flex flex-col gap-4 short:gap-3">
        <p className="flex items-start gap-3 text-[14px] leading-[1.55] text-[var(--si-fg-muted)]">
          <Mail aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-[var(--si-teal)]" strokeWidth={1.75} />
          <span>{t.text(identifier)}</span>
        </p>
        <ErrorLine error={error} />
        <button type="button" onClick={onBack} className="si-btn si-btn-primary mt-1 w-full" data-autofocus>
          <ArrowLeft aria-hidden="true" className="size-[18px]" strokeWidth={2} />
          {RECOVERY_COPY.back}
        </button>
        <button type="button" onClick={onResend} disabled={busy || left > 0} className={cn(linkClass, "self-center disabled:cursor-not-allowed disabled:text-[var(--si-fg-subtle)] disabled:no-underline")}>
          <span className="inline-flex items-center gap-2 tabular">
            {left > 0 ? t.resendIn(left) : t.resend}
            {busy ? <Spinner /> : null}
          </span>
        </button>
      </div>
      <CardFoot />
    </CardShell>
  );
}

/** A new password from the emailed link, with live strength and rule hints. Fields are cleared after each submit. */
export function ResetPasswordFace({
  onSubmit,
  busy,
  error,
  checking,
}: {
  onSubmit: (password: string) => void | Promise<void>;
  busy?: boolean;
  error?: string | null;
  /** The link is still being checked: the form waits. */
  checking?: boolean;
}) {
  const id = useId();
  const t = RECOVERY_COPY.reset;
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const rules = passwordRules(next);
  const strength = passwordStrength(next);
  const mismatch = confirm.length > 0 && confirm !== next;
  const ready = next.length >= MIN_PASSWORD_LENGTH && next === confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || checking || !ready) return;
    const pw = next;
    // never keep a password in state longer than needed
    setNext("");
    setConfirm("");
    setShow(false);
    await onSubmit(pw);
  };

  const input = (key: "next" | "confirm", value: string, set: (v: string) => void, describedBy: string, invalid?: boolean) => (
    <div className="si-field pl-3.5 pr-1" data-invalid={invalid ? "true" : undefined}>
      <Lock aria-hidden="true" className="mr-3 size-[18px] shrink-0 text-[var(--si-fg-subtle)]" strokeWidth={1.75} />
      <input
        id={`${id}-${key}`}
        name={key === "next" ? "new-password" : "confirm-password"}
        type={show ? "text" : "password"}
        autoComplete="new-password"
        value={value}
        disabled={checking}
        onChange={(e) => set(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        required
      />
      {key === "next" ? (
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide passwords" : "Show passwords"}
          className="grid size-11 shrink-0 place-items-center rounded-[10px] text-[var(--si-fg-subtle)] transition-colors hover:text-[var(--si-fg)] focus-visible:outline-2 focus-visible:outline-[var(--si-blue)]"
        >
          {show ? <EyeOff className="size-[18px]" strokeWidth={1.75} /> : <Eye className="size-[18px]" strokeWidth={1.75} />}
        </button>
      ) : null}
    </div>
  );

  const tone = ["", "var(--si-danger)", "oklch(0.8 0.15 80)", "var(--si-blue)", "var(--si-teal)"][strength.score];
  return (
    <CardShell title={t.title} sub={t.sub} onSubmit={submit} busy={busy || checking}>
      <div className="mt-5 flex flex-col gap-4 short:mt-4 short:gap-3 tiny:mt-3 tiny:gap-2.5">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-next`} className={labelClass}>
            {t.next}
          </label>
          {input("next", next, setNext, `${id}-strength ${id}-rules`, next.length > 0 && next.length < MIN_PASSWORD_LENGTH)}
          <div className="flex items-center gap-3" id={`${id}-strength`}>
            <div className="grid flex-1 grid-cols-4 gap-1.5" aria-hidden="true">
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className="h-1 rounded-full bg-[var(--si-hairline-strong)] transition-colors duration-200" style={n <= strength.score ? { background: tone } : undefined} />
              ))}
            </div>
            <span className="w-14 text-right text-[12px] font-medium" style={{ color: tone || "var(--si-fg-subtle)" }}>
              {strength.label ? <span className="sr-only">Strength: </span> : null}
              {strength.label || " "}
            </span>
          </div>
          <ul id={`${id}-rules`} className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]" aria-label="Password rules">
            {rules.map((r) => (
              <li key={r.key} className={cn("flex items-center gap-1.5", r.met ? "text-[var(--si-teal)]" : "text-[var(--si-fg-subtle)]")}>
                {r.met ? <Check aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.25} /> : <span aria-hidden="true" className="mx-[5px] size-1 shrink-0 rounded-full bg-current" />}
                <span>
                  {r.label}
                  {r.required ? <span className="sr-only"> (required)</span> : null}
                  <span className="sr-only">{r.met ? ": done" : ": not yet"}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-confirm`} className={labelClass}>
            {t.confirm}
          </label>
          {input("confirm", confirm, setConfirm, `${id}-match`, mismatch)}
          <p id={`${id}-match`} className={cn("min-h-[18px] text-[12px]", mismatch ? "text-[var(--si-danger)]" : "text-[var(--si-teal)]")} aria-live="polite">
            {mismatch ? t.mismatch : ready ? t.match : ""}
          </p>
        </div>
        <ErrorLine error={error} />
        <Primary busy={busy} disabled={!ready || checking}>
          {t.submit}
        </Primary>
      </div>
      <CardFoot />
    </CardShell>
  );
}

export function ResetDoneFace({ onSignIn }: { onSignIn: () => void }) {
  const t = RECOVERY_COPY.done;
  return (
    <CardShell title={t.title} sub={t.text} onSubmit={noSubmit}>
      <div className="mt-5 flex flex-col">
        <Primary type="button" onClick={onSignIn}>
          {t.submit}
        </Primary>
      </div>
      <CardFoot />
    </CardShell>
  );
}

export function ResetExpiredFace({ onNewLink, onBack }: { onNewLink: () => void; onBack: () => void }) {
  const t = RECOVERY_COPY.expired;
  return (
    <CardShell title={t.title} sub={t.text} onSubmit={noSubmit}>
      <div className="mt-5 flex flex-col gap-3">
        <Primary type="button" onClick={onNewLink}>
          {t.submit}
        </Primary>
        <Back onBack={onBack} />
      </div>
      <CardFoot />
    </CardShell>
  );
}
