import { formatDistance } from "./geo.ts";
import type { GeoLocation } from "./types.ts";

/**
 * The cosmos round: thirty places in our universe, from Mercury to the
 * Andromeda Galaxy. Each is drawn live as a motion graphic (no photo) and the
 * player places it on a log-scale ruler of distance from the Sun.
 *
 * A cosmic target is an ordinary location with `country: "SPACE"`, so it flows
 * through the deck, the reveal and the history like any other. Its position is
 * one number: `latitude` holds log10 of its distance from the Sun in AU
 * (`longitude` is always 0). Guesses are encoded the same way.
 *
 * Cosmos rounds are dealt only in the longest matches (Voyage and Odyssey).
 */

export const AU_KM = 149_597_870.7;
export const LY_AU = 63_241.077;
/** Log10(AU) span of the ruler: 0.2 AU (inside Mercury) to past Andromeda. */
export const COSMOS_MIN = -0.7;
export const COSMOS_MAX = 11.7;

export type CosmosKind =
  | "rocky"
  | "earth"
  | "gas"
  | "ringed"
  | "star"
  | "nebula"
  | "remnant"
  | "cluster"
  | "galaxy"
  | "blackhole"
  | "comet"
  | "probe"
  | "cloud"
  | "binary-body";

/**
 * Everything the renderer needs and nothing that names the target. This is
 * what a guest receives for a cosmic question (like a neutral photo path).
 */
export interface CosmosLook {
  kind: CosmosKind;
  /** Surface colours, darkest to lightest (or band colours for giants). */
  palette: string[];
  seed: number;
  /** Body radius as a share of the short side of the scene. */
  size?: number;
  /** Axial tilt on screen, degrees. */
  tilt?: number;
  /** Seconds per turn on screen. */
  turn?: number;
  bands?: number;
  /** Band turbulence 0..1. */
  swirl?: number;
  rings?: { inner: number; outer: number; colors: string[]; open: number };
  spot?: { lat: number; lon: number; w: number; h: number; color: string };
  caps?: string;
  craters?: number;
  /** Rim glow colour (atmosphere or corona). */
  glow?: string;
  /** Thick featureless haze (0..1). */
  haze?: number;
  clouds?: boolean;
  /** Surface marks: lineae, volcanoes, bright spots, a heart, stripes. */
  marks?: "lineae" | "volcanoes" | "bright-spots" | "heart" | "stripes" | "maria" | "cantaloupe";
  /** Big neighbour hanging in the sky behind a moon. */
  backdrop?: { kind: "gas" | "ringed" | "earth"; palette: string[]; bands?: number; side: "left" | "right"; spot?: boolean; rings?: boolean; glow?: string };
  /** Star extras. */
  flares?: boolean;
  companion?: string;
  /** Galaxy shape. */
  arms?: number;
  inclination?: number;
  irregular?: boolean;
}

export interface CosmosTarget {
  id: string;
  title: string;
  /** Where it lives: "Jupiter system", "Milky Way"… shown at the reveal. */
  region: string;
  /** Mean distance from the Sun, AU. */
  au: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** One observation shown beside the scene. Never names the target. */
  clue: string;
  look: CosmosLook;
}

const ly = (n: number) => n * LY_AU;

