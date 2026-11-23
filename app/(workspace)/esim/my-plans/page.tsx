import type { Metadata } from "next";
import { MyPlansClient } from "./my-plans-client";

export const metadata: Metadata = { title: "My plans" };

export default function MyPlansPage() {
  return <MyPlansClient />;
}
