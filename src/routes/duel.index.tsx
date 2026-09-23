import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MusicHudButton } from "@/components/game/music-player";
import { AvatarPicker, PlayerAvatar } from "@/components/game/player-avatar";

import {
  atlasLabel,
  DEFAULT_AVATAR,
  DIFFICULTY_SECONDS,
  loadSettings,
  MATCH_LENGTH,
  saveSettings,
  sanitizeAvatar,
  type AvatarId,
} from "@/lib/game";
import { makeRoomCode, sanitizeName } from "@/lib/multiplayer";

export const Route = createFileRoute("/duel/")({ component: DuelLobby });

const HOTSEAT_KEY = "atlas-hotseat-v1";

function DuelLobby() {
  const navigate = useNavigate();
  const initial = loadSettings();

  const [name, setName] = useState(initial.displayName);
  const [avatarId, setAvatarId] = useState<AvatarId>(sanitizeAvatar(initial.avatarId));
  const [guestName, setGuestName] = useState("Rival");
  const [guestAvatar, setGuestAvatar] = useState<AvatarId>("canal");
  const [code, setCode] = useState("");
  const [passPlay, setPassPlay] = useState(false);

  const persistMe = () => {
    saveSettings({ ...loadSettings(), displayName: sanitizeName(name), avatarId });
  };

  const goOnline = (next: string, host?: boolean) => {
    persistMe();
    void navigate({
      to: "/duel/$code",
      params: { code: next },
      state: (host ? { host: true } : {}) as never,
    });
  };

  return (
    <main className="duel-lobby relative min-h-dvh overflow-hidden">

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0.35)_0%,rgba(9,9,11,0.88)_55%,rgba(9,9,11,0.96)_100%)]" />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.28em] text-muted">Two player</p>
          <div className="-my-2">
            <MusicHudButton />
          </div>
        </div>
        <h1 className="font-display mt-2 text-5xl">Duel</h1>
        <p className="mt-3 text-muted">Good friends. Better rivals.</p>
        <p className="mt-2 text-xs uppercase tracking-wider text-subtle">
          {atlasLabel(initial.atlas)} · {initial.difficulty} · {DIFFICULTY_SECONDS[initial.difficulty]}s ·{" "}
          {MATCH_LENGTH[initial.matchLength].totalRounds === 1
            ? "quick · 10"
            : `${MATCH_LENGTH[initial.matchLength].totalRounds} rounds`}
        </p>

        <label className="mt-8 text-xs uppercase tracking-wider text-subtle">Your name</label>
        <div className="mt-2 flex items-center gap-3">
          <PlayerAvatar id={avatarId} size={52} title={sanitizeName(name)} />
          <Input
            value={name}
            maxLength={24}
            autoComplete="nickname"
            aria-label="Your name"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="mt-4">
          <AvatarPicker value={avatarId} onChange={setAvatarId} />
        </div>

        <Button
          className="mt-8 w-full"
          size="lg"
          onClick={() => {
            persistMe();
            void navigate({ to: "/duel/bot" });
          }}
        >
          <PlayerAvatar id="grok" size={28} />
          Duel Grok
        </Button>

        <Button
          className="mt-3 w-full"
          size="lg"
          variant="secondary"
          onClick={() => setPassPlay((v) => !v)}
        >
          Pass and play
        </Button>
        {passPlay && (
          <div className="mt-3 rounded-[var(--radius-md)] border border-border bg-bg/70 p-3">
            <p className="text-xs uppercase tracking-wider text-subtle">Player two</p>
            <Input
              className="mt-2"
              value={guestName}
              maxLength={24}
              aria-label="Player two name"
              onChange={(e) => setGuestName(e.target.value)}
            />
            <div className="mt-3">
              <AvatarPicker value={guestAvatar} onChange={setGuestAvatar} />
            </div>
            <Button
              className="mt-4 w-full"
              onClick={() => {
                persistMe();
                try { sessionStorage.setItem(
                  HOTSEAT_KEY,
                  JSON.stringify({
                    name: sanitizeName(guestName),
                    avatarId: guestAvatar || DEFAULT_AVATAR,
                  }),
                ); } catch { /* Guest defaults remain available. */ }
                void navigate({ to: "/duel/hotseat" });
              }}
            >
              Start pass and play
            </Button>
          </div>
        )}

        <div className="mt-8 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => goOnline(makeRoomCode(), true)}>
            Create room
          </Button>
        </div>
        <div className="mt-3 flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && code.trim().length === 6) goOnline(code.trim().toUpperCase());
            }}
            maxLength={6}
            placeholder="Enter code"
            aria-label="Room code"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          <Button
            variant="secondary"
            disabled={code.trim().length !== 6}
            onClick={() => goOnline(code.trim().toUpperCase())}
          >
            Join
          </Button>
        </div>
        <Button variant="ghost" className="mt-6 w-full" onClick={() => void navigate({ to: "/" })}>
          Home
        </Button>
      </div>
    </main>
  );
}