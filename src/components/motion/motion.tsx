import { Fragment } from "react";
import { cn } from "@/lib/utils";

/**
 * Small motion-graphics pieces shared across the journey. All animate
 * transform, opacity or SVG stroke only — never a filter on text (see the
 * 2026-09-23 results-screen blur fix) — and all settle to a static final
 * frame, so reduced motion simply shows the end state.
 */

/** Words that rise into place one after another, clipped by their line. */
export function WordRise({
  text,
  className,
  delay = 0,
  step = 70,
}: {
  text: string;
  className?: string;
  delay?: number;
  step?: number;
}) {
  return (
    <span className={cn("word-rise", className)}>
      {text.split(" ").map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          {i > 0 && " "}
          <span className="word-rise-clip">
            <span style={{ animationDelay: `${delay + i * step}ms` }}>{word}</span>
          </span>
        </Fragment>
      ))}
    </span>
  );
}

/** A hand-drawn accent stroke that draws itself under a word. */
export function BrushUnderline({ delay = 600 }: { delay?: number }) {
  return (
    <svg className="brush-underline" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden>
      <path
        d="M4 16 C 60 6, 120 20, 170 11 S 260 6, 296 13"
        style={{ animationDelay: `${delay}ms` }}
      />
    </svg>
  );
}

/**
 * A dashed flight path that draws itself across the hero, a pin that keeps
 * travelling it, and a pulsing marker where it lands.
 */
const ROUTES = {
  // Landscape hero: from the lower middle, over the photo, to the top-right.
  wide: {
    viewBox: "0 0 1000 600",
    d: "M 420 560 C 560 470, 610 250, 760 210 S 930 170, 960 96",
    land: [960, 96],
  },
  // Portrait hero (phones): through the open band above the destination name,
  // landing just over the thumbnails, clear of the headline and buttons.
  tall: {
    viewBox: "0 0 400 800",
    d: "M -10 610 C 70 560, 150 600, 220 590 S 320 560, 350 520",
    land: [350, 520],
  },
} as const;

export function FlightPath({ still }: { still?: boolean }) {
  return (
    <>
      <FlightRoute kind="wide" still={still} />
      <FlightRoute kind="tall" still={still} />
    </>
  );
}

function FlightRoute({ kind, still }: { kind: keyof typeof ROUTES; still?: boolean }) {
  const { viewBox, d, land } = ROUTES[kind];
  return (
    <svg
      className={cn("flight-path", `is-${kind}`)}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <path className="flight-path-glow" d={d} />
      <path className="flight-path-line" d={d} pathLength={1} />
      <g className="flight-path-land" transform={`translate(${land[0]} ${land[1]})`}>
        <circle className="flight-path-ring" r="16" />
        <circle className="flight-path-ring is-late" r="16" />
        <circle className="flight-path-dot" r="5" />
      </g>
      {/* SVG's own motion along a path: it works everywhere SVG does, where
          CSS offset-path on SVG elements does not. CSS reduced-motion rules
          cannot reach it, so it is left out when motion is reduced. */}
      {!still && (
        <g opacity="0">
          <circle r="7" className="flight-path-halo" />
          <circle r="3.6" className="flight-path-pin" />
          <animateMotion
            dur="7s"
            begin="1.4s"
            repeatCount="indefinite"
            path={d}
            keyPoints="0;1"
            keyTimes="0;1"
            calcMode="spline"
            keySplines=".45 0 .55 1"
          />
          <animate
            attributeName="opacity"
            dur="7s"
            begin="1.4s"
            repeatCount="indefinite"
            values="0;1;1;0"
            keyTimes="0;.08;.88;1"
          />
        </g>
      )}
    </svg>
  );
}
