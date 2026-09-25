import { useEffect, useRef, useState } from "react";
import { ExternalLink, Music, Pause, Play, RotateCcw, SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { embedHeight, parseMusicLink, type MusicLink, type MusicProvider } from "@/lib/music/links";
import { useMusic } from "@/lib/music/use-music";
import type { PlaylistRow, SessionStatus } from "@/lib/music/types";
import { cn } from "@/lib/utils";

/**
 * The player's own soundtrack. Mounted once in the root route, beside the
 * route outlet, so music keeps playing from menus into matches and between
 * them. The panel is hidden rather than unmounted when closed: the embed player
 * inside it is what is making the sound.
 */

const NAME: Record<MusicProvider, string> = { spotify: "Spotify", apple: "Apple Music" };

const HOUSE_MIX: Record<MusicProvider, MusicLink | null> = {
  spotify: parseMusicLink(import.meta.env.VITE_SPOTIFY_HOUSE_PLAYLIST ?? ""),
  apple: parseMusicLink(import.meta.env.VITE_APPLE_MUSIC_HOUSE_PLAYLIST ?? ""),
};

const linkLabel = (link: MusicLink) => `${NAME[link.provider]} ${link.kind}`;

/** The music buttons that can open the panel; the visible one anchors it. */
const OPENERS = 'button[aria-controls="music-panel"]';

function visibleOpener(): HTMLElement | null {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.matches(OPENERS)) return active;
  for (const el of document.querySelectorAll<HTMLElement>(OPENERS)) {
    const r = el.getBoundingClientRect();
    if (r.width && r.height && r.bottom > 0 && r.top < window.innerHeight) return el;
  }
  return null;
}

export function MusicPlayer() {
  const m = useMusic();
  const dockRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // Closed ≠ unmounted: keep it out of the tab order and the a11y tree instead.
  // On open, drop the panel from just under the header button that opened it —
  // there is no floating control, so nothing ever sits over a page's content.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    panel.toggleAttribute("inert", !m.open);
    if (!m.open) return;
    const opener = visibleOpener();
    openerRef.current = opener;
    const bottom = opener?.getBoundingClientRect().bottom ?? 0;
    dockRef.current?.style.setProperty("--music-top", `${Math.max(12, Math.round(bottom + 8))}px`);
    panel.focus({ preventScroll: true });
  }, [m.open]);

  const returnFocus = () =>
    (openerRef.current?.isConnected ? openerRef.current : visibleOpener())?.focus();

  const { open, setOpen } = m;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      returnFocus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const close = () => {
    m.setOpen(false);
    returnFocus();
  };

  return (
    <div ref={dockRef} className="music-dock">
      <section
        ref={panelRef}
        id="music-panel"
        tabIndex={-1}
        aria-label="Music"
        aria-hidden={!m.open}
        className={cn("music-panel", m.open && "is-open")}
      >
        <header className="music-header">
          <div>
            <p className="eyebrow">
              <Music size={12} /> YOUR SOUNDTRACK
            </p>
            <h2>Play your music.</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={close} aria-label="Close music">
            <X size={18} />
          </Button>
        </header>
        <ProviderTabs />
        <div className="music-content">
          {/* First and stably keyed: switching tabs must never remount the
              player that is making the sound. */}
          {m.embed && <EmbedPlayer key={m.embed.embedUrl} link={m.embed} onStop={m.stopEmbed} />}
          {m.nowPlaying && <NowPlayingCard />}
          {m.tab === "spotify" ? <SpotifyAccount /> : <AppleAccount />}
          <HouseMix provider={m.tab} />
          <PasteLink />
          <Recent />
          <DevHint />
        </div>
      </section>
    </div>
  );
}

/** The music control in every screen's header (home, duel, match HUD, lobby, results). */
export function MusicHudButton() {
  const m = useMusic();
  const label = m.nowPlaying
    ? `Music: ${m.nowPlaying.title} by ${m.nowPlaying.artist}`
    : m.embed
      ? `Music: ${linkLabel(m.embed)}`
      : "Music";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-expanded={m.open}
      aria-controls="music-panel"
      title={label}
      onClick={() => m.setOpen(!m.open)}
      className="relative"
    >
      {m.active ? <LevelBars active /> : <Music size={18} />}
    </Button>
  );
}

/** Settings → Sound: where players already look for audio. */
export function MusicSettingsSection({ onOpenPlayer }: { onOpenPlayer: () => void }) {
  const m = useMusic();
  const playing = m.nowPlaying
    ? `${m.nowPlaying.title} — ${m.nowPlaying.artist}`
    : m.embed
      ? linkLabel(m.embed)
      : null;
  return (
    <div className="settings-toggle">
      <div>
        <strong>Your music</strong>
        <small>
          {playing
            ? `Playing: ${playing}`
            : "Play your own Spotify or Apple Music while you play. It keeps going between rounds."}
        </small>
      </div>
      <Button variant="secondary" onClick={onOpenPlayer}>
        <Music size={15} />
        {playing ? "Music player" : "Choose music"}
      </Button>
    </div>
  );
}

