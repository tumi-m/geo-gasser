import { createFileRoute } from "@tanstack/react-router";
import { MatchApp } from "@/components/game/match-app";

export const Route = createFileRoute("/play")({ component: PlaySolo });

function PlaySolo() {
  return <MatchApp mode="solo" />;
}
