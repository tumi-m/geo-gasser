import { Button } from "@/components/ui/button";
import { ModalShell } from "./modal-shell";

const STEPS = [
  {
    n: "01",
    title: "Study the scene",
    body: "Choose an atlas before you play: South Africa, the Netherlands, both, the world, a mix, or a custom list of countries. Where Street View covers the place you can walk around it: drag to look, click the arrows or the road to move. Otherwise drag the photo, scroll to zoom, and step between viewpoints.",
  },
  {
    n: "02",
    title: "Drop a pin",
    body: "Tap the map. Use SA, NL, or World to jump, or search a city by name. The map shows countries and provinces but no towns until the reveal: read the scene, not the dots.",
  },
  {
    n: "03",
    title: "Lock in",
    body: "Lock your guess before time runs out. Unsubmitted pins score zero. Enter also locks.",
  },
  {
    n: "04",
    title: "5,000 a round",
    body: "Scored the GeoGuessr way: up to 5,000 points, falling off with distance, and a pin within 25 m is perfect. Each place is scored on its own country's map, so a 25 km miss costs more in the Netherlands than in South Africa, and less again on the world map.",
  },
  {
    n: "05",
    title: "The clock takes its share",
    body: "The points on offer step down as the clock runs: 5,000, 4,500, 4,000, 3,500, then 3,000 in the last fifth. Your distance score keeps that share. Easy gives 60 seconds, Medium 45, Hard 30, and the steps scale to your timer.",
  },
  {
    n: "06",
    title: "Match length",
    body: "Quick Escape visits five places, with a world wildcard at the end of SA × NL games. Choose a longer expedition in settings. Voyage and Odyssey also leave Earth: a cosmos round where you place planets, stars and galaxies by their distance from the Sun. Smaller maps never repeat places.",
  },
  {
    n: "07",
    title: "Highest total wins",
    body: "Ties break on shorter total distance, then faster total time.",
  },
];

export function Tutorial({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell titleId="how-title" onClose={onClose} wide>
      <h2 id="how-title" className="quoted font-display text-2xl">
        How to play
      </h2>
      <ol className="mt-5 list-none border-b border-border">
        {STEPS.map((step) => (
          <li key={step.n} className="flex gap-4 border-t border-border py-3.5">
            <span className="w-8 shrink-0 pt-px font-mono text-xs tabular text-subtle">{step.n}</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-fg">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <Button className="mt-6 w-full" onClick={onClose}>
        Got it
      </Button>
    </ModalShell>
  );
}
