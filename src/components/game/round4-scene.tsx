import { useEffect, useRef, useState } from "react";
import { ATMOSPHERE_FAMILY, type AtmosphereId, type EnvironmentSpec } from "@/lib/game";

/**
 * Procedural 3D reconstructions for round 4. Everything is generated from
 * primitives + canvas textures — no model files, no network. Layouts are
 * seeded per environment id so both duel players explore the SAME scene.
 *
 * Fidelity comes from: heightfield terrain, extruded landmarks (Table
 * Mountain's plateau, Dutch gables, Erasmusbrug), animated water, instanced
 * emissive windows, storm rain + lightning, soft cloud sprites, ACES tone
 * mapping and shadows.
 */

type Three = typeof import("three");
type Disposable = { dispose: () => void };

interface Build {
  T: Three;
  scene: import("three").Scene;
  windAmp: number;
  trash: Disposable[];
  /** Track + add. */
  add: <O extends import("three").Object3D>(o: O) => O;
  keep: <D extends Disposable>(d: D) => D;
  rand: () => number;
}

interface WaterPts {
  mesh: import("three").Mesh;
  base: Float32Array;
  amp: number;
  speed: number;
  phase: number;
}

export function Round4Scene({ env, reducedMotion }: { env: EnvironmentSpec; reducedMotion?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [walking, setWalking] = useState(false);
  const walkingRef = useRef(walking);
  walkingRef.current = walking;
  const joyRef = useRef({ x: 0, y: 0, active: false });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let renderer: import("three").WebGLRenderer | undefined;
    let frame = 0;
    let ro: ResizeObserver | undefined;
    let dragging = false;
    let lx = 0;
    let ly = 0;
    let yaw = 0;
    let pitch = 0.16;
    const walk = { x: 0, z: 4 };
    const keys = new Set<string>();
    const trash: Disposable[] = [];
    const waters: WaterPts[] = [];
    let rain: { points: import("three").Points; ys: Float32Array; speed: number } | null = null;
    let lightning: { light: import("three").PointLight; next: number; until: number } | null = null;
    let skyMaterial: import("three").MeshBasicMaterial | null = null;

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        keys.add(key);
        if (walkingRef.current) e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lx = e.clientX;
      ly = e.clientY;
      host.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      yaw -= (e.clientX - lx) * 0.005;
      pitch = Math.max(-0.1, Math.min(0.5, pitch + (e.clientY - ly) * 0.004));
      lx = e.clientX;
      ly = e.clientY;
    };
    const onUp = () => {
      dragging = false;
    };

    (async () => {
      const THREE = await import("three");
      if (disposed || !hostRef.current) return;

      // Deterministic per environment: both duel players see identical worlds.
      let seed = 0x811c9dc5;
      for (let i = 0; i < env.id.length; i++) seed = Math.imul(seed ^ env.id.charCodeAt(i), 0x01000193);
      const rng = mulberry32(seed >>> 0);

      const scene = new THREE.Scene();
      const palette = paletteFor(env.atmosphere);
      const build: Build = {
        T: THREE,
        scene,
        windAmp: palette.windAmp,
        trash,
        add: (o) => {
          scene.add(o);
          return o;
        },
        keep: (d) => {
          trash.push(d);
          return d;
        },
        rand: rng,
      };

      scene.fog = new THREE.Fog(palette.fog, palette.fogNear, palette.fogFar);

      const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400);
      const isMobile = window.innerWidth < 640;
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 1.75));
      renderer.setClearColor(palette.fog);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = palette.exposure;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      host.appendChild(renderer.domElement);

      // Sky: canvas gradient dome (always present) + generated plate when it loads.
      skyMaterial = build.keep(
        new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: palette.skyTint, fog: false }),
      );
      const skyTexture = build.keep(canvasGradientTexture(THREE, palette.skyTop, palette.skyHorizon));
      skyMaterial.map = skyTexture;
      const sky = new THREE.Mesh(build.keep(new THREE.SphereGeometry(180, 32, 20)), skyMaterial);
      build.add(sky);

      const plater = new THREE.TextureLoader();
      plater.load(
        env.backdropUrl,
        (tex) => {
          if (disposed || !skyMaterial) return;
          tex.colorSpace = THREE.SRGBColorSpace;
          skyMaterial.map = tex;
          skyMaterial.color.set(palette.skyTint);
          skyMaterial.needsUpdate = true;
          trash.push(tex);
        },
        undefined,
        () => {
          /* keep the gradient */
        },
      );

      // Celestial sprite (sun low on the horizon / moon / storm glow).
      const sun = new THREE.Sprite(
        build.keep(
          new THREE.SpriteMaterial({
            map: build.keep(canvasGlowTexture(THREE, palette.sun)),
            color: palette.sun,
            transparent: true,
            opacity: palette.sunOpacity,
            depthWrite: false,
            fog: false,
          }),
        ),
      );
      sun.scale.setScalar(palette.sunSize);
      sun.position.copy(palette.sunPos);
      build.add(sun);

      addLights(build, palette, isMobile);
      addClouds(build, palette);

      if (palette.stars) addStars(build);
      switch (palette.family) {
        case "cape":
          buildCape(build, waters);
          break;
        case "canal":
          buildCanal(build, waters);
          break;
        case "harbor":
          buildHarbor(build, waters);
          break;
        default:
          buildVeld(build, isMobile);
          break;
      }
      if (palette.rain) rain = addRain(build, isMobile);
      if (palette.lightning) lightning = addLightning(build, palette);

      const resize = () => {
        if (!hostRef.current || !renderer) return;
        const { clientWidth: w, clientHeight: h } = hostRef.current;
        renderer.setSize(w, h, false);
        camera.aspect = w / Math.max(1, h);
        camera.updateProjectionMatrix();
      };
      resize();
      ro = new ResizeObserver(resize);
      ro.observe(host);

      host.addEventListener("pointerdown", onDown);
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerup", onUp);
      host.addEventListener("pointercancel", onUp);

      const cam = palette.camera;
      let last = performance.now();
      let ready = false;
      const loop = (now: number) => {
        if (disposed) return;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        const t = now / 1000;

        const p = Math.max(0.02, Math.min(0.5, pitch));
        if (walkingRef.current) {
          // First-person walk: drag looks, WASD/joystick moves.
          let f = 0;
          let s = 0;
          if (keys.has("w") || keys.has("arrowup")) f += 1;
          if (keys.has("s") || keys.has("arrowdown")) f -= 1;
          if (keys.has("a") || keys.has("arrowleft")) s -= 1;
          if (keys.has("d") || keys.has("arrowright")) s += 1;
          f += -joyRef.current.y;
          s += joyRef.current.x;
          const len = Math.hypot(f, s);
          if (len > 0.01) {
            const speed = 7 * dt;
            const sin = Math.sin(yaw);
            const cos = Math.cos(yaw);
            // Forward is away from the camera's orbit direction.
            walk.x += (-sin * f + cos * s) * speed;
            walk.z += (-cos * f - sin * s) * speed;
            const radius = Math.hypot(walk.x, walk.z);
            if (radius > 36) {
              walk.x = (walk.x / radius) * 36;
              walk.z = (walk.z / radius) * 36;
            }
          }
          camera.position.set(walk.x, groundHeight(walk.x, walk.z) + 1.7, walk.z);
          const look = new THREE.Vector3(
            walk.x - Math.sin(yaw) * Math.cos(p),
            camera.position.y + Math.sin(p * 0.9) - 0.2,
            walk.z - Math.cos(yaw) * Math.cos(p),
          );
          camera.lookAt(look);
        } else {
          if (!reducedMotion && !dragging) yaw += dt * palette.orbitSpeed;
          const r = cam.radius;
          camera.position.set(
            cam.target.x + Math.sin(yaw) * r,
            cam.height + p * cam.pitchRise,
            cam.target.z + Math.cos(yaw) * r,
          );
          camera.lookAt(cam.target.x, cam.lookAtY, cam.target.z);
        }

        animateWater(waters, t);
        if (rain) animateRain(rain, dt);
        if (lightning && !reducedMotion) animateLightning(lightning, now, skyMaterial);
        else if (lightning) lightning.light.intensity = 0;

        renderer!.render(scene, camera);
        if (!ready) {
          ready = true;
          (window as unknown as { __round4Ready?: boolean }).__round4Ready = true;
        }
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    })();

    return () => {
      disposed = true;
      (window as unknown as { __round4Ready?: boolean }).__round4Ready = false;
      cancelAnimationFrame(frame);
      ro?.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
      for (const d of trash) {
        try {
          d.dispose();
        } catch {
          /* already gone */
        }
      }
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [env, reducedMotion]);

  // Virtual joystick (touch): the knob offset drives the same input as WASD.
  const onJoy = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - (rect.x + rect.width / 2)) / (rect.width / 2);
    const py = (e.clientY - (rect.y + rect.height / 2)) / (rect.height / 2);
    joyRef.current = {
      x: Math.max(-1, Math.min(1, px)),
      y: Math.max(-1, Math.min(1, py)),
      active: true,
    };
  };
  const endJoy = () => {
    joyRef.current = { x: 0, y: 0, active: false };
  };

  return (
    <div className="absolute inset-0">
      <div ref={hostRef} className="h-full w-full touch-none" aria-label="3D reconstruction" />
      <div className="pointer-events-none absolute inset-x-3 top-[calc(env(safe-area-inset-top)+5.75rem)] z-10 flex items-start justify-between gap-2">
        <button
          type="button"
          className="pointer-events-auto inline-flex h-9 items-center rounded-full border border-border bg-bg/80 px-3 text-[11px] font-medium uppercase tracking-wider text-fg backdrop-blur-sm"
          onClick={() => setWalking((v) => !v)}
        >
          {walking ? "Orbit view" : "Walk around"}
        </button>
        <span className="pointer-events-none rounded-full border border-border bg-bg/70 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted backdrop-blur-sm">
          {walking ? "Drag to look · WASD / stick to move" : "Drag to orbit"}
        </span>
      </div>
      {walking && (
        <div
          className="absolute left-4 z-10 size-24 touch-none rounded-full border border-border bg-bg/50 backdrop-blur-sm max-sm:bottom-[calc(var(--atlas-map-h)+0.75rem)] sm:bottom-4"
          onPointerDown={onJoy}
          onPointerMove={(e) => {
            if (joyRef.current.active) onJoy(e);
          }}
          onPointerUp={endJoy}
          onPointerCancel={endJoy}
          aria-label="Move"
          role="application"
        >
          <span
            className="pointer-events-none absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-fg/80"
            style={{ transform: `translate(calc(-50% + ${joyRef.current.x * 28}px), calc(-50% + ${joyRef.current.y * 28}px))` }}
          />
        </div>
      )}
    </div>
  );
}

