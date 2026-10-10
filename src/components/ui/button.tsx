import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

// Buttons look like actions: a black block (white in the black match
// screen) for the primary one, framed in quotes; a hairline box for the rest.
// Caps, Helvetica Bold, square corners; the accent is the hover and pressed
// state, never decoration. Steps take 120 ms, with no spring.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 [--quote-pull:0.4rem] whitespace-nowrap border font-bold uppercase tracking-[0.1em] transition-[background-color,color,border-color] duration-[120ms] ease-linear disabled:pointer-events-none disabled:opacity-40 active:translate-y-px select-none",
  {
    variants: {
      variant: {
        primary: "quoted border-fg bg-fg text-bg hover:border-accent hover:bg-accent hover:text-accent-fg",
        secondary: "border-fg bg-bg text-fg hover:bg-bg-subtle",
        ghost: "border-transparent bg-transparent text-fg hover:bg-bg-subtle",
        za: "quoted border-fg bg-fg text-bg hover:border-accent hover:bg-accent hover:text-accent-fg",
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
    return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";
