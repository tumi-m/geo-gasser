import { useSyncExternalStore, type ComponentType } from "react";
import { flushSync } from "react-dom";

/**
 * Navigation without a framework: the History API, a listener list, and a
 * cross-fade between screens where the browser supports view transitions.
 */

export type Params = Record<string, string>;
export interface RouteDef {
  /** "/duel/:code" style; segments starting with ":" are params. */
  path: string;
  component: ComponentType<{ params: Params }>;
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

const currentPath = () => window.location.pathname;

function reducedMotion() {
  return (
    document.documentElement.classList.contains("reduce-motion") ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Go to an in-app path. Screens swap with a short cross-fade where supported. */
export function navigate(to: string, opts: { replace?: boolean } = {}) {
  if (to === window.location.pathname + window.location.search && !opts.replace) return;
  const go = () => {
    if (opts.replace) window.history.replaceState(null, "", to);
    else window.history.pushState(null, "", to);
    flushSync(notify);
    window.scrollTo(0, 0);
  };
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !reducedMotion()) doc.startViewTransition(go);
  else go();
}

export function useNavigate() {
  return navigate;
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, currentPath, () => "/");
}

export function matchPath(pattern: string, path: string): Params | null {
  const a = pattern.split("/").filter(Boolean);
  const b = path.split("/").filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}
