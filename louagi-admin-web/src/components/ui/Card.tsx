import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

// Mirrors the app's Card variants: elevated (default, white + shadow), tonal
// (muted surface, no shadow), and hero (navy emphasis block).
type CardVariant = "elevated" | "tonal" | "hero";

const CARD_VARIANTS: Record<CardVariant, string> = {
  elevated: "border border-border bg-card shadow-card",
  tonal: "border border-border bg-card-muted",
  hero: "bg-navy text-white dark:bg-navy/15 dark:text-navy",
};

export function Card({
  className,
  variant = "elevated",
  ...rest
}: HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  return (
    <div
      className={cn("rounded-xl", CARD_VARIANTS[variant], className)}
      {...rest}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-text">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...rest} />;
}