// ── atmosphere ────────────────────────────────────────────────────────────────

type Family = "cape" | "canal" | "harbor" | "veld";

interface Palette {
  family: Family;
  fog: number;
  fogNear: number;
  fogFar: number;
  skyTop: string;
  skyHorizon: string;
  skyTint: number;
  exposure: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  key: number;
  keyIntensity: number;
  keyPos: [number, number, number];
  sun: string;
  sunOpacity: number;
  sunSize: number;
  sunPos: import("three").Vector3;
  cloud: number;
  cloudOpacity: number;
  cloudCount: number;
  orbitSpeed: number;
  ground: number;
  windAmp: number;
  stars: boolean;
  rain: boolean;
  lightning: boolean;
  camera: { target: { x: number; z: number }; radius: number; height: number; pitchRise: number; lookAtY: number };
}

const V = (x: number, y: number, z: number) => ({ x, y, z }) as import("three").Vector3;

function basePalette(family: Family): Palette {
  switch (family) {
    case "cape":
      return {
        family,
        fog: 0x3a2a24, fogNear: 22, fogFar: 150,
        skyTop: "#1c2440", skyHorizon: "#e8894a", skyTint: 0xffffff, exposure: 1.05,
        hemiSky: 0xffb27a, hemiGround: 0x2a2018, hemiIntensity: 0.72,
        key: 0xffb070, keyIntensity: 2.5, keyPos: [-16, 9, 18],
        sun: "#ffd9a0", sunOpacity: 0.95, sunSize: 26, sunPos: V(-52, 7, 120),
        cloud: 0xffc9a0, cloudOpacity: 0.5, cloudCount: 10, orbitSpeed: 0.055,
        ground: 0x4a4234, windAmp: 1, stars: false, rain: false, lightning: false,
        camera: { target: { x: 0, z: -6 }, radius: 19, height: 5.2, pitchRise: 3.4, lookAtY: 3.4 },
      };
    case "canal":
      return {
        family,
        fog: 0x0a0d1c, fogNear: 18, fogFar: 110,
        skyTop: "#05070f", skyHorizon: "#22284a", skyTint: 0xbfc8ff, exposure: 1.12,
        hemiSky: 0x5566aa, hemiGround: 0x0a0a10, hemiIntensity: 0.5,
        key: 0x8fa8ff, keyIntensity: 0.75, keyPos: [10, 16, 8],
        sun: "#dfe8ff", sunOpacity: 0.55, sunSize: 12, sunPos: V(60, 34, -90),
        cloud: 0x2a3350, cloudOpacity: 0.35, cloudCount: 8, orbitSpeed: 0.05,
        ground: 0x14161e, windAmp: 0.6, stars: false, rain: false, lightning: false,
        camera: { target: { x: 0, z: 0 }, radius: 17, height: 4.4, pitchRise: 3, lookAtY: 2.8 },
      };
    case "harbor":
      return {
        family,
        fog: 0x141c26, fogNear: 26, fogFar: 160,
        skyTop: "#0e1624", skyHorizon: "#b06a3c", skyTint: 0xffffff, exposure: 1.0,
        hemiSky: 0x9ab0d0, hemiGround: 0x10141a, hemiIntensity: 0.62,
        key: 0xffb27a, keyIntensity: 2.0, keyPos: [18, 8, -12],
        sun: "#ffd0a0", sunOpacity: 0.8, sunSize: 20, sunPos: V(90, 6, 60),
        cloud: 0xb0b8c8, cloudOpacity: 0.45, cloudCount: 11, orbitSpeed: 0.05,
        ground: 0x2a2e36, windAmp: 1.15, stars: false, rain: false, lightning: false,
        camera: { target: { x: 0, z: -6 }, radius: 20, height: 5.6, pitchRise: 3.2, lookAtY: 3.6 },
      };
    default:
      return {
        family: "veld",
        fog: 0x3c4048, fogNear: 20, fogFar: 130,
        skyTop: "#191c22", skyHorizon: "#5a5f66", skyTint: 0xdfe4ec, exposure: 0.95,
        hemiSky: 0x8a95a8, hemiGround: 0x2c2a22, hemiIntensity: 0.5,
        key: 0xc8d0e0, keyIntensity: 1.1, keyPos: [-8, 20, 6],
        sun: "#c8ccd4", sunOpacity: 0.3, sunSize: 14, sunPos: V(-40, 60, -100),
        cloud: 0x33383f, cloudOpacity: 0.8, cloudCount: 18, orbitSpeed: 0.04,
        ground: 0x5a5638, windAmp: 1.3, stars: false, rain: true, lightning: true,
        camera: { target: { x: 0, z: -10 }, radius: 18, height: 4.6, pitchRise: 3.2, lookAtY: 3.2 },
      };
  }
}

