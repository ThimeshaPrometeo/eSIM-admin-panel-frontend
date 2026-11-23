"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./primitives";
import { GlassCard } from "./glass-card";

/** Shown in place (URL unchanged) when the signed-in user may not open this page (spec 5.4). */
export function AccessDenied() {
  return (
    <GlassCard className="mx-auto mt-6 max-w-xl">
      <div className="flex flex-col items-center px-4 py-10 text-center">
        <span className="grid size-14 place-items-center rounded-full border border-border bg-surface-2 text-fg-2">
          <Lock className="size-6" strokeWidth={1.5} />
        </span>
        <h1 className="mt-5 text-section font-semibold">{"You don't have access to this page"}</h1>
        <p className="mt-1.5 max-w-sm text-body text-fg-2">{"Your account can't open this area. If you need it, ask your administrator to change your permissions."}</p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/esim/dashboard">Go to the dashboard</Link>
        </Button>
      </div>
    </GlassCard>
  );
}

/** Pages outside the demo scope (spec 15): a calm placeholder, never a half-built page. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-title font-semibold">{title}</h1>
      </header>
      <GlassCard>
        <EmptyState
          illustration="signal"
          title="Coming soon"
          description={`${title} isn't part of this demo yet. It arrives after the demo, on the same design.`}
          action={
            <Button asChild variant="secondary">
              <Link href="/esim/dashboard">Back to the dashboard</Link>
            </Button>
          }
        />
      </GlassCard>
    </div>
  );
}
