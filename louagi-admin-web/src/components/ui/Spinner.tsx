import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-text-muted", className)} />;
}

export function CenteredSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-text-muted">
      <Spinner className="h-6 w-6" />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  );
}
