"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("Service worker registration failed:", err);
      });
    }
  }, []);

  return <SessionProvider refetchOnWindowFocus={false}>{children}</SessionProvider>;
}
