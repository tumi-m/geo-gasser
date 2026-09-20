export const AVATAR_IDS = ["grok", "atlas", "veld", "canal", "ember", "frost", "nova", "dune"] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];

export const AVATAR_META: Record<
  AvatarId,
  { label: string; skin: string; visor: string; mark: string }
> = {
  grok: { label: "Grok", skin: "#141416", visor: "#f4f4f0", mark: "#c45c2a" },
  atlas: { label: "Atlas", skin: "#1c1c22", visor: "#d5d8de", mark: "#3d8f6e" },
  veld: { label: "Veld", skin: "#1a2a22", visor: "#e6f0e8", mark: "#3d8f6e" },
  canal: { label: "Canal", skin: "#1a222c", visor: "#e4eaf2", mark: "#6a8caf" },
  ember: { label: "Ember", skin: "#2a1c16", visor: "#f3e6d8", mark: "#c45c2a" },
  frost: { label: "Frost", skin: "#222428", visor: "#f4f4f0", mark: "#9aa4b5" },
  nova: { label: "Nova", skin: "#1a1a1e", visor: "#f4f4f0", mark: "#d5d8de" },
  dune: { label: "Dune", skin: "#2a2418", visor: "#f0e6d0", mark: "#c4a574" },
};

export const DEFAULT_AVATAR: AvatarId = "atlas";
export const GROK_AVATAR: AvatarId = "grok";

export function isAvatarId(value: string | undefined): value is AvatarId {
  return !!value && (AVATAR_IDS as readonly string[]).includes(value);
}

export function sanitizeAvatar(value: string | undefined): AvatarId {
  return isAvatarId(value) ? value : DEFAULT_AVATAR;
}