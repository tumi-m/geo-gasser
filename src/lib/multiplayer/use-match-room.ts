import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicSnapshot } from "../game/types.ts";
import { matchSocketUrl, queueCommand } from "./transport.ts";
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
  /** Commands issued while the socket was down, replayed when it returns. */
  const outboxRef = useRef<ClientMessage[]>([]);
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
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      // Dropping a lock here would cost the player the round; hold it for the
      // reconnect instead. The server rejects whatever the round outran.
      outboxRef.current = queueCommand(outboxRef.current, msg);
      return false;
    }
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
      const wsUrl = matchSocketUrl(url, room, { ...identity, playerId });

      const socket = new WebSocket(wsUrl);
      ws = socket;
      socketRef.current = socket;
      socket.onopen = () => {
        retry = 0;
        setConnected(true);
        const pending = outboxRef.current;
        outboxRef.current = [];
        for (const msg of pending) socket.send(JSON.stringify(msg));
      };
      socket.onclose = () => {
        setConnected(false);
        setJoined(false);
        if (socketRef.current === socket) socketRef.current = null;
        // The room holds a dropped seat for a grace window, so a reconnect
        // with the same player id restores the match instead of forfeiting.
        if (disposed) return;
        const delay = Math.min(5_000, 400 * 2 ** retry++) + Math.random() * 250;
        retryTimer = window.setTimeout(connect, delay);
      };
      socket.onerror = () => setConnected(false);
      socket.onmessage = (event) => {
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
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ t: "ping" }));
      }, 20_000);
    };

    connect();

    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(ping);
      socketRef.current = null;
      // A queued command belongs to the room being left, not the next one.
      outboxRef.current = [];
      ws?.close();
    };
  }, [enabled, url, room, playerId]);

  return { selfId, connected, joined, send, onMessage };
}