/** Per-atmosphere mood on top of its family's geometry. */
const ATMOSPHERE_OVERRIDES: Partial<Record<AtmosphereId, Partial<Palette>>> = {
  "fynbos-wind": {
    fog: 0x6a7a80, fogNear: 26, fogFar: 170,
    skyTop: "#2e5a78", skyHorizon: "#bcd8e0", exposure: 1.15,
    hemiSky: 0xbfd8e8, hemiIntensity: 0.8,
    key: 0xfff0d0, keyIntensity: 2.4, keyPos: [14, 12, 10],
    sun: "#fff2d0", sunOpacity: 0.7, sunSize: 18, sunPos: V(60, 20, 100),
    cloud: 0xffffff, cloudOpacity: 0.55, cloudCount: 14,
    ground: 0x5a6048, windAmp: 1.6,
  },
  "veld-dawn": {
    fog: 0x5a4636, fogNear: 24, fogFar: 150,
    skyTop: "#2a3050", skyHorizon: "#f0a860", exposure: 1.0,
    hemiSky: 0xffc890, hemiIntensity: 0.7,
    key: 0xffb070, keyIntensity: 2.2, keyPos: [18, 6, -14],
    sun: "#ffd9a0", sunOpacity: 0.9, sunSize: 24, sunPos: V(80, 5, -40),
    cloud: 0xffd0a0, cloudOpacity: 0.45, cloudCount: 8,
    ground: 0x6a6242, windAmp: 1.1, rain: false, lightning: false,
  },
  "karoo-night": {
    fog: 0x0a0e18, fogNear: 24, fogFar: 140,
    skyTop: "#05070f", skyHorizon: "#1a2233", skyTint: 0x9fb0d8, exposure: 1.15,
    hemiSky: 0x4a5a80, hemiIntensity: 0.4,
    key: 0x8fa8ff, keyIntensity: 0.6, keyPos: [8, 16, 8],
    sun: "#dfe8ff", sunOpacity: 0.8, sunSize: 14, sunPos: V(-40, 40, 80),
    cloud: 0x2a3350, cloudOpacity: 0.3, cloudCount: 6,
    ground: 0x3a3a2c, windAmp: 0.9, stars: true, rain: false, lightning: false,
  },
  "canal-fog": {
    fog: 0x3a4048, fogNear: 10, fogFar: 70,
    skyTop: "#20242c", skyHorizon: "#4a5058", skyTint: 0xd8dde4, exposure: 0.95,
    hemiSky: 0x8a94a4, hemiIntensity: 0.55,
    key: 0xaab4c8, keyIntensity: 0.9, keyPos: [6, 12, 10],
    sun: "#c8ccd4", sunOpacity: 0.35, sunSize: 12, sunPos: V(-30, 30, -80),
    cloud: 0x8a929e, cloudOpacity: 0.7, cloudCount: 14,
    ground: 0x1a1d24, orbitSpeed: 0.045,
  },
  "dune-gold": {
    fog: 0x6a5a3a, fogNear: 20, fogFar: 120,
    skyTop: "#243a55", skyHorizon: "#f0b060", exposure: 1.08,
    hemiSky: 0xffd8a0, hemiIntensity: 0.75,
    key: 0xffb870, keyIntensity: 2.3, keyPos: [-14, 8, 14],
    sun: "#ffd9a0", sunOpacity: 0.9, sunSize: 22, sunPos: V(-70, 8, 90),
    cloud: 0xffd8b0, cloudOpacity: 0.5, cloudCount: 9,
    ground: 0x5a5138,
  },
  "delta-steel": {
    fog: 0x5a6470, fogNear: 30, fogFar: 180,
    skyTop: "#3a4450", skyHorizon: "#8a98a8", exposure: 1.0,
    hemiSky: 0xa8b4c0, hemiIntensity: 0.8,
    key: 0xdfe8f0, keyIntensity: 1.9, keyPos: [10, 14, -8],
    sun: "#e8eef4", sunOpacity: 0.5, sunSize: 16, sunPos: V(50, 24, -60),
    cloud: 0xb8c0c8, cloudOpacity: 0.6, cloudCount: 16,
    ground: 0x3a4048,
  },
  "island-light": {
    fog: 0x162030, fogNear: 22, fogFar: 140,
    skyTop: "#0e1a30", skyHorizon: "#3a5a80", skyTint: 0xc8d4e8, exposure: 1.1,
    hemiSky: 0x6a88b0, hemiIntensity: 0.55,
    key: 0xffd0a0, keyIntensity: 1.4, keyPos: [-12, 8, 16],
    sun: "#ffd9a0", sunOpacity: 0.7, sunSize: 18, sunPos: V(-40, 12, 110),
    cloud: 0x3a4a60, cloudOpacity: 0.5, cloudCount: 10,
    ground: 0x2a3038,
  },
};

