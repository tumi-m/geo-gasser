# Round winners by name, and no repeated locations

## New: who took the round

Every reveal now ends with the round's result, by name. Each player's points
for the round count up while their bars race each other; then the winner's
row is crowned (trophy, accent border), the headline reads "Tumi takes the
round" or "Dead heat", and the match totals roll over from the old total to
the new one, with who leads and by how much. Solo rounds show your own row
the same way. Animated with transform and opacity only (no filters, see the
results-screen fix), and instant with reduced motion.

The logic is in `src/lib/game/verdict.ts` (winner, dead heat, leader, bar
shares, own row first) with four unit tests.

## Names everywhere

- The first time someone taps "Let's explore" the game asks "What should we
  call you?" — once, skippable. The duel page already asked; now solo does too.
  Most solo players were playing as "Traveler".
- Your pin on the map carries your name at the reveal (was "YOU"), the answer
  pin reads "Answer" (was "TRUE"), and the in-match score tally shows names
  (was "You").
- Pin labels no longer stack when guesses land close together: yours sits
  above, the opponent's below, the answer's to the right.

## Fixed: locations repeating between games

Measured before the fix, by playing games back to back and feeding each one's
sites into the next as "seen": **4 repeats within 25 default games, on every
seed tried**, even with perfect memory of every past game. Three causes:

1. The seen list was capped at 60 sites (the pool is 149), so after about 12
   default games everything was fair game again.
2. Sites were recorded only when a match *finished*. Leave halfway, reload, or
   lose the connection, and nothing was recorded, so the next game could open
   on the same place.
3. The default 5-round dealer held the South Africa / Netherlands split exact.
   When one country's unseen sites ran low it repeated a recent one rather
   than take an unseen site from the other, and once fewer than five unseen
   sites were left it dealt from the whole pool at random.

Now every mode ranks sites the same way: unseen first (shuffled and spread
across cities), then the ones seen longest ago. The country mix gives way
before anything repeats. The seen list holds 400 sites, every site is
recorded the moment it is on screen (a guest in an online duel records it at
the reveal), and match seeds come from `crypto.getRandomValues`.

`src/lib/game/no-repeat.test.ts` plays whole sessions: 25 default games (125
sites) with no repeats on three seeds, world-tour and standard games likewise,
no site twice in one match across every length, and — once the pool is used
up — the next game deals from the oldest sites, never the last five games'.

## Verification

Browser, 390 × 844:

- two rounds against Grok as "Tumi": own row first and tagged, Grok named,
  one row crowned, the headline and lead correct, the HUD tally by name, each
  site recorded as it was shown (1 → 2);
- solo: the name prompt on first play, not on the second; "Tumi" on the pin
  and the tally; eight games quit after one question opened on eight
  different locations.

`test:game`, `typecheck`, `typecheck:worker`, `lint` and `build` pass.
