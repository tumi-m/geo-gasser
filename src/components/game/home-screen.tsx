import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, CircleHelp, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Globe } from "./globe";
import { SettingsPanel } from "./settings-panel";
import { Tutorial } from "./tutorial";
import {
  atlasLabel,
  audio,
  DIFFICULTY_SECONDS,
  formatDistance,
  loadSettings,
  loadStats,
  MATCH_LENGTH,
  saveSettings,
  type GameSettings,
  type PlayerStats,
} from "@/lib/game";

function applyDocumentSettings(settings: GameSettings) {
  document.documentElement.classList.toggle("hc", settings.highContrast);
  audio.setSettings(settings);
  saveSettings(settings);
}

export function HomeScreen() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [stats] = useState<PlayerStats>(() => loadStats());
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const reduced = settings.reducedMotion;

  useEffect(() => {
    applyDocumentSettings(settings);
  }, [settings]);

  const play = (path: "/play" | "/duel") => {
    audio.unlock();
    audio.play("click");
    audio.startAmbience();
    void navigate({ to: path });
  };

  const rounds = MATCH_LENGTH[settings.matchLength].totalRounds;
  const seconds = DIFFICULTY_SECONDS[settings.difficulty];

  return (
    <main className="relative min-h-dvh overflow-hidden bg-bg">
      <Globe reducedMotion={reduced} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0.15)_0%,rgba(9,9,11,0.55)_48%,rgba(9,9,11,0.94)_100%)]" />
      <header className="relative z-10 flex items-center justify-end gap-1 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Button variant="ghost" size="icon" aria-label="How to play" onClick={() => setShowHelp(true)}>
          <CircleHelp className="size-5" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Settings" onClick={() => setShowSettings(true)}>
          <SettingsIcon className="size-5" />
        </Button>
      </header>
      <section className="relative z-10 mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-lg flex-col justify-end px-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:justify-center">
        <p className="atlas-rise text-xs uppercase tracking-[0.32em] text-muted">SA · NL · World</p>
        <h1 className="atlas-rise atlas-rise-1 font-display mt-3 text-6xl leading-[0.9] tracking-[-0.04em] text-balance sm:text-8xl">
          ATLAS DUEL
        </h1>
        <div className="atlas-rise atlas-rise-2 mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" className="flex-1" onClick={() => play("/play")}>
            Play solo
          </Button>
          <Button size="lg" variant="secondary" className="flex-1" onClick={() => play("/duel")}>
            Two player
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="atlas-rise atlas-rise-3 mt-5 flex min-h-11 w-full items-center justify-between gap-3 rounded-[var(--radius-md)] text-left text-sm text-muted"
        >
          <span className="min-w-0 truncate">
            {atlasLabel(settings.atlas)}
            <span className="text-subtle">
              {" "}
              · {seconds}s · {rounds} rounds
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-subtle" />
        </button>
        {stats.matchesPlayed > 0 ? (
          <p className="atlas-rise atlas-rise-4 mt-4 text-sm text-subtle">
            Best {stats.personalBest.toLocaleString()}
            {stats.closestKm != null ? ` · closest ${formatDistance(stats.closestKm)}` : ""}
          </p>
        ) : null}
      </section>
      {showSettings && (
        <SettingsPanel settings={settings} onChange={setSettings} onClose={() => setShowSettings(false)} />
      )}
      {showHelp && <Tutorial onClose={() => setShowHelp(false)} />}
    </main>
  );
}
