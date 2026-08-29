"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // PWA install/offline support is a progressive enhancement;
        // failing silently keeps the app usable without it.
      });
    }
  }, []);

  return null;
}
