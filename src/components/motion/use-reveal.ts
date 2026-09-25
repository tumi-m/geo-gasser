import { useEffect, type RefObject } from "react";

/**
 * Marks `[data-reveal]` children of `root` with `is-in` as they scroll into
 * view, so CSS can bring them in. Elements are only hidden once this has run
 * (`.reveal-armed` on the root), so the server HTML and no-JS stay visible.
 */
export function useRevealOnScroll(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const targets = [...el.querySelectorAll<HTMLElement>("[data-reveal]")];
    el.classList.add("reveal-armed");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.15 },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [root]);
}
