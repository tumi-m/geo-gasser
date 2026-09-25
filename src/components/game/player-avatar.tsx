import { useEffect, useRef, useState } from "react";
import { Shuffle } from "lucide-react";
import {
  AVATAR_COLORS,
  AVATAR_COLOR_IDS,
  AVATAR_SHAPES,
  avatarIdFor,
  avatarLabel,
  avatarParts,
  avatarSeed,
  type AvatarColor,
  type AvatarId,
  type AvatarShape,
} from "@/lib/game";
import { cn } from "@/lib/utils";

/**
 * Player bots: a soft body, a colour and a face of two rounded strokes.
 *
 * Static by default (score rows, the HUD). `live` bots breathe, blink on their
 * own rhythm, glance around now and then, and pop into a new body with a happy
 * face when their look changes; `track` bots also watch the pointer; `mood`
 * sets the face (a winner is happy, a loser glum). All movement is CSS on SVG
 * groups, so reduced motion stills it, and every rhythm comes from a hash of
 * the id, so the server and the first client render agree.
 */

export type AvatarMood = "neutral" | "happy" | "sad" | "surprised" | "focus";

const C = 32;

function roundedPolygon(points: [number, number][], radius: number): string {
  const n = points.length;
  const at = (i: number) => points[(i + n) % n];
  let d = "";
  for (let i = 0; i < n; i++) {
    const [px, py] = at(i - 1);
    const [vx, vy] = at(i);
    const [nx, ny] = at(i + 1);
    const lenIn = Math.hypot(px - vx, py - vy);
    const lenOut = Math.hypot(nx - vx, ny - vy);
    const a = [vx + ((px - vx) * radius) / lenIn, vy + ((py - vy) * radius) / lenIn];
    const b = [vx + ((nx - vx) * radius) / lenOut, vy + ((ny - vy) * radius) / lenOut];
    d += `${i === 0 ? "M" : "L"}${a[0].toFixed(2)} ${a[1].toFixed(2)}Q${vx.toFixed(2)} ${vy.toFixed(2)} ${b[0].toFixed(2)} ${b[1].toFixed(2)}`;
  }
  return `${d}Z`;
}

const HEXAGON = roundedPolygon(
  Array.from({ length: 6 }, (_, i) => {
    const a = ((-90 + i * 60) * Math.PI) / 180;
    return [C + 28 * Math.cos(a), 33 + 28 * Math.sin(a)] as [number, number];
  }),
  8,
);

const BODY: Record<AvatarShape, string> = {
  circle: "M32 7a26 26 0 1 1 0 52a26 26 0 1 1 0-52Z",
  blob: "M33 8C49 8 58.5 19 57.6 34.5C56.8 48.6 46 57.5 31.4 57.3C16.4 57.1 6.8 47 7.2 32.6C7.6 18.6 17.8 8 33 8Z",
  square: "M23 8H41C51 8 56 13 56 23V41C56 51 51 56 41 56H23C13 56 8 51 8 41V23C8 13 13 8 23 8Z",
  pill: "M21 16H43C52 16 58 22.5 58 32S52 48 43 48H21C12 48 6 41.5 6 32S12 16 21 16Z",
  triangle:
    "M32 8C35 8 37.2 9.6 38.8 12.4L56.6 44.6C59 49 56 54.5 51 54.5H13C8 54.5 5 49 7.4 44.6L25.2 12.4C26.8 9.6 29 8 32 8Z",
  hexagon: HEXAGON,
  cloud:
    "M17.5 51C10.6 51 6 46 6.4 39.8C6.8 34.2 11 30.6 16.2 30.8C16.6 21.6 23.8 14.6 33 15C40.4 15.3 45.6 20.1 47.2 26.4C53.8 26.4 58.4 31.8 58 38.6C57.6 45.8 52.4 51 45.6 51Z",
  drop: "M32 6C32 6 52.5 26.5 52.5 40.2C52.5 51.6 43.4 58.5 32 58.5S11.5 51.6 11.5 40.2C11.5 26.5 32 6 32 6Z",
};

/** Where the face sits, and how big it is, on each body. */
const FACE: Record<AvatarShape, { y: number; gap: number; h: number }> = {
  circle: { y: 33, gap: 6.5, h: 12 },
  blob: { y: 33, gap: 6.5, h: 12 },
  square: { y: 32, gap: 6.5, h: 12 },
  pill: { y: 32, gap: 7, h: 10 },
  triangle: { y: 40, gap: 5.5, h: 9.5 },
  hexagon: { y: 34, gap: 6.5, h: 12 },
  cloud: { y: 38, gap: 6, h: 10.5 },
  drop: { y: 42, gap: 6, h: 11 },
};

const STAR = "M0 -5.5 1.6 -1.7 5.6 -1.4 2.5 1.1 3.4 5 0 2.9 -3.4 5 -2.5 1.1 -5.6 -1.4 -1.6 -1.7Z";

