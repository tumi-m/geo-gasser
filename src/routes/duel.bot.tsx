import { createFileRoute } from "@tanstack/react-router";
import { MatchApp } from "@/components/game/match-app";

export const Route = createFileRoute("/duel/bot")({ component: DuelBot });

function DuelBot() {
  return <MatchApp mode="duel" duelKind="bot" />;
}