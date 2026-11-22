"use client";
import { ButtonHTMLAttributes, ReactNode, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

// Mirrors the mobile app's Button: navy is the primary action, brand-red the
// secondary/CTA. In dark mode the navy token is a light blue, so the primary
// button renders as a subtle tonal fill (matching the app's dark treatment).
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-navy text-white shadow-soft hover:opacity-90 dark:bg-navy/15 dark:text-navy",
  secondary: "bg-brand text-on-brand shadow-soft hover:bg-brand-pressed",
  outline: "border border-border bg-transparent text-text hover:bg-card-muted",
  ghost: "bg-transparent text-text-muted hover:bg-card-muted hover:text-text",
  danger: "bg-danger text-white shadow-soft hover:opacity-90",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3.5 text-xs gap-1.5",
  md: "h-10 px-5 text-sm gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    iconLeft,
    iconRight,
    disabled,
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center rounded-full font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-55",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : iconLeft}
      {children}
      {!loading ? iconRight : null}
    </button>
  );
});
