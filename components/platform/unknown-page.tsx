import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GlassCard } from "./glass-card";
import { EmptyState } from "./primitives";

export function UnknownPage() {
  return (
    <GlassCard className="mx-auto mt-6 max-w-xl">
      <EmptyState
        illustration="globe"
        title="Page not found"
        description="This address doesn't lead anywhere in the workspace."
        action={
          <Button asChild variant="secondary">
            <Link href="/esim/dashboard">Go to the dashboard</Link>
          </Button>
        }
      />
    </GlassCard>
  );
}
