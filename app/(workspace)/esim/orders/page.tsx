import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersClient } from "./orders-client";

export const metadata: Metadata = { title: "Orders" };

export default function Page() {
  return (
    <Suspense>
      <OrdersClient />
    </Suspense>
  );
}
