import type { AtmosphereId, EnvironmentSpec, GeneratedEnvironment } from "./types.ts";

const DISCLOSURE = "Generated 3D memory reconstruction. Not a photograph of a live place.";

export const ROUND4_ENVIRONMENTS: EnvironmentSpec[] = [
  {
    id: "remix_rondavels",
    title: "Three Rondavels, reconstructed",
    country: "ZA",
    truthLocationId: "loc_31",
    backdropUrl: "/generated/round4-cape.jpg",
    atmosphere: "cape-dusk",
    disclosure: DISCLOSURE,
  },
  {
    id: "remix_agulhas",
    title: "Cape Agulhas, reconstructed",
    country: "ZA",
    truthLocationId: "loc_32",
    backdropUrl: "/generated/home-cape.jpg",
    atmosphere: "fynbos-wind",
    disclosure: DISCLOSURE,
  },
  {
    id: "remix_kirstenbosch",
    title: "Kirstenbosch, reconstructed",
    country: "ZA",
    truthLocationId: "loc_33",
    backdropUrl: "/generated/home-cape.jpg",
    atmosphere: "veld-dawn",
    disclosure: DISCLOSURE,
  },
  {
    id: "remix_hartbeespoort",
    title: "Hartbeespoort, reconstructed",
    country: "ZA",
    truthLocationId: "loc_34",
    backdropUrl: "/generated/home-johannesburg.jpg",
    atmosphere: "highveld-storm",
    disclosure: DISCLOSURE,
  },
  {
    id: "remix_cango",
    title: "Cango Caves, reconstructed",
    country: "ZA",
    truthLocationId: "loc_35",
    backdropUrl: "/generated/home-cape.jpg",
    atmosphere: "karoo-night",
    disclosure: DISCLOSURE,
  },
  {
    id: "remix_keukenhof",
    title: "Keukenhof, reconstructed",
    country: "NL",
    truthLocationId: "loc_36",
    backdropUrl: "/generated/home-amsterdam.jpg",
    atmosphere: "dune-gold",
    disclosure: DISCLOSURE,
  },
  {
    id: "remix_neeltje",
    title: "Neeltje Jans, reconstructed",
    country: "NL",
    truthLocationId: "loc_37",
    backdropUrl: "/generated/home-rotterdam.jpg",
    atmosphere: "delta-steel",
    disclosure: DISCLOSURE,
  },
  {
    id: "remix_texel",
    title: "Eierland Light, reconstructed",
    country: "NL",
    truthLocationId: "loc_38",
    backdropUrl: "/generated/round4-amsterdam.jpg",
    atmosphere: "island-light",
    disclosure: DISCLOSURE,
  },
  {
    id: "remix_waalbrug",
    title: "Waalbrug, reconstructed",
    country: "NL",
    truthLocationId: "loc_39",
    backdropUrl: "/generated/home-rotterdam.jpg",
    atmosphere: "rotterdam-harbor",
    disclosure: DISCLOSURE,
  },
  {
    id: "remix_marken",
    title: "Marken Light, reconstructed",
    country: "NL",
    truthLocationId: "loc_40",
    backdropUrl: "/generated/round4-amsterdam.jpg",
    atmosphere: "canal-fog",
    disclosure: DISCLOSURE,
  },
];

export function environmentById(id: string): EnvironmentSpec | undefined {
  return ROUND4_ENVIRONMENTS.find((e) => e.id === id);
}

export function environmentForLocation(locationId: string): EnvironmentSpec | undefined {
  return ROUND4_ENVIRONMENTS.find((e) => e.truthLocationId === locationId);
}

export function fallbackGenerated(spec: EnvironmentSpec): GeneratedEnvironment {
  return {
    ...spec,
    provenance: {
      provider: "fallback-procedural",
      generatedAt: "2026-09-21",
      notes:
        "Higgsfield MCP was not available. Scene is assembled from procedural Three.js geometry plus a generated cinematic plate.",
    },
  };
}

export const ATMOSPHERE_FAMILY: Record<AtmosphereId, "cape" | "canal" | "harbor" | "veld"> = {
  "cape-dusk": "cape",
  "fynbos-wind": "cape",
  "veld-dawn": "veld",
  "highveld-storm": "veld",
  "karoo-night": "veld",
  "amsterdam-neon": "canal",
  "canal-fog": "canal",
  "dune-gold": "canal",
  "rotterdam-harbor": "harbor",
  "delta-steel": "harbor",
  "island-light": "harbor",
};