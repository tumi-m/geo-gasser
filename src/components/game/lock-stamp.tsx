import { useEffect, useState } from "react";

/**
 * The moment a guess is locked while the other player is still thinking: a
 * check draws itself inside a ring that pulses once, "Locked in" stamps down,
 * and the whole thing clears off the photo after a beat.
 */
export function LockStamp() {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setGone(true), 1300);
    return () => window.clearTimeout(id);
  }, []);
  if (gone) return null;
  return (
    <div className="lock-stamp" role="status" aria-live="polite">
      <svg viewBox="0 0 64 64" aria-hidden>
        <circle className="lock-stamp-ring" cx="32" cy="32" r="28" pathLength={1} />
        <path className="lock-stamp-check" d="M20 33 L28.5 41.5 L45 24" pathLength={1} />
      </svg>
      <p>Locked in</p>
    </div>
  );
}