function TransportButtons() {
  const m = useMusic();
  if (!m.nowPlaying) return null;
  return (
    <>
      <button
        type="button"
        className="view-mode-button music-transport"
        onClick={m.togglePlayback}
        aria-label={m.nowPlaying.playing ? "Pause music" : "Play music"}
      >
        {m.nowPlaying.playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <button
        type="button"
        className="view-mode-button music-transport"
        onClick={m.nextTrack}
        aria-label="Next track"
      >
        <SkipForward size={14} />
      </button>
    </>
  );
}

/** Three bars that move only while something is playing. */
function LevelBars({ active }: { active: boolean }) {
  return (
    <span aria-hidden className={cn("music-bars", active && "is-playing")}>
      <i />
      <i />
      <i />
    </span>
  );
}

function ProviderTabs() {
  const { tab, setTab } = useMusic();
  const tabs: MusicProvider[] = ["spotify", "apple"];
  return (
    <div className="music-tabs" role="tablist" aria-label="Music service">
      {tabs.map((t, index) => (
        <button
          key={t}
          id={`music-tab-${t}`}
          type="button"
          role="tab"
          aria-selected={tab === t}
          tabIndex={tab === t ? 0 : -1}
          onClick={() => setTab(t)}
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();
            const next = tabs[(index + 1) % tabs.length];
            setTab(next);
            document.getElementById(`music-tab-${next}`)?.focus();
          }}
        >
          {NAME[t]}
        </button>
      ))}
    </div>
  );
}

