import { UnknownPage } from "@/components/platform/unknown-page";

/** Workspace paths without a page: the shell shows "Coming soon" or access denied; anything else is not found. */
export default function WorkspaceFallback() {
  return <UnknownPage />;
}
