import { useEffect, useState } from "react";

/**
 * Counts from `from` to `target` over `ms` (ease-out), after `delay` ms.
 * Lands on the target at once when motion is reduced or the value is not finite.
 */
export function useCountUp(target: number, ms: number, reduced: boolean, from = 0, delay = 0) {
  const [value, setValue] = useState(reduced ? target : from);
  useEffect(() => {
    if (reduced || !Number.isFinite(target) || !Number.isFinite(from)) {
      setValue(target);
      return;
    }
    setValue(from);
    let raf = 0;
    const begin = performance.now() + delay;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - begin) / ms));
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduced, from, delay]);
  return value;
}
