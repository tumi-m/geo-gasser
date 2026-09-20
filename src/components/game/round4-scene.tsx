import { useEffect, useRef } from "react";
import type { EnvironmentSpec } from "@/lib/game";

export function Round4Scene({ env, reducedMotion }: { env: EnvironmentSpec; reducedMotion?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let renderer: import("three").WebGLRenderer | undefined;
    let frame = 0;
    let ro: ResizeObserver | undefined;
    let dragging = false;
    let lx = 0;
    let yaw = 0;
    let pitch = 0.18;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lx = e.clientX;
      host.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      yaw -= (e.clientX - lx) * 0.005;
      lx = e.clientX;
    };
    const onUp = () => {
      dragging = false;
    };


    (async () => {
      const THREE = await import("three");
      if (disposed || !hostRef.current) return;

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(env.atmosphere === "amsterdam-neon" ? 0x070814 : 0x120c08, 8, 42);
      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
      camera.position.set(0, 3.2, 10);

      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(env.atmosphere.includes("cape") || env.atmosphere === "highveld-storm" ? 0x1a140e : 0x0b0c14);
      host.appendChild(renderer.domElement);

      const tex = new THREE.TextureLoader().load(env.backdropUrl);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(80, 24, 16),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide }),
      );
      scene.add(sky);

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(80, 80),
        new THREE.MeshStandardMaterial({
          color: env.atmosphere.includes("amsterdam") || env.atmosphere === "rotterdam-harbor" ? 0x12151c : 0x2a241c,
          roughness: 0.95,
        }),
      );
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);

      if (env.atmosphere !== "highveld-storm") {
        const water = new THREE.Mesh(
          new THREE.PlaneGeometry(env.atmosphere === "cape-dusk" ? 80 : 8, env.atmosphere === "cape-dusk" ? 28 : 48),
          new THREE.MeshStandardMaterial({
            color: env.atmosphere === "amsterdam-neon" ? 0x1b2433 : 0x1a2a38,
            roughness: 0.2,
            metalness: 0.4,
          }),
        );
        water.rotation.x = -Math.PI / 2;
        water.position.y = 0.04;
        water.position.z = env.atmosphere === "cape-dusk" ? -12 : 0;
        scene.add(water);
      }

      const buildingMat = new THREE.MeshStandardMaterial({
        color: env.atmosphere === "amsterdam-neon" ? 0x3a2a22 : 0x4a4338,
        roughness: 0.8,
      });
      const count = window.innerWidth < 600 ? 18 : 36;
      for (let i = 0; i < count; i++) {
        const h = 0.8 + Math.random() * (env.atmosphere === "rotterdam-harbor" ? 4 : 2.2);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, h, 0.9), buildingMat);
        const side = i % 2 === 0 ? -3.2 : 3.2;
        mesh.position.set(
          env.atmosphere === "cape-dusk" ? (Math.random() - 0.5) * 16 : side + (Math.random() - 0.5) * 0.4,
          h / 2,
          (Math.random() - 0.5) * 22,
        );
        scene.add(mesh);
      }

      if (env.atmosphere === "cape-dusk" || env.atmosphere === "highveld-storm") {
        const mountain = new THREE.Mesh(
          new THREE.ConeGeometry(8, 5.5, 5),
          new THREE.MeshStandardMaterial({ color: 0x2a261f, roughness: 1 }),
        );
        mountain.position.set(-6, 2.2, -16);
        scene.add(mountain);
        const table = new THREE.Mesh(
          new THREE.BoxGeometry(11, 1.4, 4),
          new THREE.MeshStandardMaterial({ color: 0x3a342b, roughness: 1 }),
        );
        table.position.set(-5.5, 4.4, -16);
        scene.add(table);
      }

      scene.add(new THREE.AmbientLight(0xc4c0b8, 0.45));
      const key = new THREE.DirectionalLight(env.atmosphere === "amsterdam-neon" ? 0x88a0ff : 0xffc888, 1.6);
      key.position.set(6, 10, 4);
      scene.add(key);
      if (env.atmosphere === "amsterdam-neon") {
        const neon = new THREE.PointLight(0xff7a3a, 8, 18);
        neon.position.set(-3, 2, 2);
        scene.add(neon);
      }

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

      let last = performance.now();
      const loop = (now: number) => {
        if (disposed) return;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (!reducedMotion && !dragging) yaw += dt * 0.08;
        pitch = Math.max(0.05, Math.min(0.45, pitch));
        camera.position.x = Math.sin(yaw) * 10;
        camera.position.z = Math.cos(yaw) * 10;
        camera.position.y = 3.2 + pitch * 2;
        camera.lookAt(0, 1.4, 0);
        renderer!.render(scene, camera);
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro?.disconnect();
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [env, reducedMotion]);

  return (
    <div className="absolute inset-0">
      <div ref={hostRef} className="h-full w-full touch-none" aria-label="3D reconstruction" />
    </div>
  );
}
