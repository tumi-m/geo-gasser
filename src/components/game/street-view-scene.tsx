import { Footprints, LocateFixed } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  loadGoogleMaps,
  startHeading,
  streetViewKey,
  type LatLng,
  type StreetViewPanoramaLike,
} from "@/lib/game";
import { cn } from "@/lib/utils";

/**
 * Walk around the place, GeoGuessr style: the nearest Google Street View
 * panorama, with the arrows and click-to-go to move along the street. Road
 * names, the address card and every link to Google Maps are off, so the
 * scene shows the place and never names it. If there is no coverage nearby,
 * or the key is refused, `onUnavailable` hands the round back to the photo.
 */
export function StreetViewScene({
  target,
  wide = false,
  interactive = true,
  showHints = true,
  onReady,
  onUnavailable,
  className,
}: {
  target: LatLng;
  /** Street View is the only scene: search further before giving up. */
  wide?: boolean;
  interactive?: boolean;
  /** A first-look hint on how to move, until the player moves or looks around. */
  showHints?: boolean;
  /** The panorama is on screen. */
  onReady?: () => void;
  onUnavailable: () => void;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const panoRef = useRef<StreetViewPanoramaLike | null>(null);
  const startRef = useRef<{ pano: string; heading: number } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [moved, setMoved] = useState(false);
  const [looked, setLooked] = useState(false);
  const failRef = useRef(onUnavailable);
  failRef.current = onUnavailable;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    let alive = true;
    const fail = () => alive && failRef.current();
    window.addEventListener("atlas-maps-auth-failure", fail);
    (async () => {
      const maps = await loadGoogleMaps(streetViewKey());
      const service = new maps.StreetViewService();
      const location = { lat: target.latitude, lng: target.longitude };
      // Google's own street imagery only, never visitors' uploaded
      // photospheres (those can be anything: a bird, a room, a selfie).
      // `sources: [GOOGLE]` is the current form; if Google rejects it, fall
      // back to outdoor imagery rather than lose Street View altogether.
      const sv = maps.StreetViewSource;
      const filters: Record<string, unknown>[] = [
        ...(sv?.GOOGLE ? [{ sources: [sv.GOOGLE] }] : []),
        sv?.OUTDOOR ? { source: sv.OUTDOOR } : {},
      ];
      const preference = maps.StreetViewPreference ? { preference: maps.StreetViewPreference.NEAREST } : {};
      // Closest first, widening to a short drive for street-only places.
      const radii = [120, 600, 1500, ...(wide ? [5000] : [])];
      let pano: string | undefined;
      let why = `no panorama within ${radii[radii.length - 1]} m`;
      search: for (const filter of filters) {
        for (const radius of radii) {
          try {
            const { data } = await service.getPanorama({ location, radius, ...filter, ...preference });
            pano = data.location?.pano;
          } catch (error) {
            pano = undefined;
            const code = String((error as { code?: string })?.code ?? (error as Error)?.message ?? error);
            // "Nothing here" means try further out; anything else means this
            // request shape is refused, so try the next filter.
            if (!/ZERO_RESULTS/.test(code)) {
              why = `request refused (${code.slice(0, 120)})`;
              continue search;
            }
          }
          if (pano || !alive) break search;
        }
        break;
      }
      if (!alive) return;
      if (!pano || !hostRef.current) {
        console.warn(`Street View unavailable at ${location.lat.toFixed(4)},${location.lng.toFixed(4)}: ${why}`);
        return fail();
      }
      const heading = startHeading(target);
      startRef.current = { pano, heading };
      const panorama = new maps.StreetViewPanorama(hostRef.current, {
        pano,
        pov: { heading, pitch: 0 },
        zoom: 0,
        addressControl: false,
        showRoadLabels: false,
        fullscreenControl: false,
        enableCloseButton: false,
        motionTracking: false,
        motionTrackingControl: false,
        imageDateControl: false,
        linksControl: true,
        clickToGo: true,
        panControl: true,
        zoomControl: true,
        // Google puts these bottom-right, under the map panel; the left
        // edge of the scene is clear.
        ...(maps.ControlPosition
          ? {
              panControlOptions: { position: maps.ControlPosition.LEFT_CENTER },
              zoomControlOptions: { position: maps.ControlPosition.LEFT_CENTER },
            }
          : {}),
        scrollwheel: true,
      });
      panoRef.current = panorama;
      panorama.addListener("pano_changed", () => {
        const away = panorama.getPano() !== startRef.current?.pano;
        setMoved(away);
        if (away) setLooked(true);
      });
      panorama.addListener("pov_changed", () => setLooked(true));
      setStatus("ready");
      readyRef.current?.();
    })().catch((error: unknown) => {
      console.warn(`Street View failed to start: ${String((error as Error)?.message ?? error)}`);
      fail();
    });
    return () => {
      alive = false;
      window.removeEventListener("atlas-maps-auth-failure", fail);
      panoRef.current = null;
    };
    // One panorama per place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.latitude, target.longitude]);

  const backToStart = () => {
    const start = startRef.current;
    const pano = panoRef.current;
    if (!start || !pano) return;
    pano.setPano(start.pano);
    pano.setPov({ heading: start.heading, pitch: 0 });
    pano.setZoom(0);
  };

  return (
    <div className={cn("street-view absolute inset-0 bg-[#0a1117]", className)}>
      <div
        ref={hostRef}
        className={cn("street-view-pano absolute inset-0", status === "ready" && "is-ready")}
        role="application"
        aria-label="Street View. Drag to look around; click the arrows or the road to walk."
      />
      {!interactive && <div className="absolute inset-0 z-[2]" aria-hidden />}
      {status === "loading" && (
        <p className="street-view-status" role="status">
          Finding the street…
        </p>
      )}
      {status === "ready" && interactive && showHints && !looked && (
        <p className="street-view-hint" aria-hidden>
          <Footprints className="size-4" />
          Drag to look around · use the arrows to walk
        </p>
      )}
      {status === "ready" && interactive && moved && (
        <button type="button" className="street-view-home" onClick={backToStart}>
          <LocateFixed className="size-4" aria-hidden />
          Back to start
        </button>
      )}
    </div>
  );
}