export const COSMOS_TARGETS: CosmosTarget[] = [
  {
    id: "cos_mercury",
    title: "Mercury",
    region: "Inner Solar System",
    au: 0.387,
    difficulty: 3,
    clue: "Airless and scorched: 430 °C by day, −180 °C by night. A year lasts 88 days.",
    look: { kind: "rocky", palette: ["#4a4542", "#7d7671", "#a7a09a", "#cfc8c0"], seed: 11, size: 0.3, turn: 70, craters: 90 },
  },
  {
    id: "cos_venus",
    title: "Venus",
    region: "Inner Solar System",
    au: 0.723,
    difficulty: 2,
    clue: "Sulphuric-acid clouds over a 465 °C surface. The Sun rises in the west here.",
    look: { kind: "gas", palette: ["#b88f4f", "#d9b878", "#ecd6a0", "#f6e8c4"], seed: 12, size: 0.36, turn: 90, bands: 7, swirl: 0.9, glow: "#f3dca0", haze: 0.35 },
  },
  {
    id: "cos_earth",
    title: "Earth",
    region: "Inner Solar System",
    au: 1,
    difficulty: 1,
    clue: "Seventy-one percent of the surface is liquid water.",
    look: { kind: "earth", palette: ["#0c2a4f", "#1d5a8c", "#4d7a3a", "#c7b48a"], seed: 13, size: 0.36, turn: 40, tilt: 23, clouds: true, glow: "#7fc4ff", caps: "#f2f6f8" },
  },
  {
    id: "cos_moon",
    title: "The Moon",
    region: "Earth system",
    au: 1,
    difficulty: 1,
    clue: "Twelve people have walked here. The same face always points home.",
    look: {
      kind: "rocky",
      palette: ["#3d3d3f", "#6f6e6c", "#9c9a96", "#cfccc6"],
      seed: 14,
      size: 0.27,
      turn: 80,
      craters: 70,
      marks: "maria",
      backdrop: { kind: "earth", palette: ["#0c2a4f", "#1d5a8c", "#4d7a3a", "#c7b48a"], side: "right", glow: "#7fc4ff" },
    },
  },
  {
    id: "cos_mars",
    title: "Mars",
    region: "Inner Solar System",
    au: 1.524,
    difficulty: 1,
    clue: "Iron-oxide dust, the tallest volcano known, and two small moons.",
    look: { kind: "rocky", palette: ["#5a2414", "#9c4422", "#c46a3a", "#e0a070"], seed: 15, size: 0.33, turn: 45, tilt: 25, craters: 25, caps: "#f4ece4", glow: "#e7a07a" },
  },
  {
    id: "cos_ceres",
    title: "Ceres",
    region: "Asteroid belt",
    au: 2.77,
    difficulty: 4,
    clue: "The largest object in its belt: 940 km across, with bright salt deposits in one crater.",
    look: { kind: "rocky", palette: ["#3a3836", "#5d5a56", "#7e7a74", "#9d9890"], seed: 16, size: 0.25, turn: 30, craters: 60, marks: "bright-spots" },
  },
  {
    id: "cos_jupiter",
    title: "Jupiter",
    region: "Outer Solar System",
    au: 5.2,
    difficulty: 1,
    clue: "A storm larger than Earth has raged here for centuries. A day lasts under ten hours.",
    look: {
      kind: "gas",
      palette: ["#7a5236", "#b58658", "#d8b88e", "#efe2c8", "#c49a70"],
      seed: 17,
      size: 0.4,
      turn: 30,
      bands: 15,
      swirl: 0.55,
      spot: { lat: -22, lon: 40, w: 26, h: 11, color: "#c2603a" },
      glow: "#e9cfa8",
    },
  },
  {
    id: "cos_io",
    title: "Io",
    region: "Jupiter system",
    au: 5.2,
    difficulty: 3,
    clue: "The most volcanic body known: over 400 active volcanoes, painted by sulphur.",
    look: {
      kind: "rocky",
      palette: ["#8a6a1e", "#c9a63a", "#e8d06a", "#f3e7a6"],
      seed: 18,
      size: 0.24,
      turn: 60,
      marks: "volcanoes",
      backdrop: { kind: "gas", palette: ["#7a5236", "#b58658", "#d8b88e", "#efe2c8", "#c49a70"], bands: 15, side: "left", spot: true },
    },
  },
  {
    id: "cos_europa",
    title: "Europa",
    region: "Jupiter system",
    au: 5.2,
    difficulty: 3,
    clue: "A cracked ice shell over a hidden salt-water ocean, deeper than any on Earth.",
    look: {
      kind: "rocky",
      palette: ["#9c8a76", "#c9bba6", "#e3dacb", "#f4efe6"],
      seed: 19,
      size: 0.24,
      turn: 60,
      marks: "lineae",
      backdrop: { kind: "gas", palette: ["#7a5236", "#b58658", "#d8b88e", "#efe2c8", "#c49a70"], bands: 15, side: "right", spot: true },
    },
  },
  {
    id: "cos_saturn",
    title: "Saturn",
    region: "Outer Solar System",
    au: 9.58,
    difficulty: 1,
    clue: "Less dense than water. Its rings are 280,000 km wide and mostly 10 m thick.",
    look: {
      kind: "ringed",
      palette: ["#8a7650", "#b9a372", "#d9c79a", "#ece0bd"],
      seed: 20,
      size: 0.27,
      turn: 32,
      tilt: -18,
      bands: 9,
      swirl: 0.25,
      rings: { inner: 1.25, outer: 2.3, colors: ["#6f6450", "#cbb995", "#e6d8b4", "#3a352c", "#bfae88", "#8c7f66"], open: 0.32 },
      glow: "#eadbb2",
    },
  },
  {
    id: "cos_titan",
    title: "Titan",
    region: "Saturn system",
    au: 9.58,
    difficulty: 3,
    clue: "A thick orange haze hides lakes of liquid methane at −179 °C.",
    look: {
      kind: "gas",
      palette: ["#8c5a1c", "#b77a2a", "#d39a44", "#e4b766"],
      seed: 21,
      size: 0.3,
      turn: 90,
      bands: 4,
      swirl: 0.15,
      haze: 0.8,
      glow: "#e8a957",
      backdrop: { kind: "ringed", palette: ["#8a7650", "#b9a372", "#d9c79a", "#ece0bd"], bands: 9, side: "left", rings: true },
    },
  },
  {
    id: "cos_enceladus",
    title: "Enceladus",
    region: "Saturn system",
    au: 9.58,
    difficulty: 4,
    clue: "The whitest surface known. Geysers of water ice spray from its south pole.",
    look: {
      kind: "rocky",
      palette: ["#a9b6be", "#cfd8dd", "#e9eff2", "#ffffff"],
      seed: 22,
      size: 0.22,
      turn: 50,
      craters: 30,
      marks: "stripes",
      backdrop: { kind: "ringed", palette: ["#8a7650", "#b9a372", "#d9c79a", "#ece0bd"], bands: 9, side: "right", rings: true },
    },
  },
  {
    id: "cos_uranus",
    title: "Uranus",
    region: "Outer Solar System",
    au: 19.19,
    difficulty: 2,
    clue: "It rolls around the Sun on its side, tilted 98°, under faint dark rings.",
    look: {
      kind: "ringed",
      palette: ["#7fb8c2", "#9fd0d6", "#b7e0e2", "#cdeeee"],
      seed: 23,
      size: 0.3,
      turn: 50,
      tilt: 82,
      bands: 3,
      swirl: 0.05,
      rings: { inner: 1.5, outer: 2.0, colors: ["#20313a", "#5c7c86", "#1d2a30", "#6d8b93"], open: 0.9 },
      glow: "#b9f0f2",
    },
  },
  {
    id: "cos_neptune",
    title: "Neptune",
    region: "Outer Solar System",
    au: 30.07,
    difficulty: 2,
    clue: "The fastest winds measured anywhere: 2,100 km/h. One year here is 165 Earth years.",
    look: {
      kind: "gas",
      palette: ["#1d3b9a", "#2c56c4", "#4677e0", "#7fa6f0"],
      seed: 24,
      size: 0.32,
      turn: 40,
      bands: 6,
      swirl: 0.35,
      spot: { lat: -20, lon: -30, w: 16, h: 8, color: "#122a6e" },
      glow: "#7fa6ff",
    },
  },
  {
    id: "cos_triton",
    title: "Triton",
    region: "Neptune system",
    au: 30.07,
    difficulty: 4,
    clue: "It orbits backwards. Nitrogen geysers streak a pink, wrinkled surface at −235 °C.",
    look: {
      kind: "rocky",
      palette: ["#8f7670", "#b9a39a", "#d8c6bc", "#efe4dc"],
      seed: 25,
      size: 0.23,
      turn: 60,
      marks: "cantaloupe",
      caps: "#f5ece8",
      backdrop: { kind: "gas", palette: ["#1d3b9a", "#2c56c4", "#4677e0", "#7fa6f0"], bands: 6, side: "left", glow: "#7fa6ff" },
    },
  },
  {
    id: "cos_pluto",
    title: "Pluto",
    region: "Kuiper belt",
    au: 39.48,
    difficulty: 2,
    clue: "A bright plain of nitrogen ice in the shape of a heart. Sunlight takes five hours to arrive.",
    look: { kind: "rocky", palette: ["#5e3e2c", "#8f6a50", "#bfa184", "#ece2d4"], seed: 26, size: 0.25, turn: 70, craters: 15, marks: "heart" },
  },
  {
    id: "cos_eris",
    title: "Eris",
    region: "Scattered disc",
    au: 67.8,
    difficulty: 5,
    clue: "A dwarf world almost Pluto's size whose discovery cost Pluto its planet status.",
    look: { kind: "rocky", palette: ["#9c9a98", "#c4c2bf", "#dfdedb", "#f6f5f3"], seed: 27, size: 0.2, turn: 80, craters: 10 },
  },
  {
    id: "cos_halley",
    title: "Halley's Comet",
    region: "Outer Solar System",
    au: 17.8,
    difficulty: 4,
    clue: "Seen every 75 years since at least 240 BC; next back in 2061. Shown at its average distance.",
    look: { kind: "comet", palette: ["#2b2622", "#5a5048", "#bcd8ff", "#ffe9c4"], seed: 28, size: 0.05 },
  },
  {
    id: "cos_arrokoth",
    title: "Arrokoth",
    region: "Kuiper belt",
    au: 44.6,
    difficulty: 5,
    clue: "Two red lobes stuck gently together: the most distant world a spacecraft has flown past.",
    look: { kind: "binary-body", palette: ["#4a2416", "#7d3e24", "#a8603c", "#c98a62"], seed: 29, size: 0.2 },
  },
  {
    id: "cos_voyager",
    title: "Voyager 1",
    region: "Interstellar space",
    au: 170,
    difficulty: 4,
    clue: "Launched in 1977 with a golden record; its radio signal now takes almost a day to arrive.",
    look: { kind: "probe", palette: ["#cfd3d6", "#8e959a", "#d4a94a", "#ffffff"], seed: 30, size: 0.3 },
  },
  {
    id: "cos_oort",
    title: "The Oort cloud",
    region: "Edge of the Solar System",
    au: 20_000,
    difficulty: 4,
    clue: "A vast shell of icy bodies, far out where the Sun is only a bright star. The home of long-period comets.",
    look: { kind: "cloud", palette: ["#9fc7ff", "#dce9ff", "#ffffff", "#ffe7b0"], seed: 31, size: 0.46 },
  },
  {
    id: "cos_proxima",
    title: "Proxima Centauri",
    region: "Stellar neighbourhood",
    au: ly(4.246),
    difficulty: 2,
    clue: "A small red dwarf that flares violently, with a rocky planet in its habitable zone.",
    look: { kind: "star", palette: ["#5a0e06", "#b02a10", "#e5551e", "#ff9a52"], seed: 32, size: 0.28, turn: 80, flares: true, glow: "#ff6a2a", companion: "#fff2d6" },
  },
  {
    id: "cos_sirius",
    title: "Sirius",
    region: "Stellar neighbourhood",
    au: ly(8.6),
    difficulty: 3,
    clue: "The brightest star in our night sky, with a white-dwarf companion the size of Earth.",
    look: { kind: "star", palette: ["#7aa6ff", "#bcd4ff", "#e8f0ff", "#ffffff"], seed: 33, size: 0.18, turn: 30, glow: "#a9c8ff", companion: "#ffffff" },
  },
  {
    id: "cos_betelgeuse",
    title: "Betelgeuse",
    region: "Milky Way · Orion",
    au: ly(550),
    difficulty: 3,
    clue: "A red supergiant so large it would swallow the orbit of Jupiter, near the end of its life.",
    look: { kind: "star", palette: ["#4a0c04", "#a3300e", "#e0621e", "#ffb064"], seed: 34, size: 0.4, turn: 120, glow: "#ff7a3a" },
  },
  {
    id: "cos_pleiades",
    title: "The Pleiades",
    region: "Milky Way · Taurus",
    au: ly(444),
    difficulty: 3,
    clue: "A young cluster of hot blue stars drifting through a cloud of dust that scatters their light.",
    look: { kind: "cluster", palette: ["#4d7cff", "#9cc0ff", "#e4eeff", "#ffffff"], seed: 35, size: 0.42 },
  },
  {
    id: "cos_orion_nebula",
    title: "The Orion Nebula",
    region: "Milky Way · Orion",
    au: ly(1_344),
    difficulty: 3,
    clue: "The nearest large star nursery, lit by four young stars at its heart. Visible to the naked eye.",
    look: { kind: "nebula", palette: ["#ff4f7b", "#ff9a7a", "#7fd6d0", "#ffe6c8"], seed: 36, size: 0.46 },
  },
  {
    id: "cos_crab",
    title: "The Crab Nebula",
    region: "Milky Way · Taurus",
    au: ly(6_500),
    difficulty: 4,
    clue: "Debris of a star seen exploding in 1054, with a pulsar at its centre spinning 30 times a second.",
    look: { kind: "remnant", palette: ["#ff6a2a", "#ffb35c", "#6fa8ff", "#e8f2ff"], seed: 37, size: 0.4 },
  },
  {
    id: "cos_sgr_a",
    title: "Sagittarius A*",
    region: "Centre of the Milky Way",
    au: ly(26_670),
    difficulty: 3,
    clue: "Four million Suns of mass in a space smaller than Mercury's orbit, with stars whipping around it.",
    look: { kind: "blackhole", palette: ["#ff8a2a", "#ffc46a", "#fff2d0", "#8a2a10"], seed: 38, size: 0.18 },
  },
  {
    id: "cos_lmc",
    title: "The Large Magellanic Cloud",
    region: "Beyond the Milky Way",
    au: ly(160_000),
    difficulty: 4,
    clue: "A satellite galaxy that circles our own, seen only from the southern sky.",
    look: { kind: "galaxy", palette: ["#ffd9a8", "#cfe0ff", "#ff7a9c", "#ffffff"], seed: 39, size: 0.44, irregular: true, inclination: 35 },
  },
  {
    id: "cos_andromeda",
    title: "The Andromeda Galaxy",
    region: "Beyond the Milky Way",
    au: ly(2_537_000),
    difficulty: 2,
    clue: "A trillion stars in a spiral twice our galaxy's width, headed our way. The farthest thing you can see without a telescope.",
    look: { kind: "galaxy", palette: ["#ffe2b0", "#c9d8ff", "#ff9ab0", "#ffffff"], seed: 40, size: 0.5, arms: 2, inclination: 68 },
  },
];

