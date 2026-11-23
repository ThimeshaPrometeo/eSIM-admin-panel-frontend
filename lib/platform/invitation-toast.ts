"use client";

import { toast } from "sonner";
import { formatDateTime } from "./dates";
import type { Invitation } from "./types";

/** "Invitation sent" (decided 2026-11-23). Demo mode adds "Open invitation", since no email is sent. */
export function invitationToast(inv: Invitation, title = `Invitation sent to ${inv.sentTo}`) {
  toast.success(title, {
    description: `They set a password, then two-factor. The link works until ${formatDateTime(inv.expiresAt)}.`,
    duration: 12000,
    action: inv.demoLink ? { label: "Open invitation", onClick: () => window.location.assign(inv.demoLink!) } : undefined,
  });
}
