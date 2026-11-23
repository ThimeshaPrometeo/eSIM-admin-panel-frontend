import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInClient } from "./sign-in-client";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <Suspense>
      <SignInClient />
    </Suspense>
  );
}
