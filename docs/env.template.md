# Environment

Do not commit secrets. The platform injects `DATABASE_URL` on deploy.

Optional:

```
VITE_STUN_URLS=stun:stun.l.google.com:19302,stun:stun.cloudflare.com:3478
# Server-authoritative online play (workers/match). Leave unset to keep P2P.
VITE_MATCH_SERVER_URL=https://atlas-duel-match.<account>.workers.dev
# Mapillary street-level imagery (public client token). Unset = bundled stills.
VITE_MAPILLARY_TOKEN=
```

### Music (Settings → Sound → Your music, or the music button in any header)

Pasted Spotify / Apple Music links always work: they play in each service's own
embed player and need no keys. The values below add "Connect" sign-in.

```
# Spotify app client id (developer.spotify.com/dashboard). Public; PKCE, no secret.
VITE_SPOTIFY_CLIENT_ID=
# Optional. Must match a Redirect URI on the Spotify app exactly.
# Default: the site origin with a trailing slash, e.g. https://geo-gasser.vercel.app/
VITE_SPOTIFY_REDIRECT_URI=

# Apple Music: a MusicKit key from developer.apple.com (Keys → Media Services).
# Server-only — never prefix these with VITE_. The .p8 can be pasted with its
# newlines escaped as \n. /api/apple-music-token signs 12-hour developer tokens.
APPLE_MUSIC_TEAM_ID=
APPLE_MUSIC_KEY_ID=
APPLE_MUSIC_PRIVATE_KEY=
# Optional, recommended: comma-separated origins the token is valid for.
APPLE_MUSIC_ALLOWED_ORIGINS=https://geo-gasser.vercel.app

# Optional "house mix" offered one tap away in the player.
VITE_SPOTIFY_HOUSE_PLAYLIST=https://open.spotify.com/playlist/...
VITE_APPLE_MUSIC_HOUSE_PLAYLIST=https://music.apple.com/...
```

Spotify's Web Playback SDK plays in the page only for Premium accounts; free
accounts are told so and pointed at the pasted-link player.

No Google / Higgsfield keys are used in the launch build.
