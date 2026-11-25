"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, ArrowRight, Check, Copy, Download, Lock, ShieldCheck } from "lucide-react";
import { downloadRecoveryCodes, groupSecret } from "@/lib/platform/two-factor";
import type { TotpSetup } from "@/lib/platform/types";
import { cn } from "@/lib/utils";
import { CardFoot, CardShell, labelClass, linkClass, Spinner, useCardRef } from "./sign-in-view";


function ErrorLine({ error }: { error?: string | null }) {
  return error ? (
    <p role="alert" className="text-[13px] text-[var(--si-danger)]">
      {error}
    </p>
  ) : null;
}

function Submit({ busy, disabled, children }: { busy?: boolean; disabled?: boolean; children: string }) {
  return (
    <button type="submit" className="si-btn si-btn-primary mt-2 w-full short:mt-1" disabled={busy || disabled}>
      {children}
      {busy ? <Spinner /> : <ArrowRight aria-hidden="true" className="si-arrow size-[18px]" strokeWidth={2} />}
    </button>
  );
}

function BackLink({ href = "/", children = "Back to sign in" }: { href?: string; children?: string }) {
  return (
    <Link href={href} className="si-btn si-btn-ghost w-full">
      <ArrowLeft aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
      {children}
    </Link>
  );
}

/**
 * 2FA set-up prompt (spec 8.31): scan the QR code (or type the secret), confirm
 * with a code, then save the recovery codes, shown once.
 */
