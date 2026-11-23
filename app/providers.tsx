"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { PlatformProvider } from "@/contexts/platform-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PlatformProvider>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </PlatformProvider>
  );
}
