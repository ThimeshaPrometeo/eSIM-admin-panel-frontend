"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SetupTwoFactorCard } from "@/components/platform/auth-cards";
import { SignInView } from "@/components/platform/sign-in-view";
import { usePlatform } from "@/contexts/platform-context";
import { useResource } from "@/hooks/use-resource";
import { accountsApi } from "@/lib/api/accounts";
import { errorMessage } from "@/lib/api/errors";
import { skipTwoFactor } from "@/lib/platform/two-factor";
import { nextPath, SIGN_IN_DATA } from "../../sign-in-client";

/**
 * The 2FA set-up prompt after signing in (spec 8.31, Q-ROUTE2FA): for every
 * account without an authenticator app or passkey. Skippable until go-live.
 */
export function SetupTwoFactorClient() {
  const { status, me, reloadMe } = usePlatform();
  const router = useRouter();
  const next = nextPath(useSearchParams().get("next"));
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signedIn = status === "signed_in";
  const setup = useResource(() => accountsApi.startTotpSetup(), ["totp-setup", me?.id], signedIn && !codes);

  useEffect(() => {
    if (status === "signed_out") router.replace("/");
  }, [status, router]);

  return (
    <SignInView
      countryCount={SIGN_IN_DATA.countryCount}
      events={SIGN_IN_DATA.events}
      systemStatus={SIGN_IN_DATA.systemStatus}
      tall
      card={
        <SetupTwoFactorCard
          setup={setup.data ?? null}
          codes={codes}
          username={me?.username ?? ""}
          busy={busy}
          error={error ?? (setup.error ? errorMessage(setup.error) : null)}
          onConfirm={async (code) => {
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
            router.replace(next);
          }}
          onSkip={() => {
            if (me) skipTwoFactor(me.id);
            router.replace(next);
          }}
        />
      }
    />
  );
}
