// Player bots: a body shape, a colour and a two-stroke face. An avatar id is
// "shape-color" (e.g. "hexagon-blue"), or "grok" for Grok's own bot. Ids travel
// over the wire as plain strings (≤24 chars), so every reader sanitises them.

export const AVATAR_SHAPES = [
  "circle",
  "blob",
  "square",
  "pill",
  "triangle",
  "hexagon",
  "cloud",
  "drop",
] as const;
export type AvatarShape = (typeof AVATAR_SHAPES)[number];

/** Vivid bodies for a dark UI; lime is the game's own accent. */
export const AVATAR_COLORS = {
  lime: "#c9ec52",
  white: "#f1f0ea",
  brown: "#9c5b2e",
  red: "#f0303f",
  orange: "#f5620f",
  amber: "#f6a312",
  green: "#23c45e",
  teal: "#16b3a2",
  blue: "#2170ff",
  purple: "#9a5cf6",
  pink: "#f03a90",
  grey: "#7b7b80",
} as const;
export type AvatarColor = keyof typeof AVATAR_COLORS;
export const AVATAR_COLOR_IDS = Object.keys(AVATAR_COLORS) as AvatarColor[];

export type AvatarId = `${AvatarShape}-${AvatarColor}` | "grok";

export const GROK_AVATAR: AvatarId = "grok";
export const DEFAULT_AVATAR: AvatarId = "blob-lime";

/** The first-generation avatar ids, so stored settings and old peers still render. */
const LEGACY: Record<string, AvatarId> = {
  atlas: "circle-teal",
  veld: "blob-green",
  canal: "square-blue",
  ember: "hexagon-orange",
  frost: "pill-white",
  nova: "cloud-purple",
  dune: "drop-amber",
};

export function isAvatarId(value: string | undefined): value is AvatarId {
  if (!value) return false;
  if (value === "grok") return true;
  const [shape, color, extra] = value.split("-");
  return (
    extra === undefined &&
    (AVATAR_SHAPES as readonly string[]).includes(shape) &&
    Object.prototype.hasOwnProperty.call(AVATAR_COLORS, color)
  );
}

export function sanitizeAvatar(value: string | undefined): AvatarId {
  if (isAvatarId(value)) return value;
  return (value && LEGACY[value]) || DEFAULT_AVATAR;
}

export interface AvatarParts {
  shape: AvatarShape;
  color: AvatarColor | "ink";
  body: string;
  grok: boolean;
}

/** What an id draws. Grok is an ink hexagon with white eyes and its star. */
export function avatarParts(id: string | undefined): AvatarParts {
  const avatar = sanitizeAvatar(id);
  if (avatar === "grok") return { shape: "hexagon", color: "ink", body: "#1d1d21", grok: true };
  const [shape, color] = avatar.split("-") as [AvatarShape, AvatarColor];
  return { shape, color, body: AVATAR_COLORS[color], grok: false };
}

export function avatarIdFor(shape: AvatarShape, color: AvatarColor): AvatarId {
  return `${shape}-${color}`;
}

export function avatarLabel(id: string | undefined): string {
  const { shape, color, grok } = avatarParts(id);
  return grok ? "Grok" : `${color} ${shape} bot`;
}

/** A small stable hash, so each bot blinks on its own rhythm (and SSR agrees). */
export function avatarSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}
