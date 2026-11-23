/**
 * Invitations (decided 2026-11-23): nobody chooses another person's password.
 * A new user gets a link, valid 72 hours, to set a password and then 2FA.
 * Sending again replaces the old link. Demo mode returns the link instead of
 * emailing it.
 */
import type { Invitation } from "@/lib/platform/types";
import type { DState, DUser } from "./model";

export const INVITE_HOURS = 72;

export function sendInvitation(s: DState, u: DUser, now = Date.now()): Invitation {
  const token = `inv-${u.id}-${++s.seq}-${(now % 100000).toString(36)}`;
  const sentAt = new Date(now).toISOString();
  const expiresAt = new Date(now + INVITE_HOURS * 3600000).toISOString();
  u.invitePending = true;
  u.mustChangePassword = false;
  s.invitations = [...s.invitations.filter((i) => i.userId !== u.id), { token, userId: u.id, sentAt, expiresAt }];
  return { sentTo: u.email, expiresAt, demoLink: `/invite?token=${encodeURIComponent(token)}` };
}

export function pendingInvitation(s: DState, userId: string) {
  return s.invitations.find((i) => i.userId === userId) ?? null;
}