function EmbedPlayer({ link, onStop }: { link: MusicLink; onStop: () => void }) {
  const spotify = link.provider === "spotify";
  return (
    <div className="music-card">
      <div className="music-card-head">
        <span className="music-label">Now playing · {linkLabel(link)}</span>
        <button type="button" className="music-text-button" onClick={onStop}>
          Stop
        </button>
      </div>
      <iframe
        title={`${NAME[link.provider]} player`}
        src={link.embedUrl}
        height={embedHeight(link)}
        className="music-embed"
        // Permission and sandbox values from each provider's own embed snippet.
        allow={
          spotify
            ? "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            : "autoplay *; encrypted-media *; fullscreen *; clipboard-write"
        }
        sandbox={
          spotify
            ? undefined
            : "allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
        }
      />
      <div className="music-card-foot">
        <small>
          Playing in {NAME[link.provider]}’s own player — what you hear depends on your account
          there.
        </small>
        <a
          href={link.openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="music-text-button"
        >
          Open <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}

function NowPlayingCard() {
  const { nowPlaying: np } = useMusic();
  if (!np) return null;
  return (
    <div className="music-card">
      <span className="music-label">Now playing · {NAME[np.provider]}</span>
      <div className="music-now">
        <Artwork src={np.image} />
        <div className="min-w-0">
          <strong>{np.title}</strong>
          <small>{np.artist}</small>
        </div>
        <TransportButtons />
      </div>
    </div>
  );
}

function Artwork({ src }: { src?: string }) {
  return src ? (
    <img src={src} alt="" className="music-art" loading="lazy" />
  ) : (
    <span aria-hidden className="music-art is-empty">
      <Music size={14} />
    </span>
  );
}

function PlaylistList<T extends PlaylistRow>({
  rows,
  onPick,
  empty,
}: {
  rows: T[];
  onPick: (row: T) => void;
  empty: string;
}) {
  if (!rows.length) return <p className="music-note">{empty}</p>;
  return (
    <ul className="music-list">
      {rows.map((row) => (
        <li key={row.id}>
          <button type="button" onClick={() => onPick(row)}>
            <Artwork src={row.image} />
            <span>{row.name}</span>
            <Play size={13} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

function AccountBlock({
  provider,
  status,
  message,
  onConnect,
  onDisconnect,
  signedInWhenBroken,
  intro,
  children,
}: {
  provider: MusicProvider;
  status: SessionStatus;
  message: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  /** Whether an `error` still leaves an account signed in (so offer sign-out). */
  signedInWhenBroken: boolean;
  intro: string;
  children?: React.ReactNode;
}) {
  // Not configured on this deployment: offer nothing that cannot work.
  if (status === "off") return null;
  const name = NAME[provider];
  return (
    <div className="music-account">
      {status === "signed-out" && (
        <>
          <Button className="w-full" onClick={onConnect}>
            Connect {name}
          </Button>
          <p className="music-note">{intro}</p>
        </>
      )}
      {status === "starting" && <p className="music-note">Connecting to {name}…</p>}
      {(status === "ready" || status === "error") && (
        <>
          <div className="music-card-head">
            <span className="music-label">
              {status === "ready" ? "Your playlists" : `${name} unavailable`}
            </span>
            {(status === "ready" || signedInWhenBroken) && (
              <button type="button" className="music-text-button" onClick={onDisconnect}>
                Disconnect
              </button>
            )}
          </div>
          {children}
        </>
      )}
      {message && (
        <p role="status" className="settings-notice">
          {message}
        </p>
      )}
    </div>
  );
}

function SpotifyAccount() {
  const { spotify, playSpotify } = useMusic();
  return (
    <AccountBlock
      provider="spotify"
      status={spotify.status}
      message={spotify.message}
      onConnect={spotify.connect}
      onDisconnect={spotify.disconnect}
      signedInWhenBroken
      intro="Plays here with Spotify Premium. On a free account, paste a link below to use Spotify’s own player."
    >
      {spotify.status === "ready" && (
        <PlaylistList
          rows={spotify.playlists}
          empty="No playlists on this account yet."
          onPick={(playlist) => playSpotify(playlist.uri)}
        />
      )}
    </AccountBlock>
  );
}

function AppleAccount() {
  const { apple, playApple } = useMusic();
  return (
    <AccountBlock
      provider="apple"
      status={apple.status}
      message={apple.message}
      onConnect={apple.connect}
      onDisconnect={apple.disconnect}
      signedInWhenBroken={false}
      intro="Plays here with an Apple Music subscription. Without one, paste a link below to use Apple’s own player."
    >
      {apple.status === "ready" && (
        <>
          {apple.previewOnly && (
            <p className="music-note">
              This account has no Apple Music subscription, so tracks play as previews.
            </p>
          )}
          <PlaylistList
            rows={apple.playlists}
            empty="No playlists in this library yet."
            onPick={(row) => playApple({ playlist: row.id })}
          />
        </>
      )}
    </AccountBlock>
  );
}

function HouseMix({ provider }: { provider: MusicProvider }) {
  const { playLink } = useMusic();
  const link = HOUSE_MIX[provider];
  if (!link || link.provider !== provider) return null;
  return (
    <button type="button" className="settings-choice music-house" onClick={() => playLink(link)}>
      <Music size={16} />
      <span>
        <strong>Atlas Duel mix</strong>
        <small>The game’s own playlist on {NAME[provider]}.</small>
      </span>
    </button>
  );
}

function PasteLink() {
  const { tab, setTab, playLink } = useMusic();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="music-paste"
      onSubmit={(e) => {
        e.preventDefault();
        const link = parseMusicLink(value);
        if (!link) {
          setError("That isn’t a Spotify or Apple Music link.");
          return;
        }
        setError(null);
        setValue("");
        setTab(link.provider);
        playLink(link);
      }}
    >
      <label htmlFor="music-link" className="music-label">
        Paste a playlist, album or track link
      </label>
      <div className="music-paste-row">
        <Input
          id="music-link"
          // Chromium's autofill stamps an empty style attribute on this field
          // before hydration; that attribute is the browser's, not ours.
          suppressHydrationWarning
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder={
            tab === "spotify" ? "open.spotify.com/playlist/…" : "music.apple.com/…/playlist/…"
          }
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "music-link-error" : undefined}
        />
        <Button type="submit" disabled={!value.trim()}>
          Play
        </Button>
      </div>
      {error && (
        <p id="music-link-error" role="alert" className="music-error">
          {error}
        </p>
      )}
    </form>
  );
}

function Recent() {
  const { recent, embed, playLink } = useMusic();
  if (!recent || recent.embedUrl === embed?.embedUrl) return null;
  return (
    <button
      type="button"
      className="music-text-button music-recent"
      onClick={() => playLink(recent)}
    >
      <RotateCcw size={12} /> Play again · {linkLabel(recent)}
    </button>
  );
}

/** Setup hint for whoever runs the game. Never shown in a production build. */
function DevHint() {
  const { tab, spotify, apple } = useMusic();
  if (!import.meta.env.DEV) return null;
  const off = tab === "spotify" ? spotify.status === "off" : apple.status === "off";
  if (!off) return null;
  return (
    <p className="music-dev">
      Dev ·{" "}
      {tab === "spotify"
        ? "Connect is hidden: set VITE_SPOTIFY_CLIENT_ID (see docs/env.template.md)."
        : "Connect is hidden: set the APPLE_MUSIC_* variables (see docs/env.template.md)."}{" "}
      Pasted links work without either.
    </p>
  );
}
