import { fallbackGenerated } from "./environments.ts";
import type {
  EnvironmentSpec,
  GeneratedEnvironment,
  GeneratedEnvironmentProvider,
  GeoLocation,
  SceneDescriptor,
  StreetImageryProvider,
} from "./types.ts";

export class LocalSceneProvider implements StreetImageryProvider {
  async getScene(location: GeoLocation): Promise<SceneDescriptor> {
    return {
      kind: location.sceneKind === "wikimedia" ? "photo" : "generated",
      src: location.sceneUrl,
      attribution: location.attribution,
    };
  }
}

/** Used only when a Higgsfield MCP surface actually exists. Never faked. */
export class HiggsfieldEnvironmentProvider implements GeneratedEnvironmentProvider {
  async generate(_spec: EnvironmentSpec): Promise<GeneratedEnvironment> {
    throw new Error("Higgsfield MCP is not available in this environment");
  }
}

export class FallbackEnvironmentProvider implements GeneratedEnvironmentProvider {
  async generate(spec: EnvironmentSpec): Promise<GeneratedEnvironment> {
    return fallbackGenerated(spec);
  }
}

export async function resolveRound4(spec: EnvironmentSpec): Promise<GeneratedEnvironment> {
  try {
    return await new HiggsfieldEnvironmentProvider().generate(spec);
  } catch {
    return new FallbackEnvironmentProvider().generate(spec);
  }
}
