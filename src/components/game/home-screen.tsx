import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MusicHudButton } from "./music-player";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Compass,
  Globe2,
  MapPin,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsPanel } from "./settings-panel";
import { AtlasPicker } from "./atlas-picker";
import { ModalShell } from "./modal-shell";
import { Tutorial } from "./tutorial";
import {
  audio,
  DEFAULT_SETTINGS,
  DIFFICULTY_SECONDS,
  EMPTY_STATS,
  enabledLocations,
  loadSettings,
  loadStats,
  planMatch,
  saveSettings,
  sanitizeAtlas,
  type GameSettings,
} from "@/lib/game";
import { Input } from "@/components/ui/input";
import { sanitizeName } from "@/lib/multiplayer";
import { cn } from "@/lib/utils";
import { BrushUnderline, FlightPath, WordRise } from "@/components/motion/motion";
import { useRevealOnScroll } from "@/components/motion/use-reveal";

/** How long each featured destination holds before the hero moves on. */
const DESTINATION_MS = 7000;

export function HomeScreen() {
  const navigate = useNavigate();
  // Stored settings and stats are read after mount: the server renders the
  // defaults, and the first client render has to match it or React throws the
  // page away and rebuilds it.
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setSettings(loadSettings());
    setStats(loadStats());
    setLoaded(true);
  }, []);
  const [panel, setPanel] = useState<"settings" | "atlas" | "help" | "name" | null>(null);
  const [destination, setDestination] = useState(0);
  const destinations = [
    {
      src: "/locations/loc_78.jpg",
      name: "Wilderness",
      country: "South Africa",
      note: "Where the coastline keeps going.",
      source: "https://en.wikipedia.org/wiki/Wilderness,_South_Africa",
    },
    {
      src: "/locations/loc_118.jpg",
      name: "The Matterhorn",
      country: "Switzerland",
      note: "A different kind of high score.",
      source: "https://en.wikipedia.org/wiki/Matterhorn",
    },
    {
      src: "/locations/loc_105.jpg",
      name: "San Francisco",
      country: "United States",
      note: "Find the familiar. Discover the unexpected.",
      source: "https://en.wikipedia.org/wiki/Golden_Gate_Bridge",
    },
  ];
  const featured = destinations[destination];
  // The hero tours its destinations on its own until the player picks one;
  // it waits while they hover or tab through it, and stays put with reduced
  // motion. The active thumbnail shows how long until the next.
  const [touring, setTouring] = useState(true);
  const [held, setHeld] = useState(false);
  const autoplay = touring && !held && loaded && !settings.reducedMotion;
  useEffect(() => {
    if (!autoplay) return;
    const id = window.setTimeout(
      () => setDestination((d) => (d + 1) % destinations.length),
      DESTINATION_MS,
    );
    return () => window.clearTimeout(id);
  }, [autoplay, destination, destinations.length]);
  const homeRef = useRef<HTMLElement>(null);
  useRevealOnScroll(homeRef);
  const plan = planMatch(1, settings.matchLength, settings.atlas);
  useEffect(() => {
    if (!loaded) return; // never write the defaults over what is stored
    document.documentElement.classList.toggle("hc", settings.highContrast);
    document.documentElement.classList.toggle("reduce-motion", settings.reducedMotion);
    audio.setSettings(settings);
    saveSettings(settings);
  }, [settings, loaded]);
  const play = (to: "/play" | "/duel") => {
    audio.unlock();
    audio.play("click");
    // First solo game: ask what to call the player, so rounds and results say
    // their name rather than "Traveler". Asked once; skipping is fine.
    if (to === "/play" && !settings.namePrompted) {
      setPanel("name");
      return;
    }
    void navigate({ to });
  };
  const startWithName = (name: string | null) => {
    const next = {
      ...settings,
      namePrompted: true,
      ...(name?.trim() ? { displayName: sanitizeName(name) } : {}),
    };
    // Saved now, not in the effect: the match route reads settings on mount.
    saveSettings(next);
    setSettings(next);
    setPanel(null);
    void navigate({ to: "/play" });
  };
  const choose = (preset: "sa-nl" | "world" | "custom") => {
    if (preset === "custom") {
      setPanel("atlas");
      return;
    }
    setSettings((s) => ({ ...s, atlas: sanitizeAtlas({ preset }) }));
  };
  const cards = [
    {
      id: "sa-nl",
      name: "South Africa × Netherlands",
      subtitle: "THE ORIGINAL",
      src: "/locations/loc_78.jpg",
      icon: Compass,
    },
    {
      id: "world",
      name: "World tour",
      subtitle: "BEYOND THE FAMILIAR",
      src: "/locations/loc_118.jpg",
      icon: Globe2,
    },
    {
      id: "custom",
      name: "Your own adventure",
      subtitle: "COUNTRIES & CITIES",
      src: "/locations/loc_105.jpg",
      icon: SlidersHorizontal,
    },
  ] as const;
  return (
    <main ref={homeRef} className="expedition-home">
      <header className="expedition-nav">
        <a href="/" className="brand-lockup" aria-label="Atlas Duel home">
          <Compass size={32} strokeWidth={1.5} />
          <span>
            ATLAS<span className="text-accent">DUEL</span>
          </span>
        </a>
        <nav className="flex items-center gap-3 sm:gap-7" aria-label="Main navigation">
          <button className="nav-link" onClick={() => setPanel("help")}>
            How to play
          </button>
          <MusicHudButton />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Settings"
            onClick={() => setPanel("settings")}
          >
            <SettingsIcon size={20} />
          </Button>
        </nav>
      </header>
      <section
        className={cn("journey-hero", autoplay && "is-touring")}
        aria-label="Your next adventure"
        onPointerEnter={() => setHeld(true)}
        onPointerLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)}
        onBlur={() => setHeld(false)}
      >
        {/* All three stay mounted so the change is a crossfade, not a cut. */}
        {destinations.map((place, index) => (
          <img
            key={place.src}
            className={cn("journey-image", index === destination && "is-active")}
            src={place.src}
            alt={index === destination ? `${place.name}, ${place.country}` : ""}
            aria-hidden={index !== destination}
            fetchPriority={index === 0 ? "high" : "low"}
          />
        ))}
        <div className="journey-shade" />
        <FlightPath still={settings.reducedMotion} />
        <div className="journey-copy">
          <p className="eyebrow">
            <span className="status-dot" /> THE WORLD IS YOUR PLAYGROUND
          </p>
          <h1>
            <WordRise text="Go somewhere" delay={120} />
            <br />
            <span className="serif-word">
              <WordRise text="unexpected." delay={300} />
              <BrushUnderline delay={750} />
            </span>
          </h1>
          <p>
            A little instinct. A few clues.
            <br />A whole world to discover.
          </p>
          <div className="hero-actions">
            <Button size="lg" onClick={() => play("/play")}>
              Let’s explore <ArrowRight size={19} />
            </Button>
            <Button size="lg" variant="secondary" onClick={() => play("/duel")}>
              <Users size={17} /> Duel a friend
            </Button>
          </div>
          <button
            className="hero-setup"
            onClick={() => setPanel("settings")}
            aria-label="Change game setup"
          >
            <SlidersHorizontal size={14} />
            <span>{plan.totalQuestions} places</span>
            <i />
            <span>{DIFFICULTY_SECONDS[settings.difficulty]}s per guess</span>
            <ChevronDown size={13} />
          </button>
        </div>
        <div className="journey-destination">
          <p>
            <MapPin size={14} />
            {featured.country}
          </p>
          <h2 key={featured.name} className="journey-swap">
            {featured.name}
          </h2>
          <span key={featured.note} className="journey-swap is-late">
            {featured.note}
          </span>
          <div className="destination-switcher" aria-label="Featured destinations">
            {destinations.map((place, index) => (
              <button
                key={place.name}
                aria-label={`Preview ${place.name}`}
                aria-pressed={index === destination}
                onClick={() => {
                  setTouring(false);
                  setDestination(index);
                }}
              >
                <img src={place.src} alt="" />
                <span>{String(index + 1).padStart(2, "0")}</span>
                {index === destination && autoplay && (
                  <i
                    key={destination}
                    className="destination-progress"
                    style={{ animationDuration: `${DESTINATION_MS}ms` }}
                  />
                )}
              </button>
            ))}
          </div>
          <a href={featured.source} target="_blank" rel="noreferrer" className="journey-credit">
            Photo: Wikimedia contributors ↗
          </a>
        </div>
      </section>
      <section className="expedition-packs" aria-labelledby="atlas-title">
        <div className="section-heading" data-reveal>
          <h2 id="atlas-title">Choose your playground.</h2>
          <button className="nav-link" onClick={() => setPanel("atlas")}>
            Explore maps <ArrowRight size={15} />
          </button>
        </div>
        <div className="pack-grid">
          {cards.map((card, cardIndex) => {
            const selected =
              card.id === "custom"
                ? !["sa-nl", "world"].includes(settings.atlas.preset)
                : settings.atlas.preset === card.id;
            return (
              <button
                className={cn("pack-card", selected && "is-selected")}
                key={card.id}
                data-reveal
                style={{ "--i": cardIndex } as React.CSSProperties}
                aria-pressed={selected}
                onClick={() => choose(card.id)}
              >
                <img src={card.src} alt="" loading="lazy" />
                <div className="pack-shade" />
                <div className="pack-top">
                  <span>{card.subtitle}</span>
                  <span className="pack-check">
                    {selected ? <Check size={16} /> : <card.icon size={16} />}
                  </span>
                </div>
                <div className="pack-copy">
                  <h3>{card.name}</h3>
                  {selected && (
                    <span>
                      Selected
                      {settings.atlas.cities?.length
                        ? ` · ${settings.atlas.cities.length} cities`
                        : ""}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>
      <footer className="expedition-footer">
        <span>
          <Compass size={16} />
          {enabledLocations().length} places. Endless perspective.
        </span>
        {stats.matchesPlayed > 0 ? (
          <span>
            <Trophy size={15} className="text-accent" /> Personal best{" "}
            {stats.personalBest.toLocaleString()}
          </span>
        ) : (
          <span>No account. Just curiosity.</span>
        )}
      </footer>
      {panel === "atlas" && (
        <ModalShell titleId="atlas-title-modal" onClose={() => setPanel(null)} wide>
          <div className="flex justify-between items-center mb-6">
            <h2 id="atlas-title-modal" className="font-display text-2xl">
              Where to?
            </h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close maps"
              onClick={() => setPanel(null)}
            >
              <X size={20} />
            </Button>
          </div>
          <AtlasPicker
            value={settings.atlas}
            onChange={(atlas) => setSettings({ ...settings, atlas })}
          />
          <Button className="w-full mt-6" onClick={() => setPanel(null)}>
            Save map <Check size={18} />
          </Button>
        </ModalShell>
      )}
      {panel === "settings" && (
        <SettingsPanel settings={settings} onChange={setSettings} onClose={() => setPanel(null)} />
      )}
      {panel === "help" && <Tutorial onClose={() => setPanel(null)} />}
      {panel === "name" && (
        <ModalShell titleId="name-prompt-title" onClose={() => setPanel(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              startWithName(new FormData(e.currentTarget).get("name") as string);
            }}
          >
            <h2 id="name-prompt-title" className="font-display text-2xl">
              What should we call you?
            </h2>
            <p className="mt-2 text-sm text-muted">
              Your name goes on your pin, every round and the scoreboard.
            </p>
            <Input
              name="name"
              aria-label="Your name"
              placeholder="Traveler"
              maxLength={24}
              autoComplete="nickname"
              className="mt-5"
            />
            <div className="mt-5 flex gap-3">
              <Button type="submit" className="flex-1">
                Let’s go <ArrowRight size={17} />
              </Button>
              <Button type="button" variant="ghost" onClick={() => startWithName(null)}>
                Skip
              </Button>
            </div>
          </form>
        </ModalShell>
      )}
    </main>
  );
}
