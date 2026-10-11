import { useState } from "react";
import { ArrowLeft, ArrowRight, Flag, Flame, Hand, Heart, Lock, MapPin, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "./modal-shell";
import { useCountUp } from "./use-count-up";
import { cn } from "@/lib/utils";

/**
 * How to play: five short steps, each with a small looping animation, and
 * the rules in full underneath for anyone who wants them.
 */

const STEPS = [
  {
    title: "Look around",
    body: "Each round shows you a place. Drag to look, zoom for clues, and walk where Street View covers it. Signs, roads, plants and light all help.",
  },
  {
    title: "Drop a pin",
    body: "Tap the map where you think it is. Jump with SA, NL or World, or search a city by name.",
  },
  {
    title: "Lock it in",
    body: "Lock your guess before the clock runs out: an unlocked pin scores nothing. Enter locks too.",
  },
  {
    title: "Up to 5,000 a round",
    body: "The closer your pin, the more you score. The points on offer step down as the clock runs, so a quick, close guess pays best.",
  },
  {
    title: "Three ways to win",
    body: "Race for points, wear a rival down in a health duel, or see how many countries you can name in a row. Every match earns XP and medals.",
  },
] as const;

const RULES: { title: string; body: string }[] = [
  {
    title: "Maps",
    body: "Pick a map before you play: South Africa × Netherlands, either one, the world, a mix, or your own list of countries and cities. On SA × NL, the last place of an Escape is a world wildcard.",
  },
  {
    title: "Scoring",
    body: "Up to 5,000 a place, falling off with distance; a pin within 25 m is perfect. Each place is scored on its own country's scale, so a 25 km miss costs more in the Netherlands than in South Africa.",
  },
  {
    title: "The clock",
    body: "The points on offer step down as time runs: 5,000, 4,500, 4,000, 3,500, then 3,000 in the last fifth. Wander gives 60 seconds, Explore 45, Sprint 30.",
  },
  {
    title: "Match length",
    body: "Escape is five places, Quick ten; Classic, Voyage and Odyssey go longer. Voyage and Odyssey also leave Earth for a cosmos round.",
  },
  {
    title: "Movement",
    body: "Moving lets you look, zoom and walk. No move: look and zoom only. NMPZ: one fixed view. Harder rules earn more XP.",
  },
  {
    title: "Duels",
    body: "Points race: the highest total wins; ties go to the shorter total distance, then the faster time. Health: both start on 6,000, and each place the lower score loses the gap, times a multiplier that grows after the fourth place. First to zero loses.",
  },
  {
    title: "Country Streak",
    body: "One place at a time from every country in the game. Pin the right country to keep going; a wrong one or the clock ends the run.",
  },
  {
    title: "Pause",
    body: "Solo games pause with the button or Esc: the clock stops and the place is hidden. Duels never pause.",
  },
];

export function Tutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const current = STEPS[step];
  return (
    <ModalShell titleId="how-title" onClose={onClose} wide className="tut">
      <div className="flex items-center justify-between gap-3">
        <h2 id="how-title" className="font-display text-2xl">
          How to play
        </h2>
        <Button variant="ghost" size="icon" aria-label="Close" className="-mr-2" onClick={onClose}>
          <X className="size-5" />
        </Button>
      </div>
      {/* Progress through the steps: bars, like the round tracker. */}
      <div className="tut-progress mt-3" aria-hidden>
        {STEPS.map((s, i) => (
          <i key={s.title} className={cn(i < step && "is-done", i === step && "is-on")} />
        ))}
      </div>
      <div key={step} className="tut-step mt-4" aria-live="polite">
        <TutorialArt step={step} />
        <p className="tut-count mt-4 tabular">
          {step + 1} / {STEPS.length}
        </p>
        <h3 className="mt-1 font-display text-xl">{current.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">{current.body}</p>
      </div>
      <div className="mt-5 flex gap-2">
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Button>
        )}
        <Button className="flex-1" data-autofocus onClick={() => (last ? onClose() : setStep((s) => s + 1))}>
          {last ? "Let's play" : "Next"}
          {!last && <ArrowRight className="size-4" aria-hidden />}
        </Button>
      </div>
      <details className="tut-rules mt-5">
        <summary>The rules in full</summary>
        <dl>
          {RULES.map((rule) => (
            <div key={rule.title}>
              <dt>{rule.title}</dt>
              <dd>{rule.body}</dd>
            </div>
          ))}
        </dl>
      </details>
    </ModalShell>
  );
}

/** One small looping animation per step, drawn in CSS (classic.css: .tut-art). */
function TutorialArt({ step }: { step: number }) {
  if (step === 0)
    return (
      <div className="tut-art tut-look" aria-hidden>
        <div className="tut-pano">
          <svg viewBox="0 0 400 120" preserveAspectRatio="none">
            <path d="M0 90 L60 50 L110 80 L170 30 L230 75 L290 40 L350 70 L400 45 L400 120 L0 120Z" className="tut-far" />
            <path d="M0 105 L80 80 L150 100 L220 78 L300 98 L400 82 L400 120 L0 120Z" className="tut-near" />
          </svg>
          <span className="tut-sign">N2 · 34 km</span>
        </div>
        <span className="tut-hand">
          <Hand size={26} />
        </span>
      </div>
    );
  if (step === 1)
    return (
      <div className="tut-art tut-map" aria-hidden>
        <svg viewBox="0 0 200 110" className="tut-land">
          <path d="M18 30 Q40 8 78 16 T130 20 Q170 14 186 40 Q192 70 160 82 Q120 100 84 90 Q40 96 22 72 Q8 52 18 30Z" />
        </svg>
        <span className="tut-ripple" />
        <span className="tut-pin">
          <MapPin size={30} />
        </span>
      </div>
    );
  if (step === 2)
    return (
      <div className="tut-art tut-lock" aria-hidden>
        <span className="tut-lock-button">
          <Lock size={14} /> Lock guess
        </span>
        <span className="tut-tap" />
        <span className="tut-stamp">Locked</span>
      </div>
    );
  if (step === 3) return <TutorialScore />;
  return (
    <div className="tut-art tut-ways" aria-hidden>
      <span style={{ "--i": 0 } as React.CSSProperties}>
        <Trophy size={22} /> Points race
      </span>
      <span style={{ "--i": 1 } as React.CSSProperties}>
        <Heart size={22} /> Health duel
      </span>
      <span style={{ "--i": 2 } as React.CSSProperties}>
        <Flame size={22} /> Country Streak
      </span>
    </div>
  );
}

/** The score step: a line from pin to answer, and the points counting up. */
function TutorialScore() {
  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const points = useCountUp(4620, 1300, reduced, 0, 700);
  return (
    <div className="tut-art tut-score" aria-hidden>
      <svg viewBox="0 0 200 90" className="tut-line">
        <line x1="40" y1="62" x2="160" y2="28" />
      </svg>
      <span className="tut-score-pin">
        <MapPin size={22} />
      </span>
      <span className="tut-score-flag">
        <Flag size={20} />
      </span>
      <span className="tut-score-km">12 km</span>
      <span className="tut-score-points tabular">+{Math.round(points).toLocaleString()}</span>
    </div>
  );
}
