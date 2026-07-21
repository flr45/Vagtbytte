"use client";

import { useEffect } from "react";

export function SessionRefresher() {
  useEffect(() => {
    void fetch("/api/session/refresh", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store"
    });
  }, []);

  return null;
}
