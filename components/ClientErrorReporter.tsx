"use client";

import { useEffect } from "react";
import { clientLog } from "@/lib/client-logger";

export function ClientErrorReporter() {
  useEffect(() => {
    const describe = (reason: unknown): Record<string, unknown> => {
      if (reason instanceof Error) {
        return { name: reason.name, message: reason.message, stack: reason.stack };
      }
      if (typeof reason === "string" || typeof reason === "number" || typeof reason === "boolean") {
        return { value: String(reason) };
      }
      if (reason && typeof reason === "object") {
        // Error-like duck type (e.g., thrown Response, custom class): pick common fields.
        const r = reason as Record<string, unknown>;
        return {
          name: typeof r.name === "string" ? r.name : undefined,
          message: typeof r.message === "string" ? r.message : undefined,
          status: typeof r.status === "number" ? r.status : undefined,
          url: typeof r.url === "string" ? r.url : undefined,
          // Last-ditch: dump a truncated JSON so we see SOMETHING.
          dump: (() => {
            try { return JSON.stringify(reason).slice(0, 500); } catch { return Object.prototype.toString.call(reason); }
          })(),
        };
      }
      return { value: String(reason) };
    };

    const onReject = (e: PromiseRejectionEvent) => {
      clientLog("error", "unhandledrejection", { location: location.pathname, ...describe(e.reason) });
    };
    const onError = (e: ErrorEvent) => {
      clientLog("error", "window.error", {
        location: location.pathname,
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        ...(e.error ? describe(e.error) : {}),
      });
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
