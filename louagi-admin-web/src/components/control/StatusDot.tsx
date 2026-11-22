import { cn } from "@/lib/cn";

// A pulsing health indicator. Green when ok, red otherwise, with a soft ring
// in the matching semantic colour.
export function StatusDot({
  ok,
  label,
}: {
  ok: boolean;
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full ring-4",
          ok ? "bg-success ring-success/15" : "bg-danger ring-danger/15",
        )}
      />
      {label ? (
        <span className="text-xs font-medium text-text-muted">{label}</span>
      ) : null}
    </span>
  );
}