function paletteFor(atmosphere: AtmosphereId): Palette {
  const family = ATMOSPHERE_FAMILY[atmosphere] ?? "cape";
  return { ...basePalette(family), ...ATMOSPHERE_OVERRIDES[atmosphere] };
}

/** Star field for night skies (points inside the sky dome). */
function addStars(build: Build) {
  const { T } = build;
  const count = 700;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = build.rand() * Math.PI * 2;
    const e = Math.asin(build.rand() * 0.95);
    const r = 168;
    positions[i * 3] = Math.cos(e) * Math.cos(a) * r;
    positions[i * 3 + 1] = Math.sin(e) * r;
    positions[i * 3 + 2] = Math.cos(e) * Math.sin(a) * r;
  }
  const geo = build.keep(new T.BufferGeometry());
  geo.setAttribute("position", new T.BufferAttribute(positions, 3));
  const mat = build.keep(
    new T.PointsMaterial({ color: 0xdfe8ff, size: 0.8, transparent: true, opacity: 0.9, fog: false, depthWrite: false }),
  );
  build.add(new T.Points(geo, mat));
}

// ── shared builders ──────────────────────────────────────────────────────────

function addLights(build: Build, palette: Palette, isMobile: boolean) {
  const { T } = build;
  const hemi = build.add(new T.HemisphereLight(palette.hemiSky, palette.hemiGround, palette.hemiIntensity));
  hemi.position.set(0, 30, 0);

  const key = new T.DirectionalLight(palette.key, palette.keyIntensity);
  key.position.set(...palette.keyPos);
  key.castShadow = true;
  const shadowSize = isMobile ? 512 : 1024;
  key.shadow.mapSize.set(shadowSize, shadowSize);
  key.shadow.camera.left = -26;
  key.shadow.camera.right = 26;
  key.shadow.camera.top = 26;
  key.shadow.camera.bottom = -26;
  key.shadow.camera.far = 80;
  key.shadow.bias = -0.0006;
  build.add(key);
  build.add(key.target);
  key.target.position.set(0, 0, -4);

  const fill = new T.DirectionalLight(0x8899bb, 0.25);
  fill.position.set(-14, 8, -10);
  build.add(fill);
}

function addClouds(build: Build, palette: Palette) {
  const { T } = build;
  const tex = build.keep(canvasCloudTexture(T));
  for (let i = 0; i < palette.cloudCount; i++) {
    const mat = build.keep(
      new T.SpriteMaterial({
        map: tex,
        color: palette.cloud,
        transparent: true,
        opacity: palette.cloudOpacity * (0.7 + build.rand() * 0.4),
        depthWrite: false,
        fog: false,
      }),
    );
    const cloud = new T.Sprite(mat);
    const a = build.rand() * Math.PI * 2;
    const r = 34 + build.rand() * 52;
    cloud.position.set(Math.sin(a) * r, 16 + build.rand() * 14, Math.cos(a) * r - 16);
    cloud.scale.set(26 + build.rand() * 30, 9 + build.rand() * 8, 1);
    build.add(cloud);
  }
}

