"use client";

import { useEffect } from "react";
import { clientLog } from "@/lib/client-logger";

export function ClientErrorReporter() {
  useEffect(() => {
    const onReject = (e: PromiseRejectionEvent) => {
      clientLog("error", "unhandledrejection", {
        reason: typeof e.reason === "object" ? JSON.stringify(e.reason) : String(e.reason)
      });
    };
    const onError = (e: ErrorEvent) => {
      clientLog("error", "window.error", { message: e.message, filename: e.filename, lineno: e.lineno });
    };
    window.addEventListener("unhandledrejection", onReject);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onReject);
      window.removeEventListener("error", onError);
    };
  }, []);
  return null;
}