export const COSMOS_ZONES: { name: string; from: number; to: number }[] = [
  { name: "Inner Solar System", from: -Infinity, to: 0.6 },
  { name: "Giant planets", from: 0.6, to: 1.55 },
  { name: "Kuiper belt and beyond", from: 1.55, to: 3 },
  { name: "Oort cloud", from: 3, to: 5.2 },
  { name: "Stellar neighbourhood", from: 5.2, to: 7 },
  { name: "Milky Way", from: 7, to: 9.6 },
  { name: "Other galaxies", from: 9.6, to: Infinity },
];

export function cosmosZone(logAu: number): string {
  return COSMOS_ZONES.find((z) => logAu >= z.from && logAu < z.to)?.name ?? "Deep space";
}

export function clampCosmos(logAu: number): number {
  return Math.max(COSMOS_MIN, Math.min(COSMOS_MAX, logAu));
}

/** "5.2 AU", "4.2 light-years", "2.5 million light-years". */
export function formatCosmicDistance(au: number): string {
  if (!Number.isFinite(au)) return "—";
  if (au < 0.1) return `${Math.round(au * AU_KM).toLocaleString("en-US")} km`;
  if (au < 10) return `${au.toFixed(1)} AU`;
  if (au < 0.1 * LY_AU) return `${Math.round(au).toLocaleString("en-US")} AU`;
  const years = au / LY_AU;
  if (years < 10) return `${years.toFixed(1)} light-years`;
  if (years < 1e6) return `${Math.round(years).toLocaleString("en-US")} light-years`;
  return `${(years / 1e6).toFixed(1)} million light-years`;
}