export function PlayerAvatar({
  id,
  size = 44,
  className,
  title,
  live = false,
  track = false,
  mood = "neutral",
}: {
  id?: string;
  size?: number;
  className?: string;
  title?: string;
  /** Breathes, blinks, glances, and pops with joy when its look changes. */
  live?: boolean;
  /** Eyes follow the pointer (the builder's preview). */
  track?: boolean;
  mood?: AvatarMood;
}) {
  const parts = avatarParts(id);
  const face = FACE[parts.shape];
  const seed = avatarSeed(`${id ?? ""}:${title ?? ""}`);
  const eyes = parts.grok ? "#f4f4f0" : "#151517";
  const rootRef = useRef<SVGSVGElement>(null);

  // A new look: pop into the new body and smile for a moment.
  const shownId = parts.grok ? "grok" : `${parts.shape}-${parts.color}`;
  const previous = useRef(shownId);
  const [pops, setPops] = useState(0);
  const [cheer, setCheer] = useState(false);
  useEffect(() => {
    if (previous.current === shownId) return;
    previous.current = shownId;
    if (!live) return;
    setPops((n) => n + 1);
    setCheer(true);
    const t = window.setTimeout(() => setCheer(false), 900);
    return () => window.clearTimeout(t);
  }, [shownId, live]);

  // Eyes follow the pointer, a few units at most.
  useEffect(() => {
    const svg = rootRef.current;
    if (!track || !svg) return;
    const onMove = (e: PointerEvent) => {
      const r = svg.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, d / 220);
      svg.style.setProperty("--lx", `${((dx / d) * 3.6 * reach).toFixed(2)}px`);
      svg.style.setProperty("--ly", `${((dy / d) * 2.6 * reach).toFixed(2)}px`);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [track]);

  const shownMood: AvatarMood = cheer ? "happy" : mood;
  const eyeW = 5.2;
  return (
    <svg
      ref={rootRef}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn(
        "avatar shrink-0 overflow-visible",
        live && "avatar-live",
        `mood-${shownMood}`,
        className,
      )}
      aria-hidden={!title}
      role={title ? "img" : undefined}
      aria-label={title}
      style={
        {
          "--blink-dur": `${(3.4 + seed * 3.2).toFixed(2)}s`,
          "--blink-delay": `${(-seed * 6).toFixed(2)}s`,
          "--glance-dur": `${(9 + seed * 7).toFixed(2)}s`,
          "--glance-delay": `${(-seed * 13).toFixed(2)}s`,
          "--breathe-dur": `${(3.2 + seed * 1.4).toFixed(2)}s`,
        } as React.CSSProperties
      }
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <radialGradient id="av-shine" cx="0.32" cy="0.22" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity="0.34" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="1" stopColor="#000" stopOpacity="0.16" />
        </radialGradient>
      </defs>
      <g key={pops} className={cn("av-pop", pops > 0 && "is-popping")}>
        <g className="av-body">
          <path d={BODY[parts.shape]} fill={parts.body} />
          <path d={BODY[parts.shape]} fill="url(#av-shine)" />
          {parts.grok && (
            <path d={STAR} transform={`translate(${C} ${face.y - 14})`} fill="#e0672b" />
          )}
          <g className="av-look">
            <g className="av-glance">
              <g className="av-blink">
                {[-1, 1].map((side) => (
                  <rect
                    key={side}
                    className={cn("av-eye", side < 0 ? "av-eye-l" : "av-eye-r")}
                    x={C + side * face.gap - eyeW / 2}
                    y={face.y - face.h / 2}
                    width={eyeW}
                    height={face.h}
                    rx={eyeW / 2}
                    fill={eyes}
                  />
                ))}
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

/** A body silhouette for the shape picker. */
function ShapeGlyph({ shape, fill }: { shape: AvatarShape; fill: string }) {
  return (
    <svg viewBox="0 0 64 64" width="26" height="26" aria-hidden>
      <path d={BODY[shape]} fill={fill} />
    </svg>
  );
}

/**
 * Build a bot: a row of bodies drawn in the current colour, a row of colours,
 * and a shuffle for the undecided. Pair it with a `live` PlayerAvatar preview.
 */
export function AvatarBuilder({
  value,
  onChange,
  className,
}: {
  value: AvatarId;
  onChange: (id: AvatarId) => void;
  className?: string;
}) {
  const parts = avatarParts(value);
  // Grok's own bot is not on offer; start players from its shape in grey.
  const color: AvatarColor = parts.color === "ink" ? "grey" : parts.color;
  const { shape } = parts;
  return (
    <div className={cn("avatar-builder", className)}>
      <div className="avatar-builder-row" role="radiogroup" aria-label="Bot shape">
        {AVATAR_SHAPES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={s === shape}
            aria-label={`${s} body`}
            className={cn("avatar-shape", s === shape && "is-on")}
            onClick={() => onChange(avatarIdFor(s, color))}
          >
            <ShapeGlyph shape={s} fill={AVATAR_COLORS[color]} />
          </button>
        ))}
      </div>
      <div className="avatar-builder-row" role="radiogroup" aria-label="Bot colour">
        {AVATAR_COLOR_IDS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === color}
            aria-label={c}
            className={cn("avatar-swatch", c === color && "is-on")}
            style={{ "--swatch": AVATAR_COLORS[c] } as React.CSSProperties}
            onClick={() => onChange(avatarIdFor(shape, c))}
          />
        ))}
      </div>
      <button
        type="button"
        className="avatar-shuffle"
        onClick={() => {
          let next: AvatarId = value;
          while (next === value) {
            const s = AVATAR_SHAPES[Math.floor(Math.random() * AVATAR_SHAPES.length)];
            const c = AVATAR_COLOR_IDS[Math.floor(Math.random() * AVATAR_COLOR_IDS.length)];
            next = avatarIdFor(s, c);
          }
          onChange(next);
        }}
      >
        <Shuffle size={14} /> Shuffle
      </button>
      <span className="sr-only" aria-live="polite">
        {avatarLabel(value)}
      </span>
    </div>
  );
}
