import type { Metadata } from "next";
import { Suspense } from "react";
import { TwoFactorClient } from "./two-factor-client";

export const metadata: Metadata = { title: "Two-factor authentication" };

export default function TwoFactorPage() {
  return (
    <Suspense>
      <TwoFactorClient />
    </Suspense>
  );
}
