import { apiFetch } from "./client";
import { ApiError } from "./errors";
import type { AuthApi } from "./auth";
import type { Me } from "@/lib/platform/types";

export const httpAuth: AuthApi = {
  login: (input) => apiFetch("/auth/login", { method: "POST", body: input }).then((r) => {
    const res = r as { mfaRequired?: boolean; methods?: ("totp" | "recovery")[] } & Partial<Me>;
    return res.mfaRequired ? { mfaRequired: true as const, methods: res.methods ?? ["totp", "recovery"] } : { mfaRequired: false as const, me: res as Me };
  }),
  verifyMfa: (input) => apiFetch<Me>("/auth/mfa/verify", { method: "POST", body: { code: input.code } }),
  hasPendingMfa: async () => true,
  // WebAuthn ceremony (passkeys/login/options → navigator.credentials.get → passkeys/login) comes with the profile work.
  passkeyLogin: async () => {
    throw new ApiError(501, "PASSKEY_UNAVAILABLE", "Passkeys aren't available yet. Sign in with your username and password.");
  },
  getMe: () => apiFetch<Me>("/auth/me"),
  logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
  changePassword: (input) => apiFetch<void>("/auth/change-password", { method: "POST", body: input }).then(() => apiFetch<Me>("/auth/me")),
  forgotPassword: (input) => apiFetch<void>("/auth/forgot-password", { method: "POST", body: input }).then(() => ({ sent: true as const, demoLink: null })),
  checkResetToken: (token) => apiFetch<{ valid: boolean }>("/auth/reset-password/check", { query: { token } }),
  resetPassword: (input) => apiFetch<void>("/auth/reset-password", { method: "POST", body: input }),
  checkInvitation: (token) => apiFetch<{ state: "valid" | "expired" | "invalid"; fullName: string | null; username: string | null }>("/auth/invitations/check", { query: { token } }),
  acceptInvitation: (input) => apiFetch<Me>("/auth/invitations/accept", { method: "POST", body: input }),
  switchDemoRole: async () => {
    throw new ApiError(400, "DEMO_ONLY");
  },
  resetDemo: async () => {
    throw new ApiError(400, "DEMO_ONLY");
  },
};
