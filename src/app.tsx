import { useEffect } from "react";
import { DuelLobby } from "@/components/game/duel-lobby";
import { HomeScreen } from "@/components/game/home-screen";
import { MatchApp } from "@/components/game/match-app";
import { MusicPlayer } from "@/components/game/music-player";
import { MusicProvider } from "@/lib/music/music-context";
import { navigate, type RouteDef } from "@/lib/navigation";
import { Router } from "@/lib/router";

const routes: RouteDef[] = [
  { path: "/", component: HomeScreen },
  { path: "/play", component: () => <MatchApp mode="solo" />, title: "Solo" },
  { path: "/duel", component: DuelLobby, title: "Duel" },
  { path: "/duel/bot", component: () => <MatchApp mode="duel" duelKind="bot" />, title: "Duel vs Grok" },
  {
    path: "/duel/hotseat",
    component: () => <MatchApp mode="duel" duelKind="hotseat" />,
    title: "Pass and play",
  },
  {
    path: "/duel/:code",
    title: (params) => `Room ${params.code.toUpperCase()}`,
    component: ({ params }) => {
      const code = params.code.toUpperCase();
      return <MatchApp key={code} mode="duel" roomCode={code} duelKind="online" />;
    },
  },
];

/** Unknown paths go home rather than to a dead end. */
function NotFound() {
  useEffect(() => navigate("/", { replace: true }), []);
  return null;
}

export function App() {
  // The music player sits beside the screens, not inside one: screens and
  // match phases swap whole trees, and the music must survive all of them.
  return (
    <MusicProvider>
      <Router routes={routes} fallback={NotFound} />
      <MusicPlayer />
    </MusicProvider>
  );
}
