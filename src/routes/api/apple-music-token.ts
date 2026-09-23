import { createFileRoute } from "@tanstack/react-router";
import { handleAppleMusicToken } from "@/lib/music/apple-token.server";

export const Route = createFileRoute("/api/apple-music-token")({
  server: { handlers: { GET: ({ request }) => handleAppleMusicToken(request) } },
});
