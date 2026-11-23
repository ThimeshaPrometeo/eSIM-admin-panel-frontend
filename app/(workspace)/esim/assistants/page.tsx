import type { Metadata } from "next";
import { AssistantsClient } from "./assistants-client";

export const metadata: Metadata = { title: "Assistants" };

export default function AssistantsPage() {
  return <AssistantsClient />;
}
