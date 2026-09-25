import { useState } from "react";
import {
  Check,
  Compass,
  Headphones,
  Image,
  LogOut,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { atlasLabel, planMatch, sanitizeAvatar, type GameSettings } from "@/lib/game";
import { useMusic } from "@/lib/music/use-music";
import { AtlasPicker } from "./atlas-picker";
import { MusicSettingsSection } from "./music-player";
import { AvatarBuilder, PlayerAvatar } from "./player-avatar";
import { cn } from "@/lib/utils";
import { ModalShell } from "./modal-shell";

const tabs = [
  { id: "game", label: "Game", icon: Compass },
  { id: "picture", label: "Picture", icon: Image },
  { id: "sound", label: "Sound", icon: Headphones },
  { id: "profile", label: "You", icon: UserRound },
] as const;
type TabId = (typeof tabs)[number]["id"];

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
  const [tab, setTab] = useState<TabId>(onQuit ? "picture" : "game");
  const music = useMusic();
  const update = (patch: Partial<GameSettings>) => onChange({ ...settings, ...patch });
  const plan = planMatch(1, settings.matchLength, settings.atlas);
  const slider = (key: "master" | "music" | "sfx", label: string, hint: string) => (
    <label className={cn("settings-volume", settings.muted && "opacity-45")}>
      <span>
        <strong>{label}</strong>
        <output>{Math.round(settings[key] * 100)}%</output>
      </span>
      <small>{hint}</small>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={settings[key]}
        disabled={settings.muted}
        onChange={(e) => update({ [key]: Number(e.target.value) })}
        aria-label={label}
        aria-valuetext={`${Math.round(settings[key] * 100)} percent`}
      />
    </label>
  );
  return (
    <ModalShell titleId="settings-title" onClose={onClose} className="settings-shell">
      <header className="settings-header">
        <div>
          <p className="eyebrow">
            <SlidersHorizontal size={13} /> YOUR WAY TO PLAY
          </p>
          <h2 id="settings-title">Make it your world.</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close settings">
          <X size={20} />
        </Button>
      </header>
      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {tabs.map((item, index) => (
          <button
            key={item.id}
            id={`settings-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`settings-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            onKeyDown={(e) => {
              const next =
                e.key === "ArrowRight"
                  ? (index + 1) % tabs.length
                  : e.key === "ArrowLeft"
                    ? (index + tabs.length - 1) % tabs.length
                    : e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? tabs.length - 1
                        : -1;
              if (next < 0) return;
              e.preventDefault();
              setTab(tabs[next].id);
              document.getElementById(`settings-tab-${tabs[next].id}`)?.focus();
            }}
          >
            <item.icon size={17} />
            {item.label}
          </button>
        ))}
      </div>
      <div
        key={tab}
        role="tabpanel"
        id={`settings-panel-${tab}`}
        aria-labelledby={`settings-tab-${tab}`}
        tabIndex={0}
        className="settings-content"
      >
        {tab === "game" && (
          <>
            {onQuit && (
              <p className="settings-notice">
                Changes here apply to your next match. This match keeps running.
              </p>
            )}
            <Section title="Set your pace" hint="Time to look around, then trust your instinct.">
              <div className="settings-choices three">
                {(
                  [
                    ["easy", "Wander", "60 seconds"],
                    ["medium", "Explore", "45 seconds"],
                    ["hard", "Sprint", "30 seconds"],
                  ] as const
                ).map(([id, label, hint]) => (
                  <Choice
                    key={id}
                    label={label}
                    hint={hint}
                    active={settings.difficulty === id}
                    onClick={() => update({ difficulty: id })}
                  />
                ))}
              </div>
            </Section>
            <Section
              title="How far will you go?"
              hint={`${plan.totalQuestions} unique places in your selected map.`}
            >
              <div className="settings-choices lengths">
                {(
                  [
                    ["escape", "Escape", "5 places"],
                    ["quick", "Quick", "10 places"],
                    ["standard", "Classic", "Up to 40"],
                    ["extended", "Voyage", "Up to 70"],
                    ["full", "Odyssey", "Up to 100"],
                  ] as const
                ).map(([id, label, hint]) => (
                  <Choice
                    key={id}
                    label={label}
                    hint={hint}
                    active={settings.matchLength === id}
                    onClick={() => update({ matchLength: id })}
                  />
                ))}
              </div>
              {settings.matchLength === "escape" &&
                settings.atlas.preset === "sa-nl" &&
                !settings.atlas.cities?.length && (
                  <p className="settings-footnote">Your fifth stop is a world wildcard.</p>
                )}
            </Section>
            <Section title="Choose your map">
              <AtlasPicker value={settings.atlas} onChange={(atlas) => update({ atlas })} />
            </Section>
          </>
        )}
        {tab === "picture" && (
          <>
            <Section title="Take in the view" hint="Choose how still photographs fit your screen.">
              <div className="settings-choices two">
                <Choice
                  label="Cinematic"
                  hint="Fill the frame · some cropping"
                  active={settings.photoFit === "cover"}
                  onClick={() => update({ photoFit: "cover" })}
                />
                <Choice
                  label="Full photograph"
                  hint="Every detail · no cropping"
                  active={settings.photoFit === "contain"}
                  onClick={() => update({ photoFit: "contain" })}
                />
              </div>
            </Section>
            <div className="settings-switches">
              <Toggle
                label="Show control hints"
                hint="A little guidance while you explore."
                checked={settings.showHints}
                onChange={(showHints) => update({ showHints })}
              />
              <Toggle
                label="Reduce motion"
                hint="Calmer transitions and no camera shake."
                checked={settings.reducedMotion}
                onChange={(reducedMotion) =>
                  update({
                    reducedMotion,
                    cameraShake: reducedMotion ? false : settings.cameraShake,
                  })
                }
              />
              <Toggle
                label="Camera shake"
                hint="A small kick when your result lands."
                checked={settings.cameraShake && !settings.reducedMotion}
                disabled={settings.reducedMotion}
                onChange={(cameraShake) => update({ cameraShake })}
              />
              <Toggle
                label="High contrast"
                hint="Stronger text and interface boundaries."
                checked={settings.highContrast}
                onChange={(highContrast) => update({ highContrast })}
              />
            </div>
            <p className="settings-footnote">
              Use Explore view during a round to hide the map. The timer keeps running.
            </p>
          </>
        )}
        {tab === "sound" && (
          <>
            <div className="settings-switches">
              <Toggle
                label="Sound on"
                hint="Set the mood for your next adventure."
                checked={!settings.muted}
                onChange={(value) => update({ muted: !value })}
              />
            </div>
            {slider("master", "Overall volume", "The volume of everything you hear.")}
            {slider("music", "Atmosphere", "Ambient sound while you explore.")}
            {slider("sfx", "Game sounds", "Pins, countdowns and celebrations.")}
            <div className="settings-switches">
              <MusicSettingsSection
                onOpenPlayer={() => {
                  onClose();
                  music.setOpen(true);
                }}
              />
            </div>
          </>
        )}
        {tab === "profile" && (
          <>
            <Section title="What should we call you?">
              <label className="sr-only" htmlFor="traveler-name">
                Display name
              </label>
              <Input
                id="traveler-name"
                value={settings.displayName}
                maxLength={24}
                autoComplete="nickname"
                onChange={(e) => update({ displayName: e.target.value })}
              />
            </Section>
            <Section title="Build your bot">
              <div className="flex flex-col items-center gap-4">
                <PlayerAvatar
                  id={settings.avatarId}
                  size={88}
                  title={settings.displayName}
                  live
                  track
                />
                <AvatarBuilder
                  value={sanitizeAvatar(settings.avatarId)}
                  onChange={(avatarId) => update({ avatarId })}
                />
              </div>
            </Section>
            {onQuit && (
              <p className="settings-footnote">Your name and avatar update in your next room.</p>
            )}
          </>
        )}
      </div>
      <footer className="settings-footer">
        <span>
          <Check size={14} />
          <span>
            Saved automatically<small>{atlasLabel(settings.atlas)}</small>
          </span>
        </span>
        <div>
          {onQuit && (
            <Button variant="ghost" aria-label="Quit match" onClick={onQuit}>
              <LogOut size={16} />
              <span className="hidden sm:inline">Leave</span>
            </Button>
          )}
          <Button onClick={onClose}>{onQuit ? "Back to game" : "Done"}</Button>
        </div>
      </footer>
    </ModalShell>
  );
}
function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="settings-section">
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      <div>{children}</div>
    </section>
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
      aria-pressed={active}
      onClick={onClick}
      className={cn("settings-choice", active && "selected")}
    >
      <span>
        {label}
        {active && <Check size={14} />}
      </span>
      <small>{hint}</small>
    </button>
  );
}
function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn("settings-toggle", disabled && "opacity-45")}>
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("settings-switch", checked && "on")}
      >
        <span />
      </button>
    </div>
  );
}
