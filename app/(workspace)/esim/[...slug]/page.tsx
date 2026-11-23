import { UnknownPage } from "@/components/platform/unknown-page";

/** Workspace paths without a page: the shell shows access denied where it applies; anything else is not found. */
export default function WorkspaceFallback() {
  return <UnknownPage />;
}
