import {
  HTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

export function TableWrap({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("scrollbar-thin w-full overflow-x-auto", className)} {...rest} />
  );
}

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <table className={cn("w-full border-collapse text-sm", className)} {...rest} />
  );
}

export function Th({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-b border-border px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-text-muted",
        className,
      )}
      {...rest}
    />
  );
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "border-b border-border px-4 py-3 align-middle text-text",
        className,
      )}
      {...rest}
    />
  );
}

export function Tr({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("transition-colors hover:bg-card-muted/40", className)}
      {...rest}
    />
  );
}
