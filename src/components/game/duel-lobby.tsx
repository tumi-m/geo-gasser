import { useEffect, useState } from "react";
import { ArrowRight, Check, ChevronDown, Link2, Pencil } from "lucide-react";
import { useNavigate } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MusicHudButton } from "@/components/game/music-player";
import { AvatarBuilder, PlayerAvatar } from "@/components/game/player-avatar";

import {
  atlasLabel,
  DEFAULT_AVATAR,
  DEFAULT_SETTINGS,
  DIFFICULTY_SECONDS,
  loadSettings,
  MATCH_LENGTH,
  saveSettings,
  sanitizeAvatar,
  type AvatarId,
} from "@/lib/game";
import { makeRoomCode, sanitizeName } from "@/lib/multiplayer";
import { cn } from "@/lib/utils";

const HOTSEAT_KEY = "atlas-hotseat-v1";

export function DuelLobby() {
  const navigate = useNavigate();
  // Read stored settings after mount so the first render matches the server's.
  const [initial, setInitial] = useState(DEFAULT_SETTINGS);

  const [name, setName] = useState(DEFAULT_SETTINGS.displayName);
  const [avatarId, setAvatarId] = useState<AvatarId>(sanitizeAvatar(DEFAULT_SETTINGS.avatarId));
  useEffect(() => {
    const stored = loadSettings();
    setInitial(stored);
    setName(stored.displayName);
    setAvatarId(sanitizeAvatar(stored.avatarId));
  }, []);
  const [guestName, setGuestName] = useState("Rival");
  const [guestAvatar, setGuestAvatar] = useState<AvatarId>("square-blue");
  const [code, setCode] = useState("");
  const [passPlay, setPassPlay] = useState(false);
  const [editMe, setEditMe] = useState(false);
  const [editGuest, setEditGuest] = useState(false);

  const persistMe = () => {
    saveSettings({
      ...loadSettings(),
      displayName: sanitizeName(name),
      avatarId,
      namePrompted: true,
    });
  };

  const goOnline = (next: string) => {
    persistMe();
    navigate(`/duel/${encodeURIComponent(next)}`);
  };

  return (
    <main className="duel-lobby relative min-h-dvh overflow-hidden">
      <div className="duel-orbit" aria-hidden />
      <div className="duel-orbit is-b" aria-hidden />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="atlas-rise flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.28em] text-muted">Two player</p>
          <div className="-my-2">
            <MusicHudButton />
          </div>
        </div>
        <h1 className="atlas-rise font-display mt-1 text-5xl tracking-tight">Duel</h1>
        <p className="atlas-rise atlas-rise-1 mt-2 text-muted">Good friends. Better rivals.</p>

        {/* You: name and bot in one row; the builder waits behind "Edit". */}
        <section className="duel-card atlas-rise atlas-rise-1 mt-6" aria-label="You">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="duel-avatar-button"
              aria-label="Edit your bot"
              aria-expanded={editMe}
              onClick={() => setEditMe((v) => !v)}
            >
              <PlayerAvatar id={avatarId} size={52} title={sanitizeName(name)} track sleepy />
            </button>
            <Input
              value={name}
              maxLength={24}
              autoComplete="nickname"
              aria-label="Your name"
              onChange={(e) => setName(e.target.value)}
            />
            <button
              type="button"
              className={cn("duel-edit", editMe && "is-on")}
              aria-expanded={editMe}
              onClick={() => setEditMe((v) => !v)}
            >
              {editMe ? <Check className="size-4" /> : <Pencil className="size-4" />}
              <span>{editMe ? "Done" : "Edit"}</span>
            </button>
          </div>
          <Collapse open={editMe}>
            <AvatarBuilder className="pt-4" value={avatarId} onChange={setAvatarId} />
          </Collapse>
        </section>

        <p className="atlas-rise atlas-rise-2 mt-6 text-xs uppercase tracking-[0.2em] text-subtle">
          Choose your rival
        </p>

        <button
          type="button"
          className="duel-mode is-primary atlas-rise atlas-rise-2 mt-2"
          onClick={() => {
            persistMe();
            navigate("/duel/bot");
          }}
        >
          <span className="duel-mode-art">
            <PlayerAvatar id="grok" size={40} live />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Duel Grok</span>
            <span className="block text-xs text-muted">A bot rival, ready now</span>
          </span>
          <ArrowRight className="duel-mode-go size-5" aria-hidden />
        </button>

        <section className={cn("duel-mode atlas-rise atlas-rise-3 mt-2", passPlay && "is-open")}>
          <button
            type="button"
            className="duel-mode-head"
            aria-expanded={passPlay}
            onClick={() => setPassPlay((v) => !v)}
          >
            <span className="duel-mode-art is-pair">
              <PlayerAvatar id={avatarId} size={30} />
              <PlayerAvatar id={guestAvatar} size={30} />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block font-medium">Pass and play</span>
              <span className="block text-xs text-muted">One screen, taking turns</span>
            </span>
            <ChevronDown className="duel-mode-go size-5" aria-hidden />
          </button>
          <Collapse open={passPlay}>
            <div className="pt-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="duel-avatar-button"
                  aria-label="Edit player two's bot"
                  aria-expanded={editGuest}
                  onClick={() => setEditGuest((v) => !v)}
                >
                  <PlayerAvatar id={guestAvatar} size={44} live />
                </button>
                <Input
                  value={guestName}
                  maxLength={24}
                  aria-label="Player two name"
                  onChange={(e) => setGuestName(e.target.value)}
                />
                <button
                  type="button"
                  className={cn("duel-edit", editGuest && "is-on")}
                  aria-expanded={editGuest}
                  onClick={() => setEditGuest((v) => !v)}
                >
                  {editGuest ? <Check className="size-4" /> : <Pencil className="size-4" />}
                  <span>{editGuest ? "Done" : "Edit"}</span>
                </button>
              </div>
              <Collapse open={editGuest}>
                <AvatarBuilder className="pt-4" value={guestAvatar} onChange={setGuestAvatar} />
              </Collapse>
              <Button
                className="mt-3 w-full"
                onClick={() => {
                  persistMe();
                  try {
                    sessionStorage.setItem(
                      HOTSEAT_KEY,
                      JSON.stringify({
                        name: sanitizeName(guestName),
                        avatarId: guestAvatar || DEFAULT_AVATAR,
                      }),
                    );
                  } catch {
                    /* Guest defaults remain available. */
                  }
                  navigate("/duel/hotseat");
                }}
              >
                Start pass and play
              </Button>
            </div>
          </Collapse>
        </section>

        <section className="duel-mode atlas-rise atlas-rise-4 mt-2" aria-label="Play online">
          <div className="duel-mode-head is-static">
            <span className="duel-mode-art">
              <Link2 className="size-5 text-accent" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Play online</span>
              <span className="block text-xs text-muted">Invite a friend with a room code</span>
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => goOnline(makeRoomCode())}
            >
              Create room
            </Button>
            <Input
              className="h-10 min-w-0 flex-1 text-center font-mono tracking-[0.3em] uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && code.trim().length === 6)
                  goOnline(code.trim().toUpperCase());
              }}
              maxLength={6}
              placeholder="CODE"
              aria-label="Room code"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            <Button
              size="sm"
              className="shrink-0"
              variant={code.trim().length === 6 ? "primary" : "secondary"}
              disabled={code.trim().length !== 6}
              onClick={() => goOnline(code.trim().toUpperCase())}
            >
              Join
            </Button>
          </div>
        </section>

        <p className="atlas-rise atlas-rise-4 mt-5 text-center text-[11px] uppercase tracking-wider text-subtle">
          {atlasLabel(initial.atlas)} · {DIFFICULTY_SECONDS[initial.difficulty]}s ·{" "}
          {MATCH_LENGTH[initial.matchLength].totalRounds === 1
            ? "quick · 10 places"
            : `${MATCH_LENGTH[initial.matchLength].totalRounds} rounds`}
        </p>
        <Button variant="ghost" className="mt-2 w-full" onClick={() => navigate("/")}>
          Home
        </Button>
      </div>
    </main>
  );
}

/** Height-animated disclosure: grid rows 0fr → 1fr, content stays mounted. */
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("duel-collapse", open && "is-open")} inert={!open}>
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
