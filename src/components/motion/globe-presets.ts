import type { AtlasSpec } from "@/lib/game";
import type { GlobePlace } from "./dot-globe";

/**
 * What the dotted globe shows for an atlas: where it turns, which countries
 * glow, and the arcs it flies. Built from the atlas alone, never a question.
 */
/** The one accent; the globe paints from the page tokens and ignores this. */
const ACCENT = "#ff5500";
const ZA: GlobePlace = { lat: -29, lon: 24.7, color: ACCENT, halo: 9 };
const NL: GlobePlace = { lat: 52.2, lon: 5.3, color: ACCENT, halo: 3.2 };
const HUBS: GlobePlace[] = [
  { lat: 51.5, lon: -0.1, color: ACCENT },
  { lat: 40.7, lon: -74, color: ACCENT },
  { lat: -22.9, lon: -43.2, color: ACCENT },
  { lat: 35.7, lon: 139.7, color: ACCENT },
  { lat: -33.9, lon: 151.2, color: ACCENT },
  { lat: 30, lon: 31.2, color: ACCENT },
];

export function globeForAtlas(spec: AtlasSpec | undefined): {
  focus?: { lat: number; lon: number };
  places: GlobePlace[];
  arcs: [number, number][];
} {
  const preset = spec?.preset ?? "sa-nl";
  if (preset === "za")
    return {
      focus: { lat: -29, lon: 24.7 },
      places: [
        ZA,
        { lat: -33.9, lon: 18.4, color: ACCENT },
        { lat: -26.2, lon: 28, color: ACCENT },
        { lat: -29.9, lon: 31, color: ACCENT },
      ],
      arcs: [
        [1, 2],
        [2, 3],
        [3, 1],
      ],
    };
  if (preset === "nl") return { focus: { lat: 52.2, lon: 5.3 }, places: [NL], arcs: [] };
  if (preset === "sa-nl")
    return {
      focus: { lat: 12, lon: 15 },
      places: [ZA, NL],
      arcs: [
        [0, 1],
        [1, 0],
      ],
    };
  if (preset === "mix")
    return {
      places: [ZA, NL, ...HUBS],
      arcs: [
        [0, 1],
        [1, 3],
        [0, 5],
        [1, 4],
        [0, 2],
        [1, 6],
      ],
    };
  return {
    places: HUBS,
    arcs: [
      [0, 1],
      [1, 2],
      [2, 5],
      [5, 3],
      [3, 4],
      [4, 0],
    ],
  };
}
