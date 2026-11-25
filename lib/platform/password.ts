/**
 * Password rules and a strength estimate for the new-password fields (spec
 * 8.31). Only the length is enforced (the backend answers PASSWORD_TOO_SHORT);
 * the other rules are hints that raise the strength.
 */

export const MIN_PASSWORD_LENGTH = 10;

export type PasswordRule = { key: string; label: string; met: boolean; required: boolean };

export function passwordRules(pw: string): PasswordRule[] {
  return [
    { key: "length", label: `At least ${MIN_PASSWORD_LENGTH} characters`, met: pw.length >= MIN_PASSWORD_LENGTH, required: true },
    { key: "case", label: "Upper and lower case letters", met: /[a-z]/.test(pw) && /[A-Z]/.test(pw), required: false },
    { key: "number", label: "A number", met: /\d/.test(pw), required: false },
    { key: "symbol", label: "A symbol", met: /[^A-Za-z0-9]/.test(pw), required: false },
  ];
}

export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: "" | "Weak" | "Fair" | "Good" | "Strong" };

/** 0 when empty; Weak until the length rule is met; then one step per extra rule (and for 16+ characters). */
export function passwordStrength(pw: string): Strength {
  if (!pw) return { score: 0, label: "" };
  if (pw.length < MIN_PASSWORD_LENGTH) return { score: 1, label: "Weak" };
  const extras = passwordRules(pw).filter((r) => !r.required && r.met).length + (pw.length >= 16 ? 1 : 0);
  if (extras >= 3) return { score: 4, label: "Strong" };
  if (extras >= 2) return { score: 3, label: "Good" };
  return { score: 2, label: "Fair" };
}
