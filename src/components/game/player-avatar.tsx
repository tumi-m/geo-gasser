import { AVATAR_META, sanitizeAvatar, type AvatarId } from "@/lib/game";
import { cn } from "@/lib/utils";

export function PlayerAvatar({
  id,
  size = 44,
  className,
  title,
}: {
  id?: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const avatar = sanitizeAvatar(id);
  const meta = AVATAR_META[avatar];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn("shrink-0 rounded-full", className)}
      aria-hidden={!title}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <rect width="64" height="64" rx="20" fill={meta.skin} />
      <AvatarFace id={avatar} visor={meta.visor} mark={meta.mark} />
    </svg>
  );
}

function AvatarFace({ id, visor, mark }: { id: AvatarId; visor: string; mark: string }) {
  if (id === "grok") {
    return (
      <>
        <rect x="16" y="24" width="32" height="14" rx="4" fill={visor} />
        <rect x="22" y="27" width="6" height="8" rx="1.5" fill={mark} />
        <rect x="36" y="27" width="6" height="8" rx="1.5" fill={mark} />
        <path d="M32 8.5 34.4 14.2 40.5 15.2 36 19.5 37.2 25.5 32 22.4 26.8 25.5 28 19.5 23.5 15.2 29.6 14.2Z" fill={mark} />
        <rect x="26" y="44" width="12" height="4" rx="2" fill={visor} opacity="0.35" />
      </>
    );
  }
  return (
    <>
      <rect x="18" y="25" width="12" height="8" rx="2" fill={visor} />
      <rect x="34" y="25" width="12" height="8" rx="2" fill={visor} />
      <circle cx="32" cy="14" r="3" fill={mark} />
      <path d="M24 44h16" stroke={visor} strokeWidth="3" strokeLinecap="round" opacity="0.5" />
    </>
  );
}

export function AvatarPicker({
  value,
  onChange,
}: {
  value: AvatarId;
  onChange: (id: AvatarId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="listbox" aria-label="Avatar">
      {(Object.keys(AVATAR_META) as AvatarId[]).map((id) => (
        <button
          key={id}
          type="button"
          role="option"
          aria-selected={value === id}
          aria-label={AVATAR_META[id].label}
          onClick={() => onChange(id)}
          className={cn(
            "rounded-full p-0.5 transition-[box-shadow,transform] duration-150",
            value === id ? "ring-2 ring-fg ring-offset-2 ring-offset-bg" : "opacity-70 hover:opacity-100",
          )}
        >
          <PlayerAvatar id={id} size={48} />
        </button>
      ))}
    </div>
  );
}