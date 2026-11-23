"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SignInView } from "@/components/platform/sign-in-view";
import { usePlatform } from "@/contexts/platform-context";
import { errorMessage } from "@/lib/api/errors";
import { SIGN_IN_DATA } from "../../sign-in-client";

/** Forced password change on first sign-in (spec 8.31). */
export function ChangePasswordClient() {
  const { status, me, changePassword } = usePlatform();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "signed_out") router.replace("/");
    else if (status === "signed_in" && me && !me.mustChangePassword && !busy) router.replace("/esim/dashboard");
  }, [status, me, busy, router]);

  return (
    <SignInView
      step="change-password"
      countryCount={SIGN_IN_DATA.countryCount}
      events={SIGN_IN_DATA.events}
      systemStatus={SIGN_IN_DATA.systemStatus}
      busy={busy}
      error={error}
      onChangePassword={async ({ currentPassword, newPassword }) => {
        setBusy(true);
        setError(null);
        try {
          await changePassword(currentPassword, newPassword);
          toast.success("Password changed");
          router.replace("/esim/dashboard");
        } catch (e) {
          setError(errorMessage(e));
          setBusy(false);
        }
      }}
    />
  );
}
