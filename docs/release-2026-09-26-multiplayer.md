# Invite-only multiplayer room recovery

## Reproduced failure

On production, opening the same `/duel/:code` directly in two fresh browser tabs left both clients on “Waiting for opponent”, with no player list or Start match button. Creating a room through the lobby worked. Host ownership depended on the router's transient `state.host` flag, which an invite URL does not carry.

## Fix

The signaling service now assigns a single host when a room is first joined. Postgres uses an atomic UPSERT, so simultaneous requests to separate server instances agree on the owner. Local development uses the equivalent memory lease. The host's polls renew ownership; guest polls cannot perpetuate an abandoned host. A two-minute grace period preserves ownership while the host reloads. The existing session cache restores its match.

Both direct invite links and normal lobby navigation use this assignment. Guests reject snapshots from another assigned owner. The lobby distinguishes joining from waiting for an opponent and tells seated guests when the host can start.

## Validation

- Reproduced the original two-client failure on the live Vercel app.
- Two local invite-only browser clients: both seated, host started the match, both guessed and locked, matching round results appeared, and the host recovered after reload.
- 190 tests passed, including invite-only relay-to-match integration, simultaneous Postgres claims, ownership through refresh, lease expiration, and renewal.
- App and worker TypeScript checks passed.

Production still requires shared signaling storage (`DATABASE_URL`) when serving multiple processes; the in-memory store is for a single development server. The optional Cloudflare match-server transport is unchanged.
