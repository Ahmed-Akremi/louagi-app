import { ReactNode } from "react";
import { Card } from "./Card";

export function KpiTile({
  label,
  value,
  icon,
  hint,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
          {label}
        </span>
        {icon ? <span className="text-brand">{icon}</span> : null}
      </div>
      <div className="mt-2 text-2xl font-bold text-text">{value}</div>
      {hint ? <div className="mt-1 text-xs text-text-muted">{hint}</div> : null}
    </Card>
  );
}
