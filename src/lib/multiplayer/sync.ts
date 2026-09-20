import type { MatchState, PublicSnapshot } from "../game/types.ts";

/** Only host revisions order the game. Local pins never advance this counter. */
export function mergeHostSnapshot(previous: MatchState, incoming: PublicSnapshot, selfId: string): MatchState {
  if (previous.hostId && incoming.hostId !== previous.hostId) return previous;
  if (previous.hostId && incoming.seq <= previous.seq) return previous;
  const sameQuestion = previous.seed === incoming.seed && previous.questionIndex === incoming.questionIndex;
  const mine = sameQuestion ? previous.players.find(p => p.id === selfId) : undefined;
  return {
    ...incoming,
    lastEventAt: 0,
    duelKind: "online",
    players: incoming.players.map(p => p.id === selfId && mine && !incoming.revealed
      ? { ...p, guess: mine.guess ?? p.guess }
      : p),
  };
}

export function matchesQuestion(state: Pick<MatchState, "seed" | "questionIndex">, message: {seed: number; questionIndex: number}): boolean {
  return state.seed === message.seed && state.questionIndex === message.questionIndex;
}
