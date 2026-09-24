import { useEffect, useRef, useState } from "react";
import { useCountUp } from "./use-count-up";
import { cn } from "@/lib/utils";

/** A running total that rolls up to each new value and bumps as it lands. */
export function RollingScore({
  value,
  reducedMotion,
  className,
}: {
  value: number;
  reducedMotion?: boolean;
  className?: string;
}) {
  const reduced = Boolean(reducedMotion);
  const previous = useRef(value);
  const [from, setFrom] = useState(value);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (value === previous.current) return;
    setFrom(previous.current);
    previous.current = value;
    if (!reduced) setBump((n) => n + 1);
  }, [value, reduced]);
  const shown = useCountUp(value, 800, reduced, from);
  return (
    <span key={bump} className={cn(className, bump > 0 && "score-bump", "inline-block")}>
      {Math.round(shown).toLocaleString()}
    </span>
  );
}
