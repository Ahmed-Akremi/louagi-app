import { ReactNode } from "react";
import { Info, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "info" | "success" | "warning" | "danger";

const STYLES: Record<Variant, string> = {
  info: "bg-info-bg text-info border-info/20",
  success: "bg-success-bg text-success border-success/20",
  warning: "bg-warning-bg text-warning border-warning/20",
  danger: "bg-danger-bg text-danger border-danger/20",
};

const ICONS: Record<Variant, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

export function Banner({
  variant = "info",
  title,
  body,
  action,
}: {
  variant?: Variant;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
}) {
  const Icon = ICONS[variant];
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3",
        STYLES[variant],
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1 text-sm">
        <p className="font-semibold">{title}</p>
        {body ? <div className="mt-0.5 opacity-90">{body}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
