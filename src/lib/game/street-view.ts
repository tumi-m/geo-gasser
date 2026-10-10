import { getLocation } from "./locations.ts";
import type { LatLng, SceneInfo } from "./types.ts";

/**
 * Google Street View for the photo rounds: start near the place and walk
 * around it, the way GeoGuessr plays. Needs a browser key for the Maps
 * JavaScript API in `VITE_GOOGLE_MAPS_KEY` (docs/env.template.md); without one
 * the rounds use the bundled photographs, as before.
 */

export function streetViewKey(): string {
  try {
    return ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_GOOGLE_MAPS_KEY ?? "").trim();
  } catch {
    return "";
  }
}

/**
 * Where to look for a panorama for the scene on screen. The host knows the
 * location; a guest finds it from the plate the scene already names, so
 * Street View sends nothing new over the wire.
 */
export function streetViewTarget(scene: SceneInfo | undefined, known?: { id: string; latitude: number; longitude: number; sceneKind?: string; country?: string }): LatLng | null {
  if (!scene || (scene.kind !== "photo" && scene.kind !== "street")) return null;
  if (known) {
    if (known.country === "SPACE" || (known.sceneKind !== "wikimedia" && known.sceneKind !== "street")) return null;
    return { latitude: known.latitude, longitude: known.longitude };
  }
  if (scene.kind === "street") {
    const loc = getLocation(scene.src.replace(/^street:/, ""));
    return loc ? { latitude: loc.latitude, longitude: loc.longitude } : null;
  }
  for (const url of [scene.src, ...scene.fallbacks]) {
    const id = url.match(/^\/locations\/(loc_[A-Za-z0-9_]+)\.jpg$/)?.[1];
    const loc = id ? getLocation(id) : undefined;
    if (loc && loc.sceneKind === "wikimedia") return { latitude: loc.latitude, longitude: loc.longitude };
  }
  return null;
}

/** Same starting direction for every player in a duel; varies per place. */
export function startHeading(target: LatLng): number {
  const h = Math.sin(target.latitude * 12.9898 + target.longitude * 78.233) * 43758.5453;
  return Math.floor((h - Math.floor(h)) * 360);
}

/** The slice of the Maps JavaScript API that Street View play uses. */
export interface StreetViewPanoramaLike {
  setPano(id: string): void;
  setPov(pov: { heading: number; pitch: number }): void;
  setZoom(zoom: number): void;
  getPano(): string;
  addListener(event: string, fn: () => void): { remove(): void };
}
export interface GoogleMapsLike {
  StreetViewService: new () => {
    getPanorama(
      request: {
        location: { lat: number; lng: number };
        radius: number;
        source?: string;
        sources?: string[];
        preference?: string;
      },
    ): Promise<{ data: { location?: { pano?: string } } }>;
  };
  StreetViewPanorama: new (el: HTMLElement, options: Record<string, unknown>) => StreetViewPanoramaLike;
  /** GOOGLE: Google's own imagery only, never visitors' photospheres. */
  StreetViewSource?: { OUTDOOR: string; GOOGLE?: string };
  StreetViewPreference?: { NEAREST: string };
  ControlPosition?: { LEFT_CENTER: number };
}

let loader: Promise<GoogleMapsLike> | null = null;

