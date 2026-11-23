"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SignInView } from "@/components/platform/sign-in-view";
import { usePlatform } from "@/contexts/platform-context";
import { errorMessage } from "@/lib/api/errors";
import { demoSignInData } from "@/lib/demo/sign-in";
import { skippedTwoFactor } from "@/lib/platform/two-factor";
import type { Me } from "@/lib/platform/types";

export const SIGN_IN_DATA = demoSignInData();

/** Where to go after signing in: the ?next= path when it is one of ours, else the dashboard. */
export function nextPath(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/login") ? raw : "/esim/dashboard";
}

/**
 * Where a signed-in user goes next: the forced password change, then the 2FA
 * set-up prompt for accounts without an authenticator app or passkey (unless
 * they chose "Remind me next time" in this session), then the workspace.
 */
export function landingPath(me: Me, next: string) {
  const q = `?next=${encodeURIComponent(next)}`;
  if (me.mustChangePassword) return `/login/change-password${q}`;
  if (!me.mfaEnrolled && !me.hasPasskey && !skippedTwoFactor(me.id)) return `/login/setup-2fa${q}`;
  return next;
}

export function SignInClient() {
  const { status, me, signIn, signInWithPasskey } = usePlatform();
  const router = useRouter();
  const params = useSearchParams();
  const next = nextPath(params.get("next"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // already signed in: straight to the workspace
  useEffect(() => {
    if (status === "signed_in" && me) router.replace(landingPath(me, next));
  }, [status, me, next, router]);

  return (
    <SignInView
      countryCount={SIGN_IN_DATA.countryCount}
      events={SIGN_IN_DATA.events}
      systemStatus={SIGN_IN_DATA.systemStatus}
      busy={busy}
      error={error}
      onSubmit={async ({ username, password }) => {
        setBusy(true);
        setError(null);
        try {
          const r = await signIn(username, password);
          if (r.mfaRequired) router.push(`/login/2fa?next=${encodeURIComponent(next)}`);
          else router.replace(landingPath(r.me, next));
        } catch (e) {
          setError(errorMessage(e));
          setBusy(false);
        }
      }}
      onPasskey={async () => {
        setBusy(true);
        try {
          const nextMe = await signInWithPasskey();
          toast.success("Signed in with a passkey");
          router.replace(landingPath(nextMe, next));
        } catch (e) {
          toast.error(errorMessage(e));
          setBusy(false);
        }
      }}
    />
  );
}
