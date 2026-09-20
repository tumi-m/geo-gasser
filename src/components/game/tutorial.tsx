import { Button } from "@/components/ui/button";
import { ModalShell } from "./modal-shell";

const STEPS = [
  {
    n: "01",
    title: "Study the scene",
    body: "149 places: 50 South Africa, 50 Netherlands, 49 around the world. Drag to look around, WASD to inspect, scroll to zoom — like GeoGuessr, on a still.",
  },
  {
    n: "02",
    title: "Drop a pin",
    body: "Tap the map. Use SA, NL, or World to jump. Search any city. Drag the pin to fine-tune.",
  },
  {
    n: "03",
    title: "Lock in",
    body: "If time runs out with a pin down, you keep accuracy points but lose the speed bonus. Enter also locks.",
  },
  {
    n: "04",
    title: "Accuracy plus speed",
    body: "South Africa uses a wider distance scale than the Netherlands. World sites use a wider scale still, so a miss in Patagonia is not treated like a miss in Utrecht.",
  },
  {
    n: "05",
    title: "Timer difficulty",
    body: "Easy gives 60 seconds, Medium 45, Hard 30. Speed points scale to the timer you picked.",
  },
  {
    n: "06",
    title: "Match length",
    body: "Standard is 4 rounds / 40 questions. Extended is 7 / 70. Full game is 10 rounds / 100, drawn from the shuffled 149 so repeats are rare.",
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
      <h2 id="how-title" className="font-display text-2xl">
        How to play
      </h2>
      <ol className="mt-5 list-none space-y-4">
        {STEPS.map((step) => (
          <li key={step.n} className="flex gap-4">
            <span className="font-display tabular w-8 shrink-0 text-subtle">{step.n}</span>
            <div>
              <p className="text-sm font-medium text-fg">{step.title}</p>
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
