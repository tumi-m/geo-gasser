import { createFileRoute } from "@tanstack/react-router";
import { MatchApp } from "@/components/game/match-app";

export const Route = createFileRoute("/duel/$code")({ component: DuelRoom });

function DuelRoom() {
  const { code } = Route.useParams();
  return (
    <MatchApp
      key={code.toUpperCase()}
      mode="duel"
      roomCode={code.toUpperCase()}
      duelKind="online"
    />
  );
}
