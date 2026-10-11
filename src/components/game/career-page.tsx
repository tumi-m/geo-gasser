import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useNavigate } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { MusicHudButton } from "@/components/game/music-player";
import { PlayerAvatar } from "@/components/game/player-avatar";
import { LevelBadge, MedalDisc } from "@/components/game/career-bits";
import {
  DEFAULT_SETTINGS,
  EMPTY_STATS,
  formatDistance,
  levelOf,
  loadSettings,
  loadStats,
  MATCH_LENGTH_NAME,
  MEDALS,
  nationLabel,
  sanitizeAvatar,
  xpForLevel,
  type MatchLengthId,
} from "@/lib/game";
import { sanitizeName } from "@/lib/multiplayer";
import { cn } from "@/lib/utils";
import { useMono } from "@/lib/theme";

const LENGTHS: MatchLengthId[] = ["escape", "quick", "standard", "extended", "full"];

/** Your career: level, records, medals and the countries you have seen. */
export function CareerPage() {
  const mono = useMono();
  const navigate = useNavigate();
  // Stored stats and settings are read after mount, like the home page.
  const [stats, setStats] = useState(EMPTY_STATS);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  useEffect(() => {
    setStats(loadStats());
    setSettings(loadSettings());
  }, []);

  const xp = stats.xp ?? 0;
  const level = levelOf(xp);
  const medals = stats.medals ?? {};
  const earned = MEDALS.filter((m) => medals[m.id]).length;
  const nations = stats.nations ?? [];
  const guesses = stats.zaGuesses + stats.nlGuesses + (stats.worldGuesses ?? 0);
  const hits = stats.zaCountryHits + stats.nlCountryHits + (stats.worldCountryHits ?? 0);
  const records: { label: string; value: string }[] = [
    { label: "Matches", value: (stats.matchesPlayed + (stats.streakRuns ?? 0)).toLocaleString() },
    { label: "Duels won", value: stats.matchesWon.toLocaleString() },
    ...LENGTHS.filter((id) => (stats.bests?.[id] ?? 0) > 0).map((id) => ({
      label: `Best ${MATCH_LENGTH_NAME[id]}`,
      value: (stats.bests?.[id] ?? 0).toLocaleString(),
    })),
    { label: "Best streak", value: stats.bestCountryStreak ? `${stats.bestCountryStreak} in a row` : "—" },
    { label: "Closest guess", value: stats.closestKm != null ? formatDistance(stats.closestKm) : "—" },
    {
      label: "Fastest within 5 km",
      value: stats.fastestAccurateMs != null ? `${(stats.fastestAccurateMs / 1000).toFixed(1)}s` : "—",
    },
    { label: "Right country", value: guesses ? `${Math.round((hits / guesses) * 100)}%` : "—" },
    { label: "Countries seen", value: nations.length.toLocaleString() },
  ];
  const name = sanitizeName(settings.displayName);

  return (
    <main className="career-page relative min-h-dvh overflow-hidden">
      <div className="relative z-10 mx-auto max-w-2xl px-5 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <div className="atlas-rise flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate("/")}>
            <ArrowLeft className="size-4" aria-hidden />
            Home
          </Button>
          <div className="-my-2">
            <MusicHudButton />
          </div>
        </div>

        <section className="career-hero atlas-rise atlas-rise-1 mt-4" aria-labelledby="career-name">
          <div className="career-hero-avatar">
            <PlayerAvatar id={sanitizeAvatar(settings.avatarId)} size={72} live track />
            <LevelBadge level={level.level} className="career-hero-badge" />
          </div>
          <div className="min-w-0 flex-1">
            <p className={mono ? "eyebrow" : "text-xs uppercase tracking-[0.28em] text-muted"}>Career</p>
            <h1 id="career-name" className="mt-1 truncate font-display text-4xl leading-none tracking-tight sm:text-5xl">
              {name}
            </h1>
            <p className="career-hero-title">
              {level.title} · Level {level.level}
            </p>
          </div>
        </section>

        <div className="atlas-rise atlas-rise-2 mt-5">
          <div
            className="xp-bar"
            role="progressbar"
            aria-label={`Experience toward level ${level.level + 1}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(level.progress * 100)}
          >
            <i className="career-xp-fill" style={{ transform: `scaleX(${level.progress})` }} />
          </div>
          <p className="mt-2 flex justify-between gap-3 text-xs text-muted tabular">
            <span>
              {level.into.toLocaleString()} / {level.need.toLocaleString()} XP to level {level.level + 1}
            </span>
            <span>{xp.toLocaleString()} XP in all</span>
          </p>
          {xp === 0 && (
            <p className="mt-3 text-sm text-muted">
              Every match earns experience: places played, points scored, duels won. Level 2 takes{" "}
              {xpForLevel(2).toLocaleString()} XP.
            </p>
          )}
        </div>

        <section className="mt-8 atlas-rise atlas-rise-3" aria-labelledby="career-records">
          <h2 id="career-records" className="career-heading">
            Records
          </h2>
          <dl className="career-records">
            {records.map((r) => (
              <div key={r.label}>
                <dt>{r.label}</dt>
                <dd className="tabular">{r.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-8 atlas-rise atlas-rise-4" aria-labelledby="career-medals">
          <h2 id="career-medals" className="career-heading">
            Medals{" "}
            <span className="career-count tabular">
              {earned} / {MEDALS.length}
            </span>
          </h2>
          <ul className="career-medals">
            {MEDALS.map((medal) => {
              const when = medals[medal.id];
              return (
                <li key={medal.id} className={cn(!when && "is-locked")}>
                  <MedalDisc medal={medal} locked={!when} size={40} />
                  <span className="min-w-0">
                    <strong>{medal.name}</strong>
                    <small>{medal.hint}</small>
                    {when ? (
                      <small className="career-medal-when">
                        Earned{" "}
                        {new Date(when).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </small>
                    ) : (
                      <span className="sr-only">Not earned yet</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-8 atlas-rise atlas-rise-4" aria-labelledby="career-countries">
          <h2 id="career-countries" className="career-heading">
            Countries seen <span className="career-count tabular">{nations.length}</span>
          </h2>
          {nations.length ? (
            <ul className="career-nations">
              {nations.map((code) => (
                <li key={code}>
                  <b>{code}</b>
                  {nationLabel(code)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">Every place you play adds its country here.</p>
          )}
        </section>

        <Button className="mt-10 w-full sm:w-auto" onClick={() => navigate("/play")}>
          Play a match <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </main>
  );
}
