import type { Metadata } from "next";
import { Suspense } from "react";
import { SetupTwoFactorClient } from "./setup-two-factor-client";

export const metadata: Metadata = { title: "Set up two-factor authentication" };

export default function SetupTwoFactorPage() {
  return (
    <Suspense>
      <SetupTwoFactorClient />
    </Suspense>
  );
}
