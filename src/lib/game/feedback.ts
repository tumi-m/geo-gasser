import type { BadgeId, FeedbackId } from "./types.ts";
import { BADGE_COPY, FEEDBACK_COPY } from "./scoring.ts";

export { BADGE_COPY, FEEDBACK_COPY };

export function feedbackTone(id: FeedbackId): "high" | "mid" | "low" {
  if (id === "perfect" || id === "incredible") return "high";
  if (id === "good" || id === "instincts" || id === "close") return "mid";
  return "low";
}

export function badgePriority(id: BadgeId): number {
  const order: BadgeId[] = [
    "bullseye",
    "sharpshooter",
    "excellent",
    "great_read",
    "right_region",
    "country_locked",
  ];
  return order.indexOf(id);
}
