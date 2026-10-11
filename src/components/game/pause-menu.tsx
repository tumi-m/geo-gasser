import { LogOut, Play, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "./modal-shell";
import { useMono } from "@/lib/theme";

/**
 * Solo pause: the clock stands still and the scene is covered, so a pause is
 * a break, not extra time to study the photo. Esc or Resume picks up where
 * the round stopped.
 */
export function PauseMenu({
  remaining,
  away,
  onResume,
  onSettings,
  onQuit,
}: {
  /** Seconds left on the clock when it stopped. */
  remaining: number;
  /** Paused because the tab or app was left, not by the player. */
  away?: boolean;
  onResume: () => void;
  onSettings: () => void;
  onQuit: () => void;
}) {
  const mono = useMono();
  return (
    <ModalShell titleId="pause-title" onClose={onResume} className="pause-panel">
      <p className={mono ? "eyebrow" : "text-xs uppercase tracking-[0.28em] text-accent"}>Paused</p>
      <h2 id="pause-title" className="mt-2 font-display text-3xl leading-tight">
        {away ? "Welcome back" : "Take a breather"}
      </h2>
      <p className="mt-2 text-sm text-muted">
        <span className="tabular text-fg">{Math.max(0, Math.ceil(remaining))}s</span> left on the
        clock. The place stays hidden until you carry on.
      </p>
      <div className="mt-6 grid gap-2">
        <Button size="lg" data-autofocus onClick={onResume}>
          <Play className="size-4" aria-hidden />
          Resume
        </Button>
        <Button variant="secondary" onClick={onSettings}>
          <SettingsIcon className="size-4" aria-hidden />
          Settings
        </Button>
        <Button variant="ghost" onClick={onQuit}>
          <LogOut className="size-4" aria-hidden />
          Leave match
        </Button>
      </div>
      <p className="mt-4 hidden text-center text-xs text-subtle sm:block">Esc to resume</p>
    </ModalShell>
  );
}
