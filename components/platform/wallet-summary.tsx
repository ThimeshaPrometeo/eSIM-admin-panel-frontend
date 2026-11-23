"use client";

import { Info } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { formatMoney, toNumber } from "@/lib/platform/money";
import type { Wallet } from "@/lib/platform/types";
import { cn } from "@/lib/utils";
import { CountUp } from "./motion/count-up";
import { GlassCard } from "./glass-card";

/** Balance, held, available, outstanding (spec 8.19); available is the number that matters. */
export function WalletSummary({ wallet, className }: { wallet: Wallet; className?: string }) {
  const outstanding = toNumber(wallet.outstanding);
  const items: { label: string; value: string; hint: string; strong?: boolean; tone?: string }[] = [
    { label: "Available", value: wallet.available, hint: "What new plans can use now: balance minus what's held.", strong: true, tone: wallet.lowBalance ? "text-warning" : undefined },
    { label: "Balance", value: wallet.balance, hint: "Money in the wallet: top-ups minus usage charged so far." },
    { label: "Held for running plans", value: wallet.reserved, hint: "Reserved for running plans: each plan's maximum cost minus what it has used." },
    { label: "Outstanding", value: wallet.outstanding, hint: "Usage the wallet couldn't cover. The next top-up pays it first.", tone: outstanding > 0 ? "text-danger" : undefined },
  ];
  return (
    <GlassCard className={cn("grid grid-cols-2 gap-6 lg:grid-cols-4", className)}>
      {items.map((it) => (
        <div key={it.label} className="flex min-w-0 flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-small text-fg-2">
            {it.label}
            <Tooltip content={it.hint}>
              <button className="text-fg-3 hover:text-fg" aria-label={`About ${it.label}`}>
                <Info className="size-3.5" strokeWidth={1.5} />
              </button>
            </Tooltip>
          </span>
          <CountUp value={toNumber(it.value)} format={(n) => formatMoney(n)} className={cn("whitespace-nowrap font-semibold tracking-[-0.02em] tabular", it.strong ? "text-[30px] leading-9 sm:text-display" : "text-[22px] leading-8", it.tone)} />
        </div>
      ))}
      {wallet.waitingPlans ? (
        <p className="col-span-2 text-small text-fg-2 lg:col-span-4">
          {wallet.waitingPlans} plan{wallet.waitingPlans > 1 ? "s are" : " is"} waiting for {formatMoney(wallet.waitingAmount)} of funds. They&apos;re funded oldest first; a plan that doesn&apos;t fit is skipped for the next one that does.
        </p>
      ) : null}
    </GlassCard>
  );
}
