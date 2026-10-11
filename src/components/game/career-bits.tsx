import { useEffect, useState } from "react";
import {
  Bot,
  CalendarCheck,
  CheckCheck,
  Crosshair,
  Eye,
  Flag,
  Flame,
  Globe2,
  Heart,
  House,
  Plane,
  Rocket,
  Shield,
  Sparkles,
  Stamp,
  Swords,
  Target,
  Trophy,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { audio, levelOf, titleFor, type CareerAward, type Medal, type MedalIcon } from "@/lib/game";
import { cn } from "@/lib/utils";
import { useCountUp } from "./use-count-up";

/** The career's pieces: the level badge, medal discs and the results card. */

const ICONS: Record<MedalIcon, LucideIcon> = {
  flag: Flag,
  crosshair: Crosshair,
  target: Target,
  check: CheckCheck,
  trophy: Trophy,
  zap: Zap,
  bot: Bot,
  globe: Globe2,
  swords: Swords,
  heart: Heart,
  shield: Shield,
  flame: Flame,
  rocket: Rocket,
  eye: Eye,
  home: House,
  waves: Waves,
  stamp: Stamp,
  plane: Plane,
  calendar: CalendarCheck,
};

/** The player's level in a small shield, for avatars and headings. */
export function LevelBadge({ level, className }: { level: number; className?: string }) {
  return (
    <span className={cn("level-badge", className)}>
      <span className="sr-only">Level </span>
      {level}
    </span>
  );
}

/** A medal: its icon on a disc, dimmed and outlined while still locked. */
export function MedalDisc({ medal, locked, size = 44 }: { medal: Medal; locked?: boolean; size?: number }) {
  const Icon = ICONS[medal.icon];
  return (
    <span
      className={cn("medal-disc", locked && "is-locked")}
      style={{ "--medal": `${size}px` } as React.CSSProperties}
      aria-hidden
    >
      <Icon size={Math.round(size * 0.45)} strokeWidth={2} />
    </span>
  );
}

/**
 * The results card: XP gained line by line, the bar filling from where the
 * player was to where they are, and a level-up moment when it crosses a line.
 */
export function CareerResult({ award, reducedMotion }: { award: CareerAward; reducedMotion?: boolean }) {
  const start = levelOf(award.before);
  const end = levelOf(award.after);
  const reduced = Boolean(reducedMotion);
  const [shownLevel, setShownLevel] = useState(reduced ? end.level : start.level);
  const [fill, setFill] = useState(reduced ? end.progress : start.progress);
  const [instant, setInstant] = useState(false);
  const [levelledUp, setLevelledUp] = useState(reduced && award.levelsUp > 0);
  useEffect(() => {
    if (reduced) {
      setShownLevel(end.level);
      setFill(end.progress);
      setLevelledUp(award.levelsUp > 0);
      return;
    }
    const timers: number[] = [];
    const at = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
    if (award.levelsUp > 0) {
      // Fill the old level to the brim, then start the new one from empty.
      at(900, () => setFill(1));
      at(1800, () => {
        setInstant(true);
        setShownLevel(end.level);
        setFill(0);
        setLevelledUp(true);
        audio.play("roundWin");
      });
      at(1860, () => {
        setInstant(false);
        setFill(end.progress);
      });
    } else {
      at(900, () => setFill(end.progress));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [reduced, award.levelsUp, end.level, end.progress]);
  const gained = useCountUp(award.gained, 1100, reduced, 0, 500);
  const shown = shownLevel === end.level ? end : start;
  return (
    <section className="career-result atlas-rise atlas-rise-2" aria-label="Experience">
      <div className="career-result-head">
        <LevelBadge level={shownLevel} className={cn(levelledUp && "is-up")} />
        <span className="min-w-0 flex-1">
          <span className="career-result-title">{titleFor(shownLevel)}</span>
          <span className="career-result-sub tabular">
            Level {shownLevel} · {shown.into.toLocaleString()} / {shown.need.toLocaleString()} XP
          </span>
        </span>
        <span className="career-result-gain tabular">+{Math.round(gained).toLocaleString()} XP</span>
      </div>
      <div
        className="xp-bar"
        role="progressbar"
        aria-label="Experience toward the next level"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(end.progress * 100)}
      >
        <i className={cn(instant && "is-instant")} style={{ transform: `scaleX(${fill})` }} />
      </div>
      <ul className="xp-lines">
        {award.xp.map((line) => (
          <li key={line.label}>
            {line.label} <b className="tabular">+{line.xp.toLocaleString()}</b>
          </li>
        ))}
      </ul>
      {levelledUp && (
        <p className="level-up" role="status">
          <Sparkles size={16} aria-hidden />
          <span>
            <strong>Level {end.level}</strong>
            {/* A new title is news; the same title is just the next step. */}
            {end.title !== start.title
              ? ` · you are now ${/^[AEIOU]/.test(end.title) ? "an" : "a"} ${end.title}`
              : " reached"}
          </span>
        </p>
      )}
    </section>
  );
}

/** Medals this match unlocked, each popping in after the one before. */
export function MedalsUnlocked({ medals }: { medals: Medal[] }) {
  if (!medals.length) return null;
  return (
    <section className="medals-new" aria-label="Medals unlocked">
      <p className="medals-new-kicker">
        {medals.length === 1 ? "Medal unlocked" : `${medals.length} medals unlocked`}
      </p>
      <ul>
        {medals.map((medal, i) => (
          <li key={medal.id} className="medal-new" style={{ "--i": i } as React.CSSProperties}>
            <MedalDisc medal={medal} size={40} />
            <span className="min-w-0">
              <strong>{medal.name}</strong>
              <small>{medal.hint}</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
