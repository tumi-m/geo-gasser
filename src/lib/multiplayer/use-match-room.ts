import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicSnapshot } from "../game/types.ts";
import { parseServerMessage, type ClientMessage } from "./wire.ts";

export interface MatchRoomHandlers {
  onWelcome?: (selfId: string, state: PublicSnapshot, sentAt?: number) => void;
  onSnapshot?: (state: PublicSnapshot, sentAt?: number) => void;
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
    let disposed = false;
    let ws: WebSocket | null = null;
    let retry = 0;
    let retryTimer = 0;
    let ping = 0;

    const connect = () => {
      if (disposed) return;
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

      ws = new WebSocket(wsUrl);
      socketRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        setConnected(true);
      };
      ws.onclose = () => {
        setConnected(false);
        setJoined(false);
        socketRef.current = null;
        // The room holds a dropped seat for a grace window, so a reconnect
        // with the same player id restores the match instead of forfeiting.
        if (disposed) return;
        const delay = Math.min(5_000, 400 * 2 ** retry++) + Math.random() * 250;
        retryTimer = window.setTimeout(connect, delay);
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
          handlersRef.current.onWelcome?.(msg.selfId, msg.state as PublicSnapshot, msg.sentAt);
          return;
        }
        if (msg.t === "snapshot") {
          handlersRef.current.onSnapshot?.(msg.state as PublicSnapshot, msg.sentAt);
        }
      };

      window.clearInterval(ping);
      ping = window.setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "ping" }));
      }, 20_000);
    };

    connect();

    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(ping);
      socketRef.current = null;
      ws?.close();
    };
  }, [enabled, url, room, playerId]);

  return { selfId, connected, joined, send, onMessage };
}
