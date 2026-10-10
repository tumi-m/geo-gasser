import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-12 w-full border border-rule bg-bg px-4 text-base text-fg transition-[border-color] duration-[120ms] placeholder:text-subtle focus-visible:border-accent",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
