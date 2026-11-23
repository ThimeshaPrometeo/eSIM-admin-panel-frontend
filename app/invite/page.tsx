import type { Metadata } from "next";
import { Suspense } from "react";
import { InviteClient } from "./invite-client";

export const metadata: Metadata = { title: "Accept invitation" };

export default function InvitePage() {
  return (
    <Suspense>
      <InviteClient />
    </Suspense>
  );
}
