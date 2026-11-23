"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { InvitationCard } from "@/components/platform/auth-cards";
import { SignInView } from "@/components/platform/sign-in-view";
import { usePlatform } from "@/contexts/platform-context";
import { useResource } from "@/hooks/use-resource";
import { authApi } from "@/lib/api/auth";
import { errorMessage } from "@/lib/api/errors";
import { landingPath, SIGN_IN_DATA } from "../sign-in-client";

/** Accept an invitation (`?token=`): set a password, then the 2FA set-up (8.24, 8.31). */
export function InviteClient() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const { reloadMe } = usePlatform();
  const check = useResource(() => authApi.checkInvitation(token), [token], !!token);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = !token || check.error ? "invalid" : (check.data?.state ?? "checking");
  return (
    <SignInView
      countryCount={SIGN_IN_DATA.countryCount}
      events={SIGN_IN_DATA.events}
      systemStatus={SIGN_IN_DATA.systemStatus}
      card={
        <InvitationCard
          state={state}
          fullName={check.data?.fullName ?? null}
          username={check.data?.username ?? null}
          busy={busy}
          error={error}
          onSubmit={async (password) => {
            setBusy(true);
            setError(null);
            try {
              await authApi.acceptInvitation({ token, newPassword: password });
              const me = await reloadMe();
              // straight on to two-factor (not skippable after an invitation)
              router.replace(!me ? "/" : me.mfaEnrolled || me.hasPasskey ? landingPath(me, "/esim/dashboard") : "/login/setup-2fa?invite=1");
            } catch (e) {
              setError(errorMessage(e));
              setBusy(false);
            }
          }}
        />
      }
    />
  );
}
