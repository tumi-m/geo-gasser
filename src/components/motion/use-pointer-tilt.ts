import { useEffect, type RefObject } from "react";

/**
 * Feeds `--mx` / `--my` (each -1…1, 0 at the centre) to every element under
 * `root` matching `selector` (or `root` itself) as a mouse moves over it, so
 * CSS can tilt or parallax it. Mouse only: touch has no hover to follow.
 * Values ease back to 0 on leave through the CSS transition.
 */
export function usePointerTilt(root: RefObject<HTMLElement | null>, selector?: string) {
  useEffect(() => {
    const host = root.current;
    if (!host || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = (selector ? (e.target as Element).closest(selector) : host) as HTMLElement | null;
      if (!el || !host.contains(el)) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const mx = ((e.clientX - r.left) / r.width) * 2 - 1;
        const my = ((e.clientY - r.top) / r.height) * 2 - 1;
        el.style.setProperty("--mx", mx.toFixed(3));
        el.style.setProperty("--my", my.toFixed(3));
      });
    };
    const leave = (e: PointerEvent) => {
      const el = (selector ? (e.target as Element).closest(selector) : host) as HTMLElement | null;
      if (!el || (e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) return;
      cancelAnimationFrame(raf);
      el.style.setProperty("--mx", "0");
      el.style.setProperty("--my", "0");
    };
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerout", leave);
    return () => {
      cancelAnimationFrame(raf);
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerout", leave);
    };
  }, [root, selector]);
}
