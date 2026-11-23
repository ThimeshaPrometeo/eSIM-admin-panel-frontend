"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

/** Switches the page theme (dark default) and remembers it on this device. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.theme === "light" ? "light" : "dark"),
    () => "dark",
  );
  const next = theme === "dark" ? "light" : "dark";
  return (
    <Button
      variant="secondary"
      size="icon"
      aria-label={`Switch to ${next} theme`}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("esim-theme", next);
        } catch {
          /* private mode: theme still applies for this visit */
        }
      }}
    >
      {theme === "dark" ? <Sun strokeWidth={1.5} /> : <Moon strokeWidth={1.5} />}
    </Button>
  );
}
