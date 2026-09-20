import { LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AvatarId, GameSettings, MatchLengthId, TimeDifficulty } from "@/lib/game";
import { sanitizeAvatar } from "@/lib/game";
import { AtlasPicker } from "./atlas-picker";
import { AvatarPicker } from "./player-avatar";
import { cn } from "@/lib/utils";
import { ModalShell } from "./modal-shell";

export function SettingsPanel({
  settings,
  onChange,
  onClose,
  onQuit,
}: {
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onClose: () => void;
  onQuit?: () => void;
}) {
  const slider = (key: "master" | "music" | "sfx", label: string) => (
    <label className="flex flex-col gap-2 text-sm text-muted">
      {label}
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={settings[key]}
        onChange={(e) => onChange({ ...settings, [key]: Number(e.target.value) })}
        className="w-full"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(settings[key] * 100)}
      />
    </label>
  );

  return (
    <ModalShell titleId="settings-title" onClose={onClose}>
      <div className="mb-5 flex items-center justify-between">
        <h2 id="settings-title" className="font-display text-2xl">
          Settings
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close settings">
          <X className="size-5" />
        </Button>
      </div>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 text-sm text-muted">
          Atlas
          <AtlasPicker value={settings.atlas} onChange={(atlas) => onChange({ ...settings, atlas })} />
        </div>
        <div className="flex flex-col gap-2 text-sm text-muted">
          Timer
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["easy", "Easy", "60s"],
                ["medium", "Medium", "45s"],
                ["hard", "Hard", "30s"],
              ] as const
            ).map(([id, label, hint]) => (
              <Choice
                key={id}
                label={label}
                hint={hint}
                active={settings.difficulty === id}
                onClick={() => onChange({ ...settings, difficulty: id as TimeDifficulty })}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm text-muted">
          Match length
          <div className="grid grid-cols-2 gap-2">
            <Choice label="Quick escape" hint="5 places · world finale*" active={settings.matchLength === "quick"} onClick={() => onChange({...settings,matchLength:"quick"})}/>
            <Choice
              label="Standard"
              hint="4 rounds · 40"
              active={settings.matchLength === "standard"}
              onClick={() => onChange({ ...settings, matchLength: "standard" as MatchLengthId })}
            />
            <Choice
              label="Extended"
              hint="7 rounds · 70"
              active={settings.matchLength === "extended"}
              onClick={() => onChange({ ...settings, matchLength: "extended" as MatchLengthId })}
            />
            <Choice
              label="Full game"
              hint="10 rounds · 100"
              active={settings.matchLength === "full"}
              onClick={() => onChange({ ...settings, matchLength: "full" as MatchLengthId })}
            />
          </div>
          <p className="text-xs text-subtle">*SA × NL quick games finish with a world wildcard. Smaller maps use all available places.</p>
          {onQuit ? <p className="text-xs text-subtle">Timer and length apply on the next match.</p> : null}
        </div>
        <label className="flex flex-col gap-2 text-sm text-muted">
          Display name
          <Input
            value={settings.displayName}
            maxLength={24}
            autoComplete="nickname"
            onChange={(e) => onChange({ ...settings, displayName: e.target.value })}
          />
        </label>
        <div className="flex flex-col gap-2 text-sm text-muted">
          Avatar
          <AvatarPicker
            value={sanitizeAvatar(settings.avatarId)}
            onChange={(avatarId: AvatarId) => onChange({ ...settings, avatarId })}
          />
        </div>
        {slider("master", "Master")}
        {slider("music", "Music")}
        {slider("sfx", "Effects")}
        <Toggle
          label="Mute"
          checked={settings.muted}
          onChange={(muted) => onChange({ ...settings, muted })}
        />
        <Toggle
          label="Reduce motion"
          checked={settings.reducedMotion}
          onChange={(reducedMotion) =>
            onChange({
              ...settings,
              reducedMotion,
              cameraShake: reducedMotion ? false : settings.cameraShake,
            })
          }
        />
        <Toggle
          label="Camera shake"
          checked={settings.cameraShake && !settings.reducedMotion}
          disabled={settings.reducedMotion}
          onChange={(cameraShake) => onChange({ ...settings, cameraShake })}
        />
        <Toggle
          label="High contrast"
          checked={settings.highContrast}
          onChange={(highContrast) => onChange({ ...settings, highContrast })}
        />
        {onQuit && (
          <Button variant="secondary" className="mt-2 w-full" onClick={onQuit}>
            <LogOut className="size-4" />
            Quit match
          </Button>
        )}
      </div>
    </ModalShell>
  );
}

function Choice({
  label,
  hint,
  active,
  onClick,
}: {
  label: string;
  hint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-[var(--radius-md)] border px-3 py-2 text-left transition-colors",
        active ? "border-accent bg-accent/15 text-fg" : "border-border bg-bg-subtle text-muted",
      )}
    >
      <span className="block text-sm font-medium text-fg">{label}</span>
      <span className="mt-0.5 block text-[11px] text-muted">{hint}</span>
    </button>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 rounded-full border transition-[background-color,border-color] duration-150",
          checked ? "border-accent bg-accent" : "border-border bg-bg-subtle",
          disabled && "opacity-40",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-6 rounded-full transition-transform duration-150",
            checked ? "translate-x-5 bg-accent-fg" : "bg-fg",
          )}
        />
      </button>
    </div>
  );
}
