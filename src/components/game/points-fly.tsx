import { useLayoutEffect, useRef, useState } from "react";

/**
 * The round's points fly from the reveal card up into the header score,
 * along a curve (the x and y legs ease differently), and the score rolls
 * over as they land. Without both ends on screen, or with reduced motion,
 * it lands at once.
 */
export function PointsFly({
  points,
  reduced,
  onDone,
}: {
  points: number;
  reduced: boolean;
  onDone: () => void;
}) {
  const [path, setPath] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const done = useRef(onDone);
  done.current = onDone;
  useLayoutEffect(() => {
    const from = document.querySelector("[data-round-points]")?.getBoundingClientRect();
    const to = document.querySelector("[data-score-target]")?.getBoundingClientRect();
    if (reduced || !from || !to || points <= 0) {
      done.current();
      return;
    }
    const x = from.left + from.width / 2;
    const y = from.top + from.height / 2;
    setPath({ x, y, dx: to.left + to.width / 2 - x, dy: to.top + to.height / 2 - y });
  }, [reduced, points]);
  if (!path) return null;
  return (
    <span
      className="points-fly"
      aria-hidden
      style={
        {
          left: path.x,
          top: path.y,
          "--dx": `${path.dx}px`,
          "--dy": `${path.dy}px`,
        } as React.CSSProperties
      }
      onAnimationEnd={(e) => {
        if (e.animationName === "points-fly-y") done.current();
      }}
    >
      <span className="points-fly-y">+{points.toLocaleString()}</span>
    </span>
  );
}
