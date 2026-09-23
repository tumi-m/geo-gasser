# Security checklist

- [x] Guest play, no accounts
- [x] Display names sanitised
- [x] Answer coordinates omitted from public snapshots until reveal
- [x] Scene files named by opaque ids (`loc_NN.jpg`)
- [x] Scores computed in the engine, not trusted from the client payload (solo) / host receipt time (duel)
- [x] Signaling payloads schema-validated and size-capped
- [x] Invite codes alphanumeric, 6 chars
- [x] No provider secrets in the client
- [x] P2P trust model: private rooms among people who chose to play together, not ranked strangers
- [x] Music: the Apple MusicKit private key stays server-side (`apple-token.server.ts`); the endpoint returns only a short-lived signed developer token, and a malformed key is reported without echoing it
- [x] Music: Spotify sign-in uses PKCE with a random `state`; a mismatched state is refused and its code never exchanged; the callback query is stripped from the URL
- [x] Music: pasted and stored links are re-parsed before use, and embed URLs are rebuilt from validated ids on fixed hosts, so no user text becomes an iframe `src`
- [ ] Dedicated anti-cheat / ranked matchmaking (not in launch)
