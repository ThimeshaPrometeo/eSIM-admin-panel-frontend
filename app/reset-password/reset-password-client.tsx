"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ResetPasswordCard } from "@/components/platform/auth-cards";
import { SignInView } from "@/components/platform/sign-in-view";
import { useResource } from "@/hooks/use-resource";
import { authApi } from "@/lib/api/auth";
import { errorMessage } from "@/lib/api/errors";
import { SIGN_IN_DATA } from "../sign-in-client";

/** Reset password from the emailed link (`?token=`). */
export function ResetPasswordClient() {
  const token = useSearchParams().get("token") ?? "";
  const check = useResource(() => authApi.checkResetToken(token), [token], !!token);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const state = done ? "done" : !token || check.error || check.data?.valid === false ? "invalid" : check.data ? "valid" : "checking";
  return (
    <SignInView
      countryCount={SIGN_IN_DATA.countryCount}
      events={SIGN_IN_DATA.events}
      systemStatus={SIGN_IN_DATA.systemStatus}
      card={
        <ResetPasswordCard
          state={state}
          busy={busy}
          error={error}
          onSubmit={async (password) => {
            setBusy(true);
            setError(null);
            try {
              await authApi.resetPassword({ token, newPassword: password });
              setDone(true);
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      }
    />
  );
}