function addWater(
  build: Build,
  waters: WaterPts[],
  opts: { w: number; d: number; x?: number; z: number; color: number; amp: number; speed: number; seg?: number },
) {
  const { T } = build;
  const seg = opts.seg ?? 44;
  const geo = build.keep(new T.PlaneGeometry(opts.w, opts.d, seg, seg));
  const mat = build.keep(
    new T.MeshStandardMaterial({
      color: opts.color,
      roughness: 0.16,
      metalness: 0.72,
    }),
  );
  const mesh = new T.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  const pos = geo.attributes.position as import("three").BufferAttribute;
  const base = Float32Array.from(pos.array as Float32Array);
  mesh.position.set(opts.x ?? 0, 0.02, opts.z);
  mesh.receiveShadow = true;
  build.add(mesh);
  waters.push({ mesh, base, amp: opts.amp * build.windAmp, speed: opts.speed * (0.7 + build.windAmp * 0.3), phase: build.rand() * Math.PI * 2 });
}

function animateWater(waters: WaterPts[], t: number) {
  for (const w of waters) {
    const geo = w.mesh.geometry;
    const pos = geo.attributes.position as import("three").BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = w.base[i];
      const y = w.base[i + 1];
      arr[i + 2] =
        Math.sin(x * 0.35 + t * w.speed + w.phase) * w.amp +
        Math.cos(y * 0.5 + t * w.speed * 0.8) * w.amp * 0.6;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }
}

/** World-space height of the terrain mesh (matches groundPlane's displacement). */
function groundHeight(x: number, z: number): number {
  // The plane is rotated -90° about X, so local y maps to world -z.
  return Math.sin(x * 0.12) * 0.25 + Math.cos(z * 0.09) * 0.3 + Math.sin((x - z) * 0.05) * 0.2;
}

function groundPlane(build: Build, color: number, size: number, rough = 0.95) {
  const { T } = build;
  const geo = build.keep(new T.PlaneGeometry(size, size, 48, 48));
  const pos = geo.attributes.position as import("three").BufferAttribute;
  const arr = pos.array as Float32Array;
  for (let i = 0; i < arr.length; i += 3) {
    const x = arr[i];
    const y = arr[i + 1];
    arr[i + 2] = Math.sin(x * 0.12) * 0.25 + Math.cos(y * 0.09) * 0.3 + Math.sin((x + y) * 0.05) * 0.2;
  }
  geo.computeVertexNormals();
  const mesh = new T.Mesh(geo, build.keep(new T.MeshStandardMaterial({ color, roughness: rough })));
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return build.add(mesh);
}

/** Collects window quads and emits one InstancedMesh — cheap facades. */
class WindowBank {
  private items: { m: import("three").Matrix4; color: import("three").Color }[] = [];
  constructor(private T: Three) {}
  push(x: number, y: number, z: number, w: number, h: number, rotY: number, color: number) {
    const m = new this.T.Matrix4();
    const q = new this.T.Quaternion().setFromEuler(new this.T.Euler(0, rotY, 0));
    m.compose(new this.T.Vector3(x, y, z), q, new this.T.Vector3(w, h, 1));
    this.items.push({ m, color: new this.T.Color(color) });
  }
  build(build: Build) {
    const { T } = build;
    if (this.items.length === 0) return;
    const geo = build.keep(new T.PlaneGeometry(1, 1));
    // Unlit so instanceColor reads as a glowing window, not a shaded quad.
    const mat = build.keep(
      new T.MeshBasicMaterial({
        color: 0xffffff,
        side: T.DoubleSide,
        toneMapped: true,
      }),
    );
    const inst = new T.InstancedMesh(geo, mat, this.items.length);
    this.items.forEach((it, i) => {
      inst.setMatrixAt(i, it.m);
      inst.setColorAt(i, it.color);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    build.add(inst);
  }
}

function building(
  build: Build,
  bank: WindowBank,
  o: { x: number; z: number; w: number; h: number; d: number; color: number; lit: number; gable?: boolean; rotY?: number },
) {
  const { T } = build;
  const rotY = o.rotY ?? 0;
  const geo = build.keep(new T.BoxGeometry(o.w, o.h, o.d));
  const mat = build.keep(new T.MeshStandardMaterial({ color: o.color, roughness: 0.82 }));
  const mesh = new T.Mesh(geo, mat);
  mesh.position.set(o.x, o.h / 2, o.z);
  mesh.rotation.y = rotY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  build.add(mesh);

  if (o.gable) {
    const shape = new T.Shape();
    shape.moveTo(-o.w / 2 - 0.08, 0);
    shape.lineTo(o.w / 2 + 0.08, 0);
    shape.lineTo(0, o.w * 0.42);
    shape.closePath();
    const roofGeo = build.keep(
      new T.ExtrudeGeometry(shape, { depth: o.d + 0.12, bevelEnabled: false }),
    );
    const roof = new T.Mesh(roofGeo, build.keep(new T.MeshStandardMaterial({ color: 0x2a2320, roughness: 0.9 })));
    roof.position.set(o.x, o.h, o.z - o.d / 2 - 0.06);
    roof.rotation.y = rotY;
    roof.castShadow = true;
    build.add(roof);
  }

  // Lit windows on all four faces, skipping the ground floor.
  const cols = Math.max(1, Math.floor(o.w / 0.7));
  const rows = Math.max(1, Math.floor((o.h - 0.8) / 0.9));
  const warm = [0xffd9a0, 0xffc27a, 0xf6e9c8, 0xaad4ff];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (build.rand() > o.lit) continue;
      const wy = 1.1 + r * 0.9;
      const wx = -o.w / 2 + 0.5 + c * 0.7;
      const col = warm[Math.floor(build.rand() * warm.length)];
      const cos = Math.cos(rotY);
      const sin = Math.sin(rotY);
      const put = (lx: number, lz: number, faceRot: number) => {
        bank.push(o.x + lx * cos - lz * sin, wy, o.z + lx * sin + lz * cos, 0.42, 0.5, faceRot + rotY, col);
      };
      put(wx, o.d / 2 + 0.011, 0);
      put(wx, -o.d / 2 - 0.011, Math.PI);
      if (c < Math.max(1, Math.floor(o.d / 0.7))) {
        const wz = -o.d / 2 + 0.5 + c * 0.7;
        put(o.w / 2 + 0.011, wz, Math.PI / 2);
        put(-o.w / 2 - 0.011, wz, -Math.PI / 2);
      }
    }
  }
}

