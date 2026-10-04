import { Component, type ComponentType, type ErrorInfo, type ReactNode } from "react";
import { matchPath, usePathname, type RouteDef } from "./navigation";

/**
 * The whole router: match the path against a list, render that screen inside
 * an error boundary. Seven screens do not need a framework.
 */

export function Router({ routes, fallback }: { routes: RouteDef[]; fallback: ComponentType }) {
  const path = usePathname();
  for (const route of routes) {
    const params = matchPath(route.path, path);
    if (params) {
      const Page = route.component;
      return (
        <ErrorBoundary key={route.path}>
          <Page params={params} />
        </ErrorBoundary>
      );
    }
  }
  const Fallback = fallback;
  return <Fallback />;
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
