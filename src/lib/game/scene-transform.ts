/**
 * Where a still plate sits inside the scene frame while the player looks
 * around it. Kept apart from the component so the bounds can be tested.
 */

/** Fraction of the frame a full yaw/pitch sweep travels. */
export const YAW_SPAN = 0.55;
export const PITCH_SPAN = 0.48;

export interface SceneFrame {
  naturalWidth: number;
  naturalHeight: number;
  boxWidth: number;
  boxHeight: number;
  fit: "cover" | "contain";
  zoom: number;
}

export function fitScale(
  frame: Pick<SceneFrame, "naturalWidth" | "naturalHeight" | "boxWidth" | "boxHeight" | "fit">,
): number {
  const w = frame.naturalWidth || 1;
  const h = frame.naturalHeight || 1;
  return frame.fit === "contain"
    ? Math.min(frame.boxWidth / w, frame.boxHeight / h)
    : Math.max(frame.boxWidth / w, frame.boxHeight / h);
}

/** How far the scaled plate overhangs the frame on each axis, in pixels. */
export function sceneOverhang(frame: SceneFrame): { maxX: number; maxY: number } {
  const scale = fitScale(frame) * frame.zoom;
  return {
    maxX: Math.max(0, ((frame.naturalWidth || 1) * scale - frame.boxWidth) / 2),
    maxY: Math.max(0, ((frame.naturalHeight || 1) * scale - frame.boxHeight) / 2),
  };
}

const bound = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

/**
 * Pixel offset for a look direction.
 *
 * The overhang is the ONLY limit on either axis, so every part of a plate that
 * extends past the frame can be reached. `yaw` and `pitch` come back
 * renormalised from the bounded offset, which is what stops them running away
 * while the player keeps dragging at the edge.
 */
export function sceneOffset(
  frame: SceneFrame,
  yaw: number,
  pitch: number,
): { x: number; y: number; yaw: number; pitch: number; maxX: number; maxY: number } {
  const { maxX, maxY } = sceneOverhang(frame);
  const x = bound(yaw * frame.boxWidth * YAW_SPAN, maxX);
  const y = bound(pitch * frame.boxHeight * PITCH_SPAN, maxY);
  return {
    x,
    y,
    maxX,
    maxY,
    yaw: x / (frame.boxWidth * YAW_SPAN || 1),
    pitch: y / (frame.boxHeight * PITCH_SPAN || 1),
  };
}
