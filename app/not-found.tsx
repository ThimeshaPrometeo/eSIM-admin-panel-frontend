import Link from "next/link";
import { EmptyState } from "@/components/platform/primitives";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <EmptyState
        illustration="globe"
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={<Link href="/" className="text-primary underline-offset-4 hover:underline">Go to the start page</Link>}
      />
    </main>
  );
}
