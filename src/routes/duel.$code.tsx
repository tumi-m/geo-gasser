import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { MatchApp } from "@/components/game/match-app";

export const Route = createFileRoute("/duel/$code")({ component: DuelRoom });

function DuelRoom() {
  const { code } = Route.useParams();
  const host = Boolean((useRouterState({ select: (s) => s.location.state }) as { host?: boolean } | undefined)?.host);
  return <MatchApp mode="duel" roomCode={code} isCreator={host} duelKind="online" />;
}