const byId = new Map(COSMOS_TARGETS.map((t) => [t.id, t]));
export function cosmosTarget(id: string): CosmosTarget | undefined {
  return byId.get(id);
}

export function isCosmosId(id: string | undefined): boolean {
  return Boolean(id && byId.has(id));
}

/** The cosmic targets as locations, never in the photo pool. */
export const COSMOS_LOCATIONS: GeoLocation[] = COSMOS_TARGETS.map((t) => ({
  id: t.id,
  country: "SPACE",
  title: t.title,
  region: t.region,
  latitude: Math.log10(t.au),
  longitude: 0,
  difficulty: t.difficulty,
  tags: ["cosmos"],
  attribution: "Motion graphic drawn live. Distances: NASA and ESA mean values.",
  verifiedAt: "2026-10-04",
  enabled: true,
  sceneUrl: "",
  sceneKind: "cosmos",
}));

/** Cosmos questions per match length; zero outside the long matches. */
export const COSMOS_QUESTIONS = { escape: 0, quick: 0, standard: 0, extended: 10, full: 20 } as const;

/** A round's miss in words: km on Earth, AU or light-years in space. */
export function formatMiss(score: { distanceKm: number; decades?: number }, km = score.distanceKm): string {
  if (score.decades == null) return formatDistance(km);
  if (!Number.isFinite(km)) return "—";
  return formatCosmicDistance(km / AU_KM);
}
