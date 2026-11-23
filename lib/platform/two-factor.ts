/** Helpers for authenticator set-up and recovery codes (spec 8.30, 8.31). */

/** "ABCD EFGH IJKL …" for typing the secret by hand. */
export function groupSecret(secret: string) {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

/** Recovery codes as a text file; nothing leaves the browser. */
export function downloadRecoveryCodes(codes: string[], username: string) {
  const text = [`Recovery codes for ${username}`, "Each code works once. Keep them somewhere safe.", "", ...codes, ""].join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `recovery-codes-${username}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/** "Remind me next time" for the 2FA prompt lasts for this browser session. */
const SKIP_KEY = "esim-2fa-skip";
export function skippedTwoFactor(userId: string) {
  try {
    return sessionStorage.getItem(SKIP_KEY) === userId;
  } catch {
    return false;
  }
}
export function skipTwoFactor(userId: string) {
  try {
    sessionStorage.setItem(SKIP_KEY, userId);
  } catch {
    /* storage blocked: the prompt shows again next time */
  }
}
