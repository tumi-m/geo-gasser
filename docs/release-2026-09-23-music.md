# Results screen fix, and your own music

## Fixed

- **The results screen rendered blurred on iPhone, with a magenta line under
  the score.** The shared entrance animation (`.atlas-rise`) faded in from
  `filter: blur(4px)` to `filter: blur(0)` with `animation-fill-mode: both`,
  so every element that used it kept a filter after it had arrived. A filtered
  element is drawn as its own layer, and iOS Safari rasterises a tall one at
  reduced resolution: the round-by-round list (the tallest such element) came
  out soft, and the magenta line was a seam along the top of that layer. The
  stat tiles below it were sharp because they do not animate, which pointed
  straight at the cause.

  The animation now uses opacity and a 12px lift only, with
  `fill-mode: backwards`: the start frame holds through the stagger delay, and
  nothing stays on the element once it has arrived. Measured in Chromium after
  finishing a real match: every animated element on the results screen reports
  `filter: none` and `transform: none`. The same animation is used by the
  waiting screen and the reveal card, which are fixed by the same change.

## New: your music

Play your own soundtrack while you play. The music button sits in every
screen's header (home, duel setup, match HUD, lobby, results) and in
Settings → Sound. The panel opens directly under the button that opened it;
nothing floats over the scene, the map or a scrolling score list.

- **Paste a link** — any Spotify or Apple Music playlist, album or track plays
  in the service's official embed player. No keys, works on every deployment.
- **Connect Spotify** — sign in (PKCE, no secret), pick a playlist, and it
  plays in the page through the Web Playback SDK, with play/pause and next.
  Needs Spotify Premium; free accounts are told so and pointed at the link
  player.
- **Connect Apple Music** — sign in through MusicKit and play from your
  library. The developer token is minted server-side by
  `/api/apple-music-token`.
- The player lives in the root route, so music carries on from the menu into
  a match, through reveals and rounds, and into the next match.

Both account options stay hidden until configured; see
`docs/env.template.md`. Under test, the player shows up in Spotify's device
list as "Atlas Duel".

## Verification

Browser checks at 390 × 844 (phone) and 1280 × 800, with stand-ins for the
Spotify, Apple and embed hosts (the sandbox cannot reach them):

- layout: 18/18 — no floating control on any screen, the panel drops from
  its header button on home, duel, the match HUD, settings and results, and
  the same player keeps playing from home through a whole match to results;
- Spotify: 32/32 — authorize parameters, the PKCE verifier matches the
  challenge, no secret, clean callback URL, playlists, device-targeted play,
  Premium 403, token refresh, disconnect, denied consent, forged state;
- Apple Music: 19/19 — the real `/api/apple-music-token` route signs a token
  MusicKit is configured with, authorize runs from the click, library
  playlists, queue and play, pause, one source at a time, disconnect.

Unit tests: link parsing, PKCE (including the RFC 7636 test vector) and
developer-token signing (verified against the public key, tamper rejected).

## Worth a decision, not changed here

**The Atmosphere slider does nothing.** Settings → Sound has an Atmosphere
volume, but `audio.startAmbience()` is never called, so no ambience ever
plays. Either wire it up or remove the slider.
