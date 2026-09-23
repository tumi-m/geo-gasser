import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { MusicProvider } from "@/lib/music/music-context";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { MusicPlayer } from "@/components/game/music-player";
import appCss from "../styles.css?url";

const APP_NAME = "ATLAS DUEL";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#101b24" },
      {
        name: "description",
        content: "Look around. Follow the clues. Find your place in the world. Play solo or challenge a friend in Atlas Duel.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&family=Syne:wght@500;600;700;800&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg antialiased">
        <PreviewHostBridge />
        <AuthProvider>
          {/* Beside the outlet, not inside a screen: routes and match phases
              swap whole trees, and the player must survive all of them. */}
          <MusicProvider>
            <Outlet />
            <MusicPlayer />
          </MusicProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
