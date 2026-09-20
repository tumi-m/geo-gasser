# ATLAS DUEL match server

One Cloudflare Durable Object per room. The object owns the deck, the clock and
the scores, so ranked play cannot be won by editing client state or reading the
wire. The client talks to it over a WebSocket; commands go in, `PublicSnapshot`
messages come out.

The worker reuses the same reducer as the browser (`src/lib/game/machine.ts`)
through `src/lib/multiplayer/room.ts`, so a server-scored duel and a solo match
can never disagree.

## Run it locally

```bash
npm run match:dev
# -> ws://127.0.0.1:8787/room/<CODE>
```

Then point the web app at it:

```bash
VITE_MATCH_SERVER_URL=http://127.0.0.1:8787 npm run dev
```

Without `VITE_MATCH_SERVER_URL` the app keeps using the peer-to-peer transport,
so private rooms work with no server at all.

## Deploy

```bash
npx wrangler login
npm run match:deploy
```

Set the deployed URL on Vercel as `VITE_MATCH_SERVER_URL` and redeploy the web
app. The DO SQLite migration is declared in `wrangler.toml` (`v1`).

## Protocol

Client → server (`src/lib/multiplayer/wire.ts`):

- `hello` — reserved; identity travels in the upgrade query string
- `pin` / `lock` — own coordinates only
- `intro`, `continue`, `rematch`, `start`, `ping`

Server → client:

- `welcome` — assigned `selfId` + first `PublicSnapshot`
- `snapshot` — after every state change
- `pong`, `error`

Snapshots never carry the deck, the seed, environment ids, the truth
coordinate, source URLs or titles until the reveal. The only scene data is the
plate on screen (`SceneInfo`).

## Room lifecycle

1. First socket bootstraps the duel with the creator's settings and becomes host.
2. The second socket auto-starts the match.
3. Locks are scored from server receipt time; all-locked reveals immediately.
4. A DO alarm force-reveals the round at `roundStartedAtMs + durationSec`.
5. A disconnect dispatches `PLAYER_LEAVE`; the survivor wins a live match.
6. `rematch` re-deals and auto-starts when both players are still connected.
