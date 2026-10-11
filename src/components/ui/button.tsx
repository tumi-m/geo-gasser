import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";
import { useMono } from "@/lib/theme";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[transform,opacity,background-color,color] duration-150 ease-out focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 active:scale-[0.96] select-none",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:opacity-90",
        secondary: "border border-border bg-bg-elevated text-fg hover:bg-bg-subtle",
        ghost: "text-fg hover:bg-bg-subtle",
        za: "bg-za text-fg hover:opacity-90",
        nl: "bg-nl text-fg hover:opacity-90",
      },
      size: {
        sm: "h-10 rounded-[var(--radius-sm)] px-3 text-sm",
        md: "h-12 rounded-[var(--radius-md)] px-5 text-base",
        lg: "h-14 rounded-[var(--radius-lg)] px-6 text-lg",
        icon: "size-11 rounded-[var(--radius-md)]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

// Mono: buttons look like actions. A black block (white in the black match
// screen) for the primary one; a hairline box for the rest.
// Caps, Helvetica Bold, square corners; the accent is the hover and pressed
// state, never decoration. Steps take 120 ms, with no spring.
const monoButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap border font-bold uppercase tracking-[0.1em] transition-[background-color,color,border-color] duration-[120ms] ease-linear disabled:pointer-events-none disabled:opacity-40 active:translate-y-px select-none",
  {
    variants: {
      variant: {
        primary: "border-fg bg-fg text-bg hover:border-accent hover:bg-accent hover:text-accent-fg",
        secondary: "border-fg bg-bg text-fg hover:bg-bg-subtle",
        ghost: "border-transparent bg-transparent text-fg hover:bg-bg-subtle",
        za: "border-fg bg-fg text-bg hover:border-accent hover:bg-accent hover:text-accent-fg",
        nl: "border-fg bg-bg text-fg hover:bg-bg-subtle",
      },
      size: {
        sm: "h-10 px-3 text-[11px]",
        md: "h-12 px-5 text-xs",
        lg: "h-14 px-6 text-[13px]",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const variants = useMono() ? monoButtonVariants : buttonVariants;
    return <Comp className={cn(variants({ variant, size }), className)} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";
