import { useEffect, useRef, useState } from "react";

const T_IN = 150;
/** How long the fade-out runs before the splash unmounts. */
const SPLASH_FADE = 260;
/** Keys pressed this soon after the splash appears were meant for the game. */
const KEY_GRACE = 350;

export type SplashStage = "in" | "count" | "crown" | "leave";

/**
 * Drives a splash through in → count → crown → leave, then calls onDone.
 * Reduced motion keeps the same beats — the CSS swaps movement for
 * cross-fades — so the result still arrives as a moment, not a still frame.
 * Tap or a deliberate key press skips.
 */
export function useSplashTimeline(
  crownAt: number,
  leaveAt: number,
  onCrown: () => void,
  onDone: () => void,
): SplashStage {
  const [stage, setStage] = useState<SplashStage>("in");
  const crownRef = useRef(onCrown);
  crownRef.current = onCrown;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const born = performance.now();
    const at = (ms: number, fn: () => void) => window.setTimeout(fn, ms);
    const timers = [
      at(T_IN, () => setStage("count")),
      at(crownAt, () => {
        setStage("crown");
        crownRef.current();
      }),
      at(leaveAt, () => setStage("leave")),
      at(leaveAt + SPLASH_FADE, () => doneRef.current()),
    ];
    // A key skips, but never reaches the game (Enter would also continue).
    // Held keys and presses in the first moment were aimed at the lock.
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.repeat || performance.now() - born < KEY_GRACE) return;
      doneRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("keydown", onKey, true);
    };
  }, [crownAt, leaveAt]);
  return stage;
}
