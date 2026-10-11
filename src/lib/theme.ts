import { useSyncExternalStore } from "react";
import classicCss from "@/themes/classic.css?inline";
import type { ThemeId } from "@/lib/game";

/**
 * The look in force: Classic or Mono. The theme's stylesheet sits in a
 * <style> tag after the shared styles.css: Classic's alone, or Classic's
 * with Mono's skin on top. Classic ships with the app; the Mono skin loads
 * the first time someone picks it. The <html> element carries `theme-mono` for
 * the rare rule that must know, and components read the theme with
 * useTheme() once its stylesheet is in place.
 */

const THEME_COLOR: Record<ThemeId, string> = { classic: "#151515", mono: "#ffffff" };

let current: ThemeId = "classic";
let ticket = 0;
const listeners = new Set<() => void>();

async function cssFor(id: ThemeId): Promise<string> {
  if (id === "classic") return classicCss;
  // Mono is a skin over Classic: the same layout and motion, its own
  // colours, type and map.
  const skin = (await import("@/themes/mono.css?inline")).default;
  return `${classicCss}\n${skin}`;
}

function themeStyle(): HTMLStyleElement {
  let el = document.getElementById("atlas-theme") as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = "atlas-theme";
    document.head.appendChild(el);
  }
  return el;
}

/** Put a theme on the page. Resolves once its stylesheet is in force. */
export async function applyTheme(id: ThemeId): Promise<void> {
  if (typeof document === "undefined") return;
  const mine = ++ticket;
  let css: string;
  try {
    css = await cssFor(id);
  } catch {
    // Mono failed to load (offline, a stale deploy): stay on what we have.
    return;
  }
  // Two quick changes: the later one wins, whichever loads first.
  if (mine !== ticket) return;
  const style = themeStyle();
  if (style.dataset.theme !== id) {
    style.textContent = css;
    style.dataset.theme = id;
  }
  const root = document.documentElement;
  root.classList.toggle("theme-mono", id === "mono");
  root.dataset.theme = id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[id]);
  if (current !== id) {
    current = id;
    listeners.forEach((listener) => listener());
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The theme whose stylesheet is on the page now. */
export function useTheme(): ThemeId {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => "classic",
  );
}

/** Shorthand for the many places that only ask "is this Mono?". */
export function useMono(): boolean {
  return useTheme() === "mono";
}