/** Load the Maps JavaScript API once; rejects if it cannot load or the key is refused. */
export function loadGoogleMaps(key: string): Promise<GoogleMapsLike> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const w = window as Window & { google?: { maps?: GoogleMapsLike }; __atlasMapsReady?: () => void; gm_authFailure?: () => void };
  if (w.google?.maps?.StreetViewPanorama) return Promise.resolve(w.google.maps);
  loader ??= new Promise<GoogleMapsLike>((resolve, reject) => {
    const fail = (why: string) => {
      loader = null;
      reject(new Error(why));
    };
    w.__atlasMapsReady = () => {
      const g = w.google?.maps as
        | (GoogleMapsLike & { importLibrary?: (name: string) => Promise<Record<string, unknown>> })
        | undefined;
      if (!g) return fail("maps missing");
      // Loaded with loading=async, Street View's classes come from
      // importLibrary; google.maps alone may not carry them yet.
      const libraries = g.importLibrary
        ? Promise.all([g.importLibrary("streetView"), g.importLibrary("core")])
        : Promise.resolve([{}, {}]);
      libraries
        .then(([streetView, core]) => {
          const maps = { ...g, ...core, ...streetView } as GoogleMapsLike;
          if (maps.StreetViewService && maps.StreetViewPanorama) resolve(maps);
          else fail("street view library missing");
        })
        .catch((error: unknown) => fail(`street view library failed: ${String(error)}`));
    };
    // Google calls this when the key is invalid or not allowed for this site.
    listenForMapsErrors();
    w.gm_authFailure = () => {
      console.warn(
        "Google refused the Maps key; the photos take over for this session. Google's own error above names the cause (RefererNotAllowedMapError: add this site to the key; BillingNotEnabledMapError: attach billing; ApiNotActivatedMapError: enable the Maps JavaScript API).",
      );
      markStreetViewBroken(lastMapsError);
      window.dispatchEvent(new Event("atlas-maps-auth-failure"));
      fail("key refused");
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=__atlasMapsReady`;
    s.async = true;
    s.onerror = () => fail("script failed");
    document.head.appendChild(s);
  });
  return loader;
}

const BROKEN_KEY = "atlas-street-view-broken";

// Google names why it refused a key only in a console message
// ("Google Maps JavaScript API error: RefererNotAllowedMapError …"), and a
// reload wipes the console. Keep the code so Settings can say it.
let lastMapsError = "";
let listening = false;
function listenForMapsErrors(): void {
  if (listening || typeof console === "undefined") return;
  listening = true;
  for (const level of ["error", "warn"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      const code = String(args[0] ?? "").match(/Google Maps JavaScript API (?:error|warning): (\w+)/)?.[1];
      if (code && level === "error") {
        lastMapsError = code;
        // The refusal may already be recorded; give it its reason.
        if (readBroken() !== null) markStreetViewBroken(code);
      }
      original(...args);
    };
  }
}

function readBroken(): string | null {
  try {
    return sessionStorage.getItem(BROKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * May new matches include Street View-only places? Yes when a key is set and
 * Google has not refused it this session (a refused key would leave those
 * rounds with nothing to show).
 */
export function streetViewUsable(): boolean {
  return Boolean(streetViewKey()) && readBroken() === null;
}

/** Google refused the key: Street View stays off for this tab. */
export function markStreetViewBroken(reason = ""): void {
  try {
    sessionStorage.setItem(BROKEN_KEY, reason || "refused");
  } catch {
    /* private mode: the next refusal says so again */
  }
}

export type StreetViewStatus =
  | { state: "on" }
  | { state: "no-key" }
  | { state: "refused"; reason: string };

/** Where Street View stands in this tab, for Settings to show. */
export function streetViewStatus(): StreetViewStatus {
  if (!streetViewKey()) return { state: "no-key" };
  const broken = readBroken();
  if (broken === null) return { state: "on" };
  return { state: "refused", reason: broken === "refused" || broken === "1" ? "" : broken };
}

/** Forget a refusal and reload, so Google checks the key afresh. */
export function retryStreetView(): void {
  try {
    sessionStorage.removeItem(BROKEN_KEY);
  } catch {
    /* nothing stored */
  }
  window.location.reload();
}

/** Google's error code, in words, with what to change. */
export function explainMapsError(code: string, host: string): string {
  switch (code) {
    case "RefererNotAllowedMapError":
      return `The key is not allowed on this site. In Google Cloud, open the key and add https://${host}/* under Website restrictions.`;
    case "BillingNotEnabledMapError":
      return "Billing is not attached to the key's Google Cloud project.";
    case "ApiNotActivatedMapError":
      return "The Maps JavaScript API is not enabled on the key's project.";
    case "ApiTargetBlockedMapError":
      return "The key's API restrictions leave out the Maps JavaScript API.";
    case "InvalidKeyMapError":
      return "Google does not recognise the key. Check VITE_GOOGLE_MAPS_KEY in Vercel, then redeploy.";
    case "ExpiredKeyMapError":
    case "DeletedApiProjectMapError":
      return "The key or its project no longer exists. Create a new key and update VITE_GOOGLE_MAPS_KEY.";
    case "":
      return "Google refused the key without saying why. Check the key's website and API restrictions and billing.";
    default:
      return `Google refused the key (${code}).`;
  }
}
