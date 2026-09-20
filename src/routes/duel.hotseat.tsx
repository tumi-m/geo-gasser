import { createFileRoute } from "@tanstack/react-router";
import { MatchApp } from "@/components/game/match-app";

export const Route = createFileRoute("/duel/hotseat")({ component: DuelHotseat });

function DuelHotseat() {
  return <MatchApp mode="duel" duelKind="hotseat" />;
}