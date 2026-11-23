"use client";

import { useState } from "react";
import { ForgotPasswordCard } from "@/components/platform/auth-cards";
import { SignInView } from "@/components/platform/sign-in-view";
import { authApi } from "@/lib/api/auth";
import { errorMessage } from "@/lib/api/errors";
import { SIGN_IN_DATA } from "../sign-in-client";

/** Forgot password (spec 8.31). */
export function ForgotPasswordClient() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ demoLink: string | null } | null>(null);
  return (
    <SignInView
      countryCount={SIGN_IN_DATA.countryCount}
      events={SIGN_IN_DATA.events}
      systemStatus={SIGN_IN_DATA.systemStatus}
      card={
        <ForgotPasswordCard
          busy={busy}
          error={error}
          sent={sent}
          onSubmit={async (identifier) => {
            setBusy(true);
            setError(null);
            try {
              const r = await authApi.forgotPassword({ identifier });
              setSent({ demoLink: r.demoLink });
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
