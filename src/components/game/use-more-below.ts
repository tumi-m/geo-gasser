import { useEffect, useRef } from "react";

/**
 * Marks a scrolling box with `data-more` while it has content below the fold,
 * so CSS can fade its foot. Set outside React, so it is an attribute.
 */
export function useMoreBelow<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const more = el.scrollHeight - el.clientHeight - el.scrollTop > 4;
      if (more) el.setAttribute("data-more", "");
      else el.removeAttribute("data-more");
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
    ro?.observe(el);
    for (const child of Array.from(el.children)) ro?.observe(child);
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, []);
  return ref;
}
