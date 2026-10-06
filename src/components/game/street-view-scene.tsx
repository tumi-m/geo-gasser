import { LocateFixed } from "lucide-react";
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
  onUnavailable,
  className,
}: {
  target: LatLng;
  /** Street View is the only scene: search further before giving up. */
  wide?: boolean;
  interactive?: boolean;
  onUnavailable: () => void;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const panoRef = useRef<StreetViewPanoramaLike | null>(null);
  const startRef = useRef<{ pano: string; heading: number } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [moved, setMoved] = useState(false);
  const failRef = useRef(onUnavailable);
  failRef.current = onUnavailable;

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
      // Closest first, widening to a short drive for street-only places.
      const source = maps.StreetViewSource?.GOOGLE ?? maps.StreetViewSource?.OUTDOOR;
      let pano: string | undefined;
      for (const radius of [120, 600, 1500, ...(wide ? [5000] : [])]) {
        try {
          const { data } = await service.getPanorama({
            location,
            radius,
            ...(source ? { source } : {}),
            ...(maps.StreetViewPreference ? { preference: maps.StreetViewPreference.NEAREST } : {}),
          });
          pano = data.location?.pano;
        } catch {
          pano = undefined;
        }
        if (pano || !alive) break;
      }
      if (!alive) return;
      if (!pano || !hostRef.current) return fail();
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
      panorama.addListener("pano_changed", () => setMoved(panorama.getPano() !== startRef.current?.pano));
      setStatus("ready");
    })().catch(fail);
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
      {status === "ready" && interactive && moved && (
        <button type="button" className="street-view-home" onClick={backToStart}>
          <LocateFixed className="size-4" aria-hidden />
          Back to start
        </button>
      )}
    </div>
  );
}
