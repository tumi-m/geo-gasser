import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe } from "@/components/game/globe";
import { loadSettings } from "@/lib/game";
import { makeRoomCode } from "@/lib/multiplayer";

export const Route = createFileRoute("/duel/")({ component: DuelLobby });

function DuelLobby() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const reduced = loadSettings().reducedMotion;

  const go = (next: string, host?: boolean) => {
    void navigate({
      to: "/duel/$code",
      params: { code: next },
      state: (host ? { host: true } : {}) as never,
    });
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-bg">
      <Globe reducedMotion={reduced} />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0.35)_0%,rgba(9,9,11,0.88)_55%,rgba(9,9,11,0.96)_100%)]" />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <p className="text-xs uppercase tracking-[0.28em] text-muted">Two player</p>
        <h1 className="font-display mt-2 text-5xl">Duel</h1>
        <p className="mt-3 text-muted">
          Create a private room or join with a six-character code. Host starts when both of you are in.
        </p>
        <Button className="mt-8 w-full" size="lg" onClick={() => go(makeRoomCode(), true)}>
          Create room
        </Button>
        <div className="mt-8 flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && code.trim().length >= 4) go(code.trim().toUpperCase());
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
            disabled={code.trim().length < 4}
            onClick={() => go(code.trim().toUpperCase())}
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
