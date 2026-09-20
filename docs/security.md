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
- [ ] Dedicated anti-cheat / ranked matchmaking (not in launch)