export function SetupTwoFactorCard({
  setup,
  codes,
  onConfirm,
  onDone,
  onSkip,
  username,
  busy,
  error,
}: {
  setup: TotpSetup | null;
  codes: string[] | null;
  onConfirm: (code: string) => void | Promise<void>;
  onDone: () => void;
  /** Absent once 2FA is required (go-live). */
  onSkip?: () => void;
  username: string;
  busy?: boolean;
  error?: string | null;
}) {
  const cardRef = useCardRef();
  const id = useId();
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState<"secret" | "codes" | null>(null);
  const [saved, setSaved] = useState(false);
  const copy = async (text: string, what: "secret" | "codes") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard blocked: the text is on screen */
    }
  };

  if (codes)
    return (
      <CardShell ref={cardRef} title="Save your recovery codes" sub="Each code signs you in once if you lose your phone. They're shown only now." onSubmit={(e) => e.preventDefault()}>
        <div className="mt-4 flex flex-col gap-3">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-[12px] border border-[var(--si-hairline)] px-4 py-3 font-mono text-[14px]" aria-label="Recovery codes">
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="si-btn si-btn-outline" onClick={() => downloadRecoveryCodes(codes, username)}>
              <Download aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
              Download
            </button>
            <button type="button" className="si-btn si-btn-outline" onClick={() => copy(codes.join("\n"), "codes")}>
              {copied === "codes" ? <Check aria-hidden="true" className="size-[18px]" strokeWidth={2} /> : <Copy aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />}
              {copied === "codes" ? "Copied" : "Copy"}
            </button>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-[var(--si-fg-muted)]">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="size-4 accent-[var(--si-blue)]" />
            I&apos;ve saved these codes somewhere safe
          </label>
          <button type="button" className="si-btn si-btn-primary w-full" disabled={!saved} onClick={onDone}>
            Continue to the workspace
            <ArrowRight aria-hidden="true" className="si-arrow size-[18px]" strokeWidth={2} />
          </button>
        </div>
      </CardShell>
    );

  return (
    <CardShell
      ref={cardRef}
      title="Protect your account"
      sub="Set up an authenticator app. You'll enter a code from it each time you sign in."
      onSubmit={async (e) => {
        e.preventDefault();
        if (!busy && /^\d{6}$/.test(code)) await onConfirm(code);
      }}
      busy={busy}
    >
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <div className="grid size-[132px] shrink-0 place-items-center rounded-[12px] bg-white p-2 short:size-[116px]">
            {setup ? <QRCodeSVG value={setup.otpauthUri} size={116} level="M" title="QR code for your authenticator app" /> : <span className="size-full animate-pulse rounded bg-neutral-200" />}
          </div>
          <div className="flex min-w-0 flex-col gap-1.5 text-[13px] text-[var(--si-fg-muted)]">
            <p>1. Scan this with an authenticator app.</p>
            <p>Can&apos;t scan? Type this key:</p>
            <p className="break-all font-mono text-[13px] text-[var(--si-fg)]">{setup ? groupSecret(setup.secret) : "…"}</p>
            {setup ? (
              <button type="button" className={cn(linkClass, "self-start")} onClick={() => copy(setup.secret, "secret")}>
                {copied === "secret" ? "Copied" : "Copy key"}
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-code`} className={labelClass}>
            2. Enter the 6-digit code it shows
          </label>
          <div className="si-field px-3.5" data-invalid={error ? "true" : undefined}>
            <ShieldCheck aria-hidden="true" className="mr-3 size-[18px] shrink-0 text-[var(--si-fg-subtle)]" strokeWidth={1.75} />
            <input
              id={`${id}-code`}
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="font-mono tracking-[0.5em]"
              aria-invalid={error ? true : undefined}
              required
            />
          </div>
        </div>
        <ErrorLine error={error} />
        <Submit busy={busy} disabled={!/^\d{6}$/.test(code) || !setup}>
          Turn on two-factor
        </Submit>
        {onSkip ? (
          <button type="button" onClick={onSkip} className="si-btn si-btn-ghost w-full" disabled={busy}>
            Remind me next time
          </button>
        ) : null}
      </div>
    </CardShell>
  );
}

/** Accept an invitation (decided 2026-11-23): set your own password; two-factor comes next. */
export function InvitationCard({
  state,
  fullName,
  username,
  onSubmit,
  busy,
  error,
}: {
  state: "checking" | "valid" | "expired" | "invalid";
  fullName: string | null;
  username: string | null;
  onSubmit: (password: string) => void | Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  const cardRef = useCardRef();
  const id = useId();
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const mismatch = confirm.length > 0 && confirm !== next;
  const ready = next.length >= 10 && next === confirm;
  if (state === "expired" || state === "invalid")
    return (
      <CardShell
        ref={cardRef}
        title={state === "expired" ? "This invitation has expired" : "This invitation can't be used"}
        sub={state === "expired" ? "Invitations work for 72 hours. Ask your administrator to send a new one." : "It was already used or replaced by a newer one. Sign in, or ask for a new invitation."}
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="mt-5 flex flex-col gap-3">
          <BackLink />
        </div>
        <CardFoot />
      </CardShell>
    );
  const field = (key: string, label: string, value: string, set: (v: string) => void, hint?: string, invalid?: boolean) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={`${id}-${key}`} className={labelClass}>
        {label}
      </label>
      <div className="si-field pl-3.5 pr-1" data-invalid={invalid ? "true" : undefined}>
        <Lock aria-hidden="true" className="mr-3 size-[18px] shrink-0 text-[var(--si-fg-subtle)]" strokeWidth={1.75} />
        <input id={`${id}-${key}`} type={show ? "text" : "password"} autoComplete="new-password" value={value} onChange={(e) => set(e.target.value)} aria-invalid={invalid || undefined} required />
      </div>
      {hint ? <p className={cn("text-[12px]", invalid ? "text-[var(--si-danger)]" : "text-[var(--si-fg-subtle)]")}>{hint}</p> : null}
    </div>
  );
  return (
    <CardShell
      ref={cardRef}
      title={fullName ? `Welcome, ${fullName.split(" ")[0]}` : "Welcome"}
      sub={username ? `Set a password for ${username}. Next you'll set up two-factor authentication.` : "Checking your invitation…"}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!busy && ready) await onSubmit(next);
      }}
      busy={busy || state === "checking"}
    >
      <div className="mt-5 flex flex-col gap-4 short:mt-4 short:gap-3">
        {field("next", "Password", next, setNext, "At least 10 characters.", next.length > 0 && next.length < 10)}
        {field("confirm", "Confirm password", confirm, setConfirm, mismatch ? "The two passwords don't match." : undefined, mismatch)}
        <label className="flex items-center gap-2 text-[13px] text-[var(--si-fg-muted)]">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="size-4 accent-[var(--si-blue)]" />
          Show passwords
        </label>
        <ErrorLine error={error} />
        <Submit busy={busy} disabled={!ready || state !== "valid"}>
          Set password and continue
        </Submit>
      </div>
      <CardFoot />
    </CardShell>
  );
}
