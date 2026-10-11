import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The system, in plain sight: the build this is, the day it was built, and
 * the visitor's own time zone. "BUILD 3213A89 · 2026-10-10 · AFRICA/JOHANNESBURG
 * UTC+02:00". The zone is read after mount, on the visitor's clock.
 */
export function SystemMeta({ className }: { className?: string }) {
  const [zone, setZone] = useState<string | null>(null);
  useEffect(() => {
    const name = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const minutes = -new Date().getTimezoneOffset();
    const sign = minutes < 0 ? "−" : "+";
    const abs = Math.abs(minutes);
    const offset = `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
    setZone(name === "UTC" ? `UTC${offset}` : `${name} UTC${offset}`);
  }, []);
  return (
    <p className={cn("system-meta", className)}>
      <span>Build {__BUILD_SHA__}</span>
      <span>{__BUILD_DATE__}</span>
      {zone && <span>{zone}</span>}
    </p>
  );
}
