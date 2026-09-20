import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CircleHelp, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Globe } from "./globe";
import { SettingsPanel } from "./settings-panel";
import { Tutorial } from "./tutorial";
import { audio, DIFFICULTY_SECONDS, formatDistance, loadSettings, loadStats, saveSettings, type GameSettings, type PlayerStats } from "@/lib/game";
import { cn } from "@/lib/utils";

const VIGNETTES = [
  "/generated/home-cape.jpg",
  "/generated/home-amsterdam.jpg",
  "/generated/home-johannesburg.jpg",
  "/generated/home-rotterdam.jpg",
];

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
  const [vignette, setVignette] = useState(0);
  const reduced = settings.reducedMotion;

  useEffect(() => {
    applyDocumentSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setVignette((v) => (v + 1) % VIGNETTES.length), 7000);
    return () => clearInterval(id);
  }, [reduced]);

  const play = (path: "/play" | "/duel") => {
    audio.unlock();
    audio.play("click");
    audio.startAmbience();
    void navigate({ to: path });
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-bg">
      <Globe reducedMotion={reduced} />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0.2)_0%,rgba(9,9,11,0.72)_55%,rgba(9,9,11,0.92)_100%)]" />
      {VIGNETTES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          className={cn(
            "pointer-events-none absolute inset-0 h-full w-full object-cover mix-blend-luminosity transition-opacity duration-700",
            i === vignette ? "opacity-25" : "opacity-0",
          )}
        />
      ))}
      <header className="relative z-10 flex items-center justify-between px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted">SA · NL · World</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" aria-label="How to play" onClick={() => setShowHelp(true)}>
            <CircleHelp className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Settings" onClick={() => setShowSettings(true)}>
            <SettingsIcon className="size-5" />
          </Button>
        </div>
      </header>
      <section className="relative z-10 mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-xl flex-col justify-end px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-10 sm:justify-center">
        <p className="atlas-rise text-xs uppercase tracking-[0.32em] text-muted">Competitive geography</p>
        <h1 className="atlas-rise atlas-rise-1 font-display mt-3 text-6xl leading-[0.9] tracking-[-0.04em] sm:text-8xl">
          ATLAS DUEL
        </h1>
        <p className="atlas-rise atlas-rise-2 mt-4 text-sm uppercase tracking-[0.22em] text-muted">
          South Africa · Netherlands · the world
        </p>
        <p className="atlas-rise atlas-rise-3 mt-5 max-w-md text-lg text-fg/90">Where in the world are you?</p>
        <div className="atlas-rise atlas-rise-4 mt-7 grid grid-cols-3 gap-2">
          {(
            [
              ["easy", "Easy", "60s"],
              ["medium", "Medium", "45s"],
              ["hard", "Hard", "30s"],
            ] as const
          ).map(([id, label, hint]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSettings({ ...settings, difficulty: id })}
              className={cn(
                "rounded-[var(--radius-md)] border px-3 py-2 text-left",
                settings.difficulty === id ? "border-accent bg-accent/15" : "border-border bg-bg/40",
              )}
            >
              <span className="block text-sm font-medium">{label}</span>
              <span className="text-[11px] text-muted">{hint}</span>
            </button>
          ))}
        </div>
        <div className="atlas-rise atlas-rise-4 mt-2 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setSettings({ ...settings, matchLength: "standard" })}
            className={cn(
              "rounded-[var(--radius-md)] border px-3 py-2 text-left",
              settings.matchLength === "standard" ? "border-accent bg-accent/15" : "border-border bg-bg/40",
            )}
          >
            <span className="block text-sm font-medium">Standard</span>
            <span className="text-[11px] text-muted">3 stills + 1 reconstruction</span>
          </button>
          <button
            type="button"
            onClick={() => setSettings({ ...settings, matchLength: "extended" })}
            className={cn(
              "rounded-[var(--radius-md)] border px-3 py-2 text-left",
              settings.matchLength === "extended" ? "border-accent bg-accent/15" : "border-border bg-bg/40",
            )}
          >
            <span className="block text-sm font-medium">Extended</span>
            <span className="text-[11px] text-muted">7 rounds · 70</span>
          </button>
          <button
            type="button"
            onClick={() => setSettings({ ...settings, matchLength: "full" })}
            className={cn(
              "rounded-[var(--radius-md)] border px-3 py-2 text-left",
              settings.matchLength === "full" ? "border-accent bg-accent/15" : "border-border bg-bg/40",
            )}
          >
            <span className="block text-sm font-medium">Full game</span>
            <span className="text-[11px] text-muted">10 rounds · 100</span>
          </button>
        </div>
        <div className="atlas-rise atlas-rise-4 mt-6 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" className="flex-1" onClick={() => play("/play")}>
            Play solo
          </Button>
          <Button size="lg" variant="secondary" className="flex-1" onClick={() => play("/duel")}>
            Two player duel
          </Button>
        </div>
        {stats.matchesPlayed > 0 ? (
          <dl className="mt-8 grid grid-cols-3 gap-3 text-sm">
            <Stat label="Best" value={stats.personalBest.toLocaleString()} />
            <Stat label="Played" value={String(stats.matchesPlayed)} />
            <Stat
              label="Closest"
              value={stats.closestKm != null ? formatDistance(stats.closestKm) : "—"}
            />
          </dl>
        ) : null}
        <p className="mt-6 text-sm text-subtle">
          15 South Africa · 15 Netherlands · 10 reconstructions · {DIFFICULTY_SECONDS[settings.difficulty]}s
        </p>
      </section>
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showHelp && <Tutorial onClose={() => setShowHelp(false)} />}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-bg/50 px-3 py-2.5">
      <dt className="text-[11px] uppercase tracking-wider text-subtle">{label}</dt>
      <dd className="font-display mt-1 text-xl tabular leading-none">{value}</dd>
    </div>
  );
}
