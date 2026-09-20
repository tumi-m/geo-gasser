import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CircleHelp, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Globe } from "./globe";
import { SettingsPanel } from "./settings-panel";
import { Tutorial } from "./tutorial";
import { audio, formatDistance, loadSettings, loadStats, saveSettings, type GameSettings, type PlayerStats } from "@/lib/game";
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
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted">SA × NL</p>
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
          South Africa × Netherlands
        </p>
        <p className="atlas-rise atlas-rise-3 mt-5 max-w-md text-lg text-fg/90">Where in the world are you?</p>
        <div className="atlas-rise atlas-rise-4 mt-8 flex flex-col gap-3 sm:flex-row">
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
        ) : (
          <p className="mt-6 text-sm text-subtle">30 curated launch locations · 4 rounds · 45 seconds each</p>
        )}
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
