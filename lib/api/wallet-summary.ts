/** Wallet summary for the signed-in user (`GET /dashboard/wallets`): own wallet for resellers, house wallet for admins. */
import { DATA_MODE } from "./mode";
import { apiFetch } from "./client";
import { read } from "@/lib/demo/run";
import { caller } from "@/lib/demo/session";
import { walletOfReseller, walletSummary } from "@/lib/demo/derive";
import { can } from "@/lib/platform/permissions";
import type { WalletSummary } from "@/lib/platform/types";

const demo = () =>
  read((): WalletSummary | null => {
    const c = caller();
    if (c.resellerId) return can(c.me.permissions, "wallets") || can(c.me.permissions, "dashboard") ? walletSummary(c.s, walletOfReseller(c.s, c.resellerId)) : null;
    return c.me.role === "admin" ? walletSummary(c.s, walletOfReseller(c.s, null)) : null;
  });

const http = () => apiFetch<WalletSummary | null>("/dashboard/wallets");

export const getWalletSummary: () => Promise<WalletSummary | null> = DATA_MODE === "api" ? http : demo;
