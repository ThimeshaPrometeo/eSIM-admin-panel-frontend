"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SignInView } from "@/components/platform/sign-in-view";
import { usePlatform } from "@/contexts/platform-context";
import { authApi } from "@/lib/api/auth";
import { errorMessage } from "@/lib/api/errors";
import { nextPath, SIGN_IN_DATA } from "../../sign-in-client";

export function TwoFactorClient() {
  const { status, me, verifyMfa } = usePlatform();
  const router = useRouter();
  const params = useSearchParams();
  const next = nextPath(params.get("next"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "signed_in" && me) {
      router.replace(me.mustChangePassword ? "/login/change-password" : next);
      return;
    }
    // without a password step first there's nothing to verify
    if (status === "signed_out") void authApi.hasPendingMfa().then((pending) => !pending && router.replace("/"));
  }, [status, me, next, router]);

  return (
    <SignInView
      step="two-factor"
      countryCount={SIGN_IN_DATA.countryCount}
      events={SIGN_IN_DATA.events}
      systemStatus={SIGN_IN_DATA.systemStatus}
      busy={busy}
      error={error}
      onBack={() => router.replace(`/?next=${encodeURIComponent(next)}`)}
      onVerify={async ({ code, method }) => {
        setBusy(true);
        setError(null);
        try {
          const nextMe = await verifyMfa(code, method);
          router.replace(nextMe.mustChangePassword ? "/login/change-password" : next);
        } catch (e) {
          setError(errorMessage(e));
          setBusy(false);
        }
      }}
    />
  );
}
