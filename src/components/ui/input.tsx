import * as React from "react";
import { cn } from "@/lib/utils";
import { useMono } from "@/lib/theme";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  const mono = useMono();
  return (
    <input
      ref={ref}
      className={cn(
        mono
          ? "flex h-12 w-full border border-rule bg-bg px-4 text-base text-fg transition-[border-color] duration-[120ms] placeholder:text-subtle focus-visible:border-accent"
          : "flex h-12 w-full rounded-[var(--radius-md)] border border-border bg-bg-elevated px-4 text-base text-fg transition-[border-color,box-shadow] placeholder:text-subtle focus-visible:border-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
