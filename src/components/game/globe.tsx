import { useEffect, useRef } from "react";

function latLngToVec(lat: number, lng: number, r: number) {
  const φ = ((90 - lat) * Math.PI) / 180;
  const θ = ((lng + 180) * Math.PI) / 180;
  return {
    x: -r * Math.sin(φ) * Math.cos(θ),
    y: r * Math.cos(φ),
    z: r * Math.sin(φ) * Math.sin(θ),
  };
}

export function Globe({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let renderer: import("three").WebGLRenderer | undefined;
    let frame = 0;
    let ro: ResizeObserver | undefined;

    (async () => {
      const THREE = await import("three");
      if (disposed || !hostRef.current) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
      camera.position.set(0, 0.35, 3.1);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      host.appendChild(renderer.domElement);

      const group = new THREE.Group();
      scene.add(group);

      const geo = new THREE.SphereGeometry(1, 64, 64);
      const tex = new THREE.TextureLoader().load("/textures/earth.jpg");
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.9,
        metalness: 0.05,
      });
      const earth = new THREE.Mesh(geo, mat);
      group.add(earth);

      const atmo = new THREE.Mesh(
        new THREE.SphereGeometry(1.045, 32, 32),
        new THREE.MeshBasicMaterial({
          color: 0x9aa7bb,
          transparent: true,
          opacity: 0.16,
          side: THREE.BackSide,
        }),
      );
      group.add(atmo);

      const addPin = (lat: number, lng: number, color: number) => {
        const v = latLngToVec(lat, lng, 1.02);
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(0.018, 12, 12),
          new THREE.MeshBasicMaterial({ color }),
        );
        m.position.set(v.x, v.y, v.z);
        group.add(m);
      };
      addPin(-33.92, 18.42, 0x3d8f6e);
      addPin(52.37, 4.89, 0xc45c2a);

      scene.add(new THREE.AmbientLight(0xb8c0cc, 0.7));
      const sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
      sun.position.set(3, 1.2, 2);
      scene.add(sun);

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

      let last = performance.now();
      const loop = (now: number) => {
        if (disposed) return;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (!reducedMotion) group.rotation.y += dt * 0.08;
        renderer!.render(scene, camera);
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro?.disconnect();
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [reducedMotion]);

  return <div ref={hostRef} className="absolute inset-0" aria-hidden="true" />;
}