function addRain(build: Build, isMobile: boolean) {
  const { T } = build;
  const count = isMobile ? 900 : 1800;
  const positions = new Float32Array(count * 3);
  const ys = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const x = (build.rand() - 0.5) * 46;
    const z = (build.rand() - 0.5) * 46;
    const y = build.rand() * 22;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    ys[i] = y;
  }
  const geo = build.keep(new T.BufferGeometry());
  geo.setAttribute("position", new T.BufferAttribute(positions, 3));
  const mat = build.keep(
    new T.PointsMaterial({ color: 0xaebbd0, size: 0.09, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  const points = new T.Points(geo, mat);
  build.add(points);
  return { points, ys, speed: 14 };
}

function animateRain(rain: { points: import("three").Points; ys: Float32Array; speed: number }, dt: number) {
  const pos = rain.points.geometry.attributes.position as import("three").BufferAttribute;
  const arr = pos.array as Float32Array;
  for (let i = 0; i < rain.ys.length; i++) {
    rain.ys[i] -= dt * rain.speed;
    if (rain.ys[i] < 0) rain.ys[i] = 22;
    arr[i * 3 + 1] = rain.ys[i];
  }
  pos.needsUpdate = true;
}

function addLightning(build: Build, palette: Palette) {
  const { T } = build;
  const light = new T.PointLight(0xdce6ff, 0, 90, 1.4);
  light.position.set(6, 26, -34);
  build.add(light);
  void palette;
  return { light, next: performance.now() + 2500, until: 0 };
}

function animateLightning(
  l: { light: import("three").PointLight; next: number; until: number },
  now: number,
  sky: import("three").MeshBasicMaterial | null,
) {
  if (now >= l.next && now >= l.until) {
    l.until = now + 140 + Math.random() * 160;
    l.next = now + 3500 + Math.random() * 5000;
  }
  if (now < l.until) {
    const k = (l.until - now) / 300;
    l.light.intensity = 220 * Math.max(0, k) * (0.6 + Math.random() * 0.4);
    if (sky) sky.color.setRGB(1.6, 1.7, 1.9);
  } else {
    l.light.intensity = 0;
    if (sky) sky.color.setRGB(1, 1, 1);
  }
}

// ── environments ─────────────────────────────────────────────────────────────

function buildCape(build: Build, waters: WaterPts[]) {
  const { T } = build;
  groundPlane(build, 0x4a4234, 120, 1);

  // Ocean across the foreground (dusk sun over it).
  addWater(build, waters, { w: 160, d: 46, z: 24, color: 0x2a4258, amp: 0.16, speed: 1.1 });

  const bank = new WindowBank(T);

  // Table Mountain: extruded flat-topped plateau silhouette + flanking peaks.
  const ridge = new T.Shape();
  ridge.moveTo(-20, 0);
  ridge.lineTo(-14, 4.4);
  ridge.lineTo(-11, 5.6);
  ridge.lineTo(-7, 6.1);
  ridge.lineTo(-5, 8.2);
  ridge.lineTo(6, 8.2); // the famous flat top
  ridge.lineTo(8, 6.4);
  ridge.lineTo(12, 5.2);
  ridge.lineTo(17, 3.2);
  ridge.lineTo(21, 0);
  ridge.closePath();
  const ridgeGeo = build.keep(new T.ExtrudeGeometry(ridge, { depth: 10, bevelEnabled: false }));
  const rock = build.keep(new T.MeshStandardMaterial({ color: 0x3b3327, roughness: 0.98 }));
  const mountain = new T.Mesh(ridgeGeo, rock);
  mountain.position.set(0, 0.1, -30);
  mountain.castShadow = true;
  mountain.receiveShadow = true;
  build.add(mountain);

  // Lion's Head and Devil's Peak cones anchor the ridge.
  const peak = (x: number, h: number, r: number, z: number, color: number) => {
    const m = new T.Mesh(
      build.keep(new T.ConeGeometry(r, h, 7)),
      build.keep(new T.MeshStandardMaterial({ color, roughness: 1 })),
    );
    m.position.set(x, h / 2 + 0.1, z);
    m.castShadow = true;
    build.add(m);
  };
  peak(-17, 8.5, 3.4, -24, 0x39332a);
  peak(19, 11, 4.2, -27, 0x352f27);
  peak(-9, 5.4, 2.2, -20, 0x3d362c);

  // City Bowl in front of the mountain.
  for (let i = 0; i < 46; i++) {
    const x = (build.rand() - 0.5) * 34;
    const z = -6 - build.rand() * 12;
    const h = 0.9 + build.rand() * 2.6;
    const w = 0.9 + build.rand() * 1.2;
    building(build, bank, {
      x,
      z,
      w,
      h,
      d: w,
      color: [0x6a5f4e, 0x7a6b58, 0x5c5346][Math.floor(build.rand() * 3)],
      lit: 0.75,
      rotY: build.rand() * 0.4 - 0.2,
    });
  }

  // Beach strip between city and ocean.
  const sand = new T.Mesh(
    build.keep(new T.PlaneGeometry(90, 5)),
    build.keep(new T.MeshStandardMaterial({ color: 0xb8a480, roughness: 1 })),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.03, 6);
  sand.receiveShadow = true;
  build.add(sand);

  bank.build(build);
}

function buildCanal(build: Build, waters: WaterPts[]) {
  const { T } = build;
  groundPlane(build, 0x14161e, 90, 0.95);

  // Canal down the middle, quays on both sides.
  addWater(build, waters, { w: 90, d: 7.2, z: 0, color: 0x11202e, amp: 0.05, speed: 0.7, seg: 36 });

  const quayMat = build.keep(new T.MeshStandardMaterial({ color: 0x22242c, roughness: 0.9 }));
  for (const side of [-1, 1]) {
    const wall = new T.Mesh(build.keep(new T.BoxGeometry(90, 0.7, 0.6)), quayMat);
    wall.position.set(0, 0.35, side * 3.9);
    wall.receiveShadow = true;
    build.add(wall);
  }

  const bank = new WindowBank(T);
  const brick = [0x5a3b30, 0x6b4636, 0x4a3a34, 0x7a5442, 0x3e3430];

  // Two rows of narrow Dutch canal houses with gables.
  for (const side of [-1, 1]) {
    let x = -34;
    while (x < 34) {
      const w = 1.6 + build.rand() * 1.4;
      const h = 4.2 + build.rand() * 3.4;
      building(build, bank, {
        x: x + w / 2,
        z: side * (6.4 + build.rand() * 1.6),
        w,
        h,
        d: 3.6 + build.rand() * 1.6,
        color: brick[Math.floor(build.rand() * brick.length)],
        lit: 0.55,
        gable: true,
      });
      x += w + 0.1;
    }
  }

  // Arched bridge crossings.
  for (const bx of [-11, 9]) {
    const arc = new T.Mesh(
      build.keep(new T.TorusGeometry(3.1, 0.22, 8, 20, Math.PI)),
      build.keep(new T.MeshStandardMaterial({ color: 0x2e3038, roughness: 0.8 })),
    );
    arc.rotation.y = Math.PI / 2;
    arc.position.set(bx, 0.4, 0);
    build.add(arc);
    const deck = new T.Mesh(
      build.keep(new T.BoxGeometry(0.9, 0.14, 6)),
      build.keep(new T.MeshStandardMaterial({ color: 0x3a3d46, roughness: 0.85 })),
    );
    deck.position.set(bx, 3.5, 0);
    build.add(deck);
    for (let i = -2; i <= 2; i++) {
      const lamp = new T.Mesh(
        build.keep(new T.CylinderGeometry(0.045, 0.045, 1.4, 6)),
        build.keep(new T.MeshStandardMaterial({ color: 0x11131a })),
      );
      lamp.position.set(bx + i * 0.34, 4.2, i % 2 === 0 ? 1.4 : -1.4);
      build.add(lamp);
      const glow = new T.Sprite(
        build.keep(
          new T.SpriteMaterial({
            map: build.keep(canvasGlowTexture(T, "#ffd9a0")),
            color: 0xffcf90,
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
            fog: false,
          }),
        ),
      );
      glow.scale.setScalar(0.9);
      glow.position.set(lamp.position.x, 4.95, lamp.position.z);
      build.add(glow);
    }
  }

  // Neon signs + coloured point lights along the canal.
  const neonCols: [number, string, number][] = [
    [0xff5a8a, "#ff5a8a", -13],
    [0x4ad4ff, "#4ad4ff", -2],
    [0xffa03a, "#ffa03a", 7],
    [0x7a5aff, "#7a5aff", 15],
  ];
  for (const [col, css, z] of neonCols) {
    const side = z % 2 === 0 ? 1 : -1;
    const sign = new T.Mesh(
      build.keep(new T.PlaneGeometry(1.7, 0.5)),
      build.keep(new T.MeshBasicMaterial({ color: col, side: T.DoubleSide })),
    );
    sign.position.set(6, 3.6, side * 4.6);
    build.add(sign);
    const light = new T.PointLight(col, 28, 16, 2);
    light.position.set(6, 3.2, side * 3.4);
    build.add(light);
    void css;
  }

  bank.build(build);
}

function buildHarbor(build: Build, waters: WaterPts[]) {
  const { T } = build;
  groundPlane(build, 0x2a2e36, 120, 0.95);

  // Harbor water dominates the middle distance.
  addWater(build, waters, { w: 160, d: 52, z: -14, color: 0x1a2a38, amp: 0.14, speed: 1.0 });

  const quay = new T.Mesh(
    build.keep(new T.BoxGeometry(120, 1.1, 6)),
    build.keep(new T.MeshStandardMaterial({ color: 0x30343c, roughness: 0.9 })),
  );
  quay.position.set(0, 0.55, -12);
  quay.receiveShadow = true;
  build.add(quay);

  const bank = new WindowBank(T);

  // Warehouses behind the quay.
  for (let i = 0; i < 7; i++) {
    const x = -32 + i * 11 + build.rand() * 2;
    const w = 6 + build.rand() * 3;
    building(build, bank, {
      x,
      z: -18 - build.rand() * 3,
      w,
      h: 3 + build.rand() * 1.6,
      d: 5,
      color: [0x3a3f48, 0x454b56, 0x333840][Math.floor(build.rand() * 3)],
      lit: 0.5,
    });
  }

  // Container stacks in primary colours.
  const containerCols = [0xc04a3a, 0x2a6ab0, 0xd0a02a, 0x3a8a5a, 0x8a4aa0];
  for (let i = 0; i < 26; i++) {
    const stackH = 1 + Math.floor(build.rand() * 4);
    const x = -28 + build.rand() * 56;
    const z = -9 + build.rand() * 3;
    const col = containerCols[Math.floor(build.rand() * containerCols.length)];
    for (let s = 0; s < stackH; s++) {
      const box = new T.Mesh(
        build.keep(new T.BoxGeometry(2.4, 0.8, 1.2)),
        build.keep(new T.MeshStandardMaterial({ color: col, roughness: 0.7 })),
      );
      box.position.set(x, 1.2 + s * 0.82, z);
      box.rotation.y = build.rand() * 0.08 - 0.04;
      box.castShadow = true;
      build.add(box);
    }
  }

  // Port cranes.
  for (const cx of [-22, -6, 14, 26]) {
    const mast = new T.Mesh(
      build.keep(new T.CylinderGeometry(0.22, 0.3, 9, 8)),
      build.keep(new T.MeshStandardMaterial({ color: 0x8a8f98, roughness: 0.6, metalness: 0.4 })),
    );
    mast.position.set(cx, 5, -13);
    mast.castShadow = true;
    build.add(mast);
    const jib = new T.Mesh(
      build.keep(new T.BoxGeometry(7.5, 0.24, 0.24)),
      build.keep(new T.MeshStandardMaterial({ color: 0x9aa0aa, roughness: 0.6 })),
    );
    jib.position.set(cx + 2.6, 9.2, -13);
    jib.rotation.z = 0.12;
    jib.castShadow = true;
    build.add(jib);
  }

  // Erasmusbrug silhouette: single white pylon, fan of stay cables, deck.
  const pylon = new T.Mesh(
    build.keep(new T.CylinderGeometry(0.28, 0.5, 17, 8)),
    build.keep(new T.MeshStandardMaterial({ color: 0xd8dce4, roughness: 0.5, metalness: 0.25 })),
  );
  pylon.position.set(0, 8.6, -2);
  pylon.castShadow = true;
  build.add(pylon);
  const deck = new T.Mesh(
    build.keep(new T.BoxGeometry(40, 0.5, 3.4)),
    build.keep(new T.MeshStandardMaterial({ color: 0x3e434c, roughness: 0.8 })),
  );
  deck.position.set(0, 3.6, -2);
  deck.receiveShadow = true;
  build.add(deck);
  const cableMat = build.keep(new T.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.4 }));
  for (let i = -9; i <= 9; i++) {
    if (Math.abs(i) < 1) continue;
    const x = i * 1.9;
    const top = new T.Vector3(0, 16.6, -2);
    const foot = new T.Vector3(x, 3.9, -2);
    const mid = top.clone().lerp(foot, 0.5);
    const len = top.distanceTo(foot);
    const cable = new T.Mesh(build.keep(new T.CylinderGeometry(0.035, 0.035, len, 5)), cableMat);
    cable.position.copy(mid);
    const dir = foot.clone().sub(top).normalize();
    cable.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir);
    build.add(cable);
  }

  // A container ship under the bridge.
  const hull = new T.Mesh(
    build.keep(new T.BoxGeometry(16, 2.2, 4.4)),
    build.keep(new T.MeshStandardMaterial({ color: 0x232830, roughness: 0.7 })),
  );
  hull.position.set(6, 1.2, -8);
  hull.castShadow = true;
  build.add(hull);
  const bridgeHouse = new T.Mesh(
    build.keep(new T.BoxGeometry(2.6, 2.6, 3.4)),
    build.keep(new T.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.6 })),
  );
  bridgeHouse.position.set(11.5, 3.4, -8);
  bridgeHouse.castShadow = true;
  build.add(bridgeHouse);
  for (let i = 0; i < 10; i++) {
    const c = new T.Mesh(
      build.keep(new T.BoxGeometry(1.3, 0.5, 3.2)),
      build.keep(
        new T.MeshStandardMaterial({ color: containerCols[i % containerCols.length], roughness: 0.7 }),
      ),
    );
    c.position.set(-1 + i * 1.5, 2.8, -8);
    build.add(c);
  }

  bank.build(build);
}

