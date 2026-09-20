import type { EnvironmentSpec, GeneratedEnvironment } from "./types.ts";

export const ROUND4_ENVIRONMENTS: EnvironmentSpec[] = [
  {
    id: "remix_cape",
    title: "Cape Escarpment, reconstructed",
    country: "ZA",
    truthLocationId: "loc_01",
    backdropUrl: "/generated/round4-cape.jpg",
    atmosphere: "cape-dusk",
    disclosure: "Generated 3D memory reconstruction. Not a photograph of a live place.",
  },
  {
    id: "remix_amsterdam",
    title: "Canal City, reconstructed",
    country: "NL",
    truthLocationId: "loc_16",
    backdropUrl: "/generated/round4-amsterdam.jpg",
    atmosphere: "amsterdam-neon",
    disclosure: "Generated 3D memory reconstruction. Not a photograph of a live place.",
  },
  {
    id: "remix_rotterdam",
    title: "Harbor Edge, reconstructed",
    country: "NL",
    truthLocationId: "loc_17",
    backdropUrl: "/generated/home-rotterdam.jpg",
    atmosphere: "rotterdam-harbor",
    disclosure: "Generated 3D memory reconstruction. Not a photograph of a live place.",
  },
  {
    id: "remix_highveld",
    title: "Highveld Storm, reconstructed",
    country: "ZA",
    truthLocationId: "loc_03",
    backdropUrl: "/generated/home-johannesburg.jpg",
    atmosphere: "highveld-storm",
    disclosure: "Generated 3D memory reconstruction. Not a photograph of a live place.",
  },
];

export function environmentById(id: string): EnvironmentSpec | undefined {
  return ROUND4_ENVIRONMENTS.find((e) => e.id === id);
}

export function fallbackGenerated(spec: EnvironmentSpec): GeneratedEnvironment {
  return {
    ...spec,
    provenance: {
      provider: "fallback-procedural",
      generatedAt: "2026-09-20",
      notes:
        "Higgsfield MCP was not available. Scene is assembled from procedural Three.js geometry plus a generated cinematic plate.",
    },
  };
}
