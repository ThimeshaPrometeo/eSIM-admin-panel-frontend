import type { ReactNode } from "react";
import { Suspense } from "react";
import { SignInFlowClient } from "./sign-in-flow-client";

/**
 * Sign-in, the code step, the forced password change and the 2FA set-up
 * prompt share this layout: one card that turns between steps while the globe
 * and the background stay mounted. The pages only name the step (and the title).
 */
export default function SignInLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense>
        <SignInFlowClient />
      </Suspense>
      {children}
    </>
  );
}