function buildVeld(build: Build, isMobile: boolean) {
  const { T } = build;
  groundPlane(build, 0x5a5638, 160, 0.98);

  // Scattered flat-top trees.
  for (let i = 0; i < (isMobile ? 22 : 40); i++) {
    const x = (build.rand() - 0.5) * 90;
    const z = -6 + (build.rand() - 0.5) * 60;
    const h = 1.6 + build.rand() * 2;
    const trunk = new T.Mesh(
      build.keep(new T.CylinderGeometry(0.08, 0.12, h, 5)),
      build.keep(new T.MeshStandardMaterial({ color: 0x3a3020, roughness: 1 })),
    );
    trunk.position.set(x, h / 2, z);
    build.add(trunk);
    const canopy = new T.Mesh(
      build.keep(new T.SphereGeometry(0.9 + build.rand() * 0.7, 7, 5)),
      build.keep(new T.MeshStandardMaterial({ color: 0x4a5230, roughness: 1 })),
    );
    canopy.scale.y = 0.5;
    canopy.position.set(x, h + 0.4, z);
    canopy.castShadow = true;
    build.add(canopy);
  }

  const bank = new WindowBank(T);

  // Johannesburg skyline on the horizon, lit for the storm.
  const tower = new T.Mesh(
    build.keep(new T.CylinderGeometry(0.7, 1.0, 22, 10)),
    build.keep(new T.MeshStandardMaterial({ color: 0x454a54, roughness: 0.7 })),
  );
  tower.position.set(-8, 11, -46);
  build.add(tower);
  const towerTop = new T.Mesh(
    build.keep(new T.CylinderGeometry(1.5, 1.2, 1.4, 10)),
    build.keep(new T.MeshStandardMaterial({ color: 0x2f343d, roughness: 0.8 })),
  );
  towerTop.position.set(-8, 22.6, -46);
  build.add(towerTop);

  for (let i = 0; i < 12; i++) {
    const x = -34 + i * 5.6 + build.rand() * 2;
    const h = 6 + build.rand() * 14;
    const w = 2.6 + build.rand() * 2;
    building(build, bank, {
      x,
      z: -42 - build.rand() * 6,
      w,
      h,
      d: 3,
      color: [0x3c414b, 0x474c57, 0x33373f][Math.floor(build.rand() * 3)],
      lit: 0.85,
    });
  }

  bank.build(build);
}

// ── canvas textures ──────────────────────────────────────────────────────────

function canvasGradientTexture(T: Three, top: string, horizon: string) {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top);
  g.addColorStop(0.72, horizon);
  g.addColorStop(1, horizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = T.ClampToEdgeWrapping;
  tex.wrapT = T.ClampToEdgeWrapping;
  return tex;
}

function canvasGlowTexture(T: Three, color: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, color);
  g.addColorStop(0.35, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

function canvasCloudTexture(T: Three) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 128);
  const blobs = [
    [70, 74, 52],
    [120, 60, 62],
    [180, 76, 50],
    [100, 88, 46],
    [150, 92, 42],
  ];
  for (const [x, y, r] of blobs) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.75)");
    g.addColorStop(0.6, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 128);
  }
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}