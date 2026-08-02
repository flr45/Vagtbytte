"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_INTERVAL_MS = 3000;

export function AlarmFeedAutoRefresh({
  intervalMs = DEFAULT_INTERVAL_MS
}: {
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    const timer = window.setInterval(refreshWhenVisible, Math.max(intervalMs, 1000));
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [intervalMs, router]);

  return null;
}
