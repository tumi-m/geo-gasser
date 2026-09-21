import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function ModalShell({
  titleId,
  onClose,
  children,
  wide,
  className,
}: {
  titleId: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Callers pass inline handlers; keep the latest so the focus trap is set up
  // once per mount instead of re-running (and stealing focus) every render.

  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const root = panelRef.current;
    if (!root) return;
    const focusable = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea, select, [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((node) => node.tabIndex >= 0 && node.getClientRects().length > 0);
    focusable()[0]?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = focusable();
      if (!nodes.length) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bg/75 backdrop-blur-md p-3 sm:p-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "atlas-modal max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain w-full rounded-[var(--radius-xl)] border border-border bg-bg-elevated p-5 shadow-[var(--shadow-panel)]",
          wide ? "max-w-lg" : "max-w-md",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
