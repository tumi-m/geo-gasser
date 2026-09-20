import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicSnapshot } from "../game/types.ts";
import { parseServerMessage, type ClientMessage } from "./wire.ts";

export interface MatchRoomHandlers {
  onWelcome?: (selfId: string, state: PublicSnapshot) => void;
  onSnapshot?: (state: PublicSnapshot) => void;
}

/**
 * WebSocket transport for server-authoritative rooms. The Durable Object owns
 * the match; this hook only carries commands in and snapshots out.
 */
export function useMatchRoom(options: {
  url?: string;
  room?: string;
  name: string;
  avatarId?: string;
  playerId: string;
  difficulty?: string;
  matchLength?: string;
  atlas?: unknown;
  enabled: boolean;
}) {
  const [selfId, setSelfId] = useState("");
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<MatchRoomHandlers>({});
  const identityRef = useRef(options);
  identityRef.current = options;

  const onMessage = useCallback((handlers: MatchRoomHandlers) => {
    handlersRef.current = handlers;
    return () => {
      handlersRef.current = {};
    };
  }, []);

  const send = useCallback((msg: ClientMessage) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  }, []);

  const { enabled, url, room, playerId } = options;

  useEffect(() => {
    if (!enabled || !url || !room) return;
    const identity = identityRef.current;
    const base = url.replace(/\/+$/, "");
    const wsUrl = new URL(`${base}/room/${encodeURIComponent(room.toUpperCase())}`);
    wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
    wsUrl.searchParams.set("playerId", playerId);
    wsUrl.searchParams.set("name", identity.name);
    if (identity.avatarId) wsUrl.searchParams.set("avatarId", identity.avatarId);
    if (identity.difficulty) wsUrl.searchParams.set("difficulty", identity.difficulty);
    if (identity.matchLength) wsUrl.searchParams.set("matchLength", identity.matchLength);
    if (identity.atlas) {
      try {
        wsUrl.searchParams.set("atlas", JSON.stringify(identity.atlas));
      } catch {
        /* ignore unserialisable atlas */
      }
    }

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setJoined(false);
    };
    ws.onerror = () => setConnected(false);
    ws.onmessage = (event) => {
      let raw: unknown;
      try {
        raw = JSON.parse(String(event.data));
      } catch {
        return;
      }
      const msg = parseServerMessage(raw);
      if (!msg) return;
      if (msg.t === "welcome") {
        setSelfId(msg.selfId);
        setJoined(true);
        handlersRef.current.onWelcome?.(msg.selfId, msg.state as PublicSnapshot);
        return;
      }
      if (msg.t === "snapshot") {
        handlersRef.current.onSnapshot?.(msg.state as PublicSnapshot);
      }
    };

    const ping = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "ping" }));
    }, 20_000);

    return () => {
      window.clearInterval(ping);
      socketRef.current = null;
      ws.close();
    };
  }, [enabled, url, room, playerId]);

  return { selfId, connected, joined, send, onMessage };
}
