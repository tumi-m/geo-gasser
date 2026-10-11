import { useEffect, useRef } from "react";
import { audio } from "@/lib/game";
import { PlayerAvatar } from "./player-avatar";

/**
 * Before a duel's first round: the two players face off. Their panels slam
 * in from either side, the VS crashes into the middle, and the rule of the
 * match reads underneath. Tap, Enter or Esc skips it.
 */

export interface FaceoffSide {
  name: string;
  avatarId?: string;
  /** "You · level 4 Backpacker", "Bot rival", "Player two" … */
  tag: string;
}

const HOLD_MS = 2700;
const HOLD_REDUCED_MS = 1500;

export function VsFaceoff({
  left,
  right,
  rule,
  reducedMotion,
  onDone,
}: {
  left: FaceoffSide;
  right: FaceoffSide;
  rule: string;
  reducedMotion?: boolean;
  onDone: () => void;
}) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (!reducedMotion) {
      const whoosh = window.setTimeout(() => audio.play("whoosh"), 120);
      const hit = window.setTimeout(() => audio.play("lock"), 480);
      const end = window.setTimeout(() => doneRef.current(), HOLD_MS);
      return () => [whoosh, hit, end].forEach((t) => window.clearTimeout(t));
    }
    const end = window.setTimeout(() => doneRef.current(), HOLD_REDUCED_MS);
    return () => window.clearTimeout(end);
  }, [reducedMotion]);
  return (
    <div
      className={reducedMotion ? "faceoff is-reduced" : "faceoff"}
      role="status"
      aria-live="polite"
      aria-label={`${left.name} versus ${right.name}. ${rule}.`}
      onClick={() => doneRef.current()}
    >
      <FaceoffPanel side={left} which="left" />
      <FaceoffPanel side={right} which="right" />
      <span className="faceoff-vs" aria-hidden>
        <i className="faceoff-flash" />
        VS
      </span>
      <p className="faceoff-rule" aria-hidden>
        {rule}
      </p>
      <p className="faceoff-hint" aria-hidden>
        Tap to skip
      </p>
    </div>
  );
}

function FaceoffPanel({ side, which }: { side: FaceoffSide; which: "left" | "right" }) {
  return (
    <div className={`faceoff-panel is-${which}`} aria-hidden>
      <span className="faceoff-lines" />
      <div className="faceoff-player">
        <PlayerAvatar id={side.avatarId} size={104} live mood="focus" />
        <span>
          <span className="faceoff-name">{side.name}</span>
          <span className="faceoff-tag">{side.tag}</span>
        </span>
      </div>
    </div>
  );
}
