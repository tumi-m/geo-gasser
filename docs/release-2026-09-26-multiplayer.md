# Invite-only multiplayer room recovery

## Reproduced failure

On production, opening the same `/duel/:code` directly in two fresh browser tabs left both clients on “Waiting for opponent”, with no player list or Start match button. Creating a room through the lobby worked. Host ownership depended on the router's transient `state.host` flag, which an invite URL does not carry.

## Fix

The signaling service now assigns a single host when a room is first joined. Postgres uses an atomic UPSERT, so simultaneous requests to separate server instances agree on the owner. Local development uses the equivalent memory lease. The host's polls renew ownership; guest polls cannot perpetuate an abandoned host. A two-minute grace period preserves ownership while the host reloads. The existing session cache restores its match.

Both direct invite links and normal lobby navigation use this assignment. Guests reject snapshots from another assigned owner. The lobby distinguishes joining from waiting for an opponent and tells seated guests when the host can start.

## Validation

- Reproduced the original two-client failure on the live Vercel app.
- Two local invite-only browser clients: both seated, host started the match, both guessed and locked, matching round results appeared, and the host recovered after reload.
- 192 tests passed, including invite-only relay-to-match integration, simultaneous Postgres claims, ownership through refresh, lease expiration, and renewal.
- App and worker TypeScript checks passed.

Production still requires shared signaling storage (`DATABASE_URL`) when serving multiple processes; the in-memory store is for a single development server. The optional Cloudflare match-server transport is unchanged.

## Production finding

After the first deployment, an eight-client concurrent live probe returned four different hosts and inconsistent rosters for the same test room. Vercel's environment-variable screen confirmed **no variables configured**. The relay was therefore using isolated process memory, which cannot coordinate Vercel functions. This is a separate deployment issue from the missing navigation host flag.

The app now supports both `DATABASE_URL` and Vercel's `POSTGRES_URL` alias consistently in its database client, relay, and migrator. A Vercel deployment with neither variable returns an explicit unavailable response instead of silently creating separate rooms. Production requires provisioning shared Postgres and redeploying; the code-only deployment is not a completed multiplayer repair.

A Neon **Free** database is now connected to this project. Vercel shows `DATABASE_URL` and `POSTGRES_URL` assigned to Production and Preview. A fresh deployment is required to activate these settings.

## Verified production recovery

Deployment `b013ea7` activated the shared database and completed successfully on Vercel. Repeating the eight-client concurrent test returned the same host to all eight clients and a complete shared roster of eight peers.

Two fresh live browser clients opened the same invite directly, saw both players, started round one, placed and locked guesses, and received matching results (6,250 and 5,994). Both clients were then refreshed; the scores and match were restored. The guest's Continue action advanced both clients into round two. The host client reported no runtime console errors during this check.
