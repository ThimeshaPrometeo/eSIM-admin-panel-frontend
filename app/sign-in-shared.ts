import { demoSignInData } from "@/lib/demo/sign-in";
import { landingStep, nextPath, stepUrl } from "@/lib/platform/sign-in-flow";
import { skippedTwoFactor } from "@/lib/platform/two-factor";
import type { Me } from "@/lib/platform/types";

/** What every sign-in page shows around the card (country count, globe events, system status). */
export const SIGN_IN_DATA = demoSignInData();

export { nextPath };

/**
 * Where a signed-in user goes next: the forced password change, then the 2FA
 * set-up prompt for accounts without an authenticator app or passkey (unless
 * they chose "Remind me next time" in this session), then the workspace.
 */
export function landingPath(me: Me, next: string) {
  const step = landingStep(me, skippedTwoFactor(me.id));
  return step === "workspace" ? next : stepUrl(step, next);
}
