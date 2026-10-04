import { useMemo } from "react";
import worldJson from "@/data/world.json";
import { formatDistance, haversineKm, scoreTier } from "@/lib/game";
import { hopPath, landPath, routeAspect, routeFrame } from "@/lib/map/route";
import { cn, plural } from "@/lib/utils";

/**
 * The match as a trip: the places it visited on a small map, joined in order
 * by arcs that draw themselves hop by hop as the card scrolls in, each stop
 * landing in the colour of how you scored there.
 */

const W = 480;
const WORLD = (worldJson as unknown as { features: Parameters<typeof landPath>[0] }).features;

export interface RouteStop {
  latitude: number;
  longitude: number;
  /** Your points there (0–20,000); colours the stop. */
  score?: number;
}

export function ExpeditionRoute({ stops, className }: { stops: RouteStop[]; className?: string }) {
  const geo = useMemo(() => {
    const H = Math.round(W / routeAspect(stops));
    const frame = routeFrame(stops, W, H);
    const pts = stops.map((s) => frame.project(s.longitude, s.latitude));
    const [west, south, east, north] = frame.bounds;
    let grid = "";
    for (let lng = Math.ceil(west / 10) * 10; lng <= east; lng += 10) {
      const [x] = frame.project(lng, 0);
      grid += `M${x.toFixed(1)} 0V${H}`;
    }
    for (let lat = Math.ceil(south / 10) * 10; lat <= north; lat += 10) {
      const [, y] = frame.project(0, lat);
      grid += `M0 ${y.toFixed(1)}H${W}`;
    }
    return {
      height: H,
      land: landPath(WORLD, frame),
      grid,
      pts,
      hops: pts.slice(1).map((p, i) => hopPath(pts[i], p)),
      km: stops.slice(1).reduce((n, s, i) => n + haversineKm(stops[i], s), 0),
    };
  }, [stops]);

  if (!stops.length) return null;
  // Long matches still draw in about four seconds.
  const hopMs = Math.round(Math.min(420, 4200 / Math.max(1, geo.hops.length)));
  const numbered = stops.length <= 10;
  return (
    <figure
      className={cn("route-card", className)}
      data-reveal
      style={{ "--hop": `${hopMs}ms` } as React.CSSProperties}
    >
      <svg
        viewBox={`0 0 ${W} ${geo.height}`}
        role="img"
        aria-label={`Map of the ${plural(stops.length, "place")} this match visited`}
      >
        <path d={geo.grid} className="route-grid" />
        <path d={geo.land} className="route-land" />
        {geo.hops.map((d, i) => (
          <path
            key={i}
            d={d}
            pathLength={1}
            className="route-hop"
            style={{ "--i": i } as React.CSSProperties}
          />
        ))}
        {geo.pts.map(([x, y], i) => (
          <g key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
            <g
              className={cn("route-stop", `is-${scoreTier(stops[i].score)}`)}
              style={{ "--i": i } as React.CSSProperties}
            >
              <circle className="route-stop-ring" r={9} />
              <circle className="route-stop-dot" r={numbered ? 9 : 5} />
              {numbered && (
                <text className="route-stop-n" textAnchor="middle" dy="3.6">
                  {i + 1}
                </text>
              )}
            </g>
          </g>
        ))}
      </svg>
      <figcaption className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs text-muted">
        <span className="uppercase tracking-[0.2em] text-subtle">Your expedition</span>
        <span className="tabular">
          {stops.length} {stops.length === 1 ? "stop" : "stops"}
          {geo.km > 0 ? ` · ${formatDistance(geo.km)}` : ""}
        </span>
      </figcaption>
    </figure>
  );
}
