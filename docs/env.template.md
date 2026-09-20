# Environment

Do not commit secrets. The platform injects `DATABASE_URL` on deploy.

Optional:

```
VITE_STUN_URLS=stun:stun.l.google.com:19302,stun:stun.cloudflare.com:3478
# Server-authoritative online play (workers/match). Leave unset to keep P2P.
VITE_MATCH_SERVER_URL=https://atlas-duel-match.<account>.workers.dev
```

No Google / Mapillary / Higgsfield keys are used in the launch build.
