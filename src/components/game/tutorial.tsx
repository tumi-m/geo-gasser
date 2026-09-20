import { Button } from "@/components/ui/button";
import { ModalShell } from "./modal-shell";

const STEPS = [
  {
    n: "01",
    title: "Study the scene",
    body: "Rounds 1–3 are 10 real places each (15 South Africa + 15 Netherlands). Round 4 is 10 labelled 3D reconstructions.",
  },
  {
    n: "02",
    title: "Drop a pin",
    body: "Tap the map. Use SA or NL to jump to a country. You have 45 seconds. Drag the pin to fine-tune.",
  },
  {
    n: "03",
    title: "Lock in",
    body: "If time runs out with a pin down, you keep accuracy points but lose the speed bonus. Enter also locks.",
  },
  {
    n: "04",
    title: "Accuracy plus speed",
    body: "South Africa uses a wider distance scale than the Netherlands so both feel fair.",
  },
  {
    n: "05",
    title: "Four rounds, forty questions",
    body: "Ten questions per round. Highest total wins. Ties break on shorter total distance, then faster total time.",
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
