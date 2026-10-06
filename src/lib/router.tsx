import { Component, useEffect, useRef, type ComponentType, type ErrorInfo, type ReactNode } from "react";
import { matchPath, usePathname, type Params, type RouteDef } from "./navigation";

// The name in index.html, read once: every screen's title ends with it.
const APP_TITLE = typeof document === "undefined" ? "" : document.title;

/**
 * The whole router: match the path against a list, render that screen inside
 * an error boundary. Seven screens do not need a framework.
 */

export function Router({ routes, fallback }: { routes: RouteDef[]; fallback: ComponentType }) {
  const path = usePathname();
  let match: { route: RouteDef; params: Params } | null = null;
  for (const route of routes) {
    const params = matchPath(route.path, path);
    if (params) {
      match = { route, params };
      break;
    }
  }
  const title = match
    ? typeof match.route.title === "function"
      ? match.route.title(match.params)
      : match.route.title
    : undefined;
  useEffect(() => {
    document.title = title ? `${title} · ${APP_TITLE}` : APP_TITLE;
  }, [title]);
  // A new screen takes focus, so keyboard and screen-reader users start at
  // its top instead of on a button that has just disappeared. Not on the
  // first load: the browser already starts there.
  const shown = useRef(path);
  useEffect(() => {
    if (shown.current === path) return;
    shown.current = path;
    const main = document.querySelector("main");
    if (!(main instanceof HTMLElement) || main.contains(document.activeElement)) return;
    main.setAttribute("tabindex", "-1");
    main.focus({ preventScroll: true });
  }, [path]);
  if (!match) {
    const Fallback = fallback;
    return <Fallback />;
  }
  const Page = match.route.component;
  return (
    <ErrorBoundary key={match.route.path}>
      <Page params={match.params} />
    </ErrorBoundary>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    const message =
      this.state.error instanceof Error && this.state.error.message
        ? this.state.error.message
        : "An unexpected error occurred. Try reloading the page.";
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-2xl">Something went wrong</h1>
        <p className="max-w-md text-sm break-words text-muted">{message}</p>
        <button
          type="button"
          className="mt-2 h-11 rounded-[var(--radius-md)] bg-accent px-5 text-sm font-semibold text-accent-fg"
          onClick={() => window.location.assign("/")}
        >
          Back to the start
        </button>
      </main>
    );
  }
}
