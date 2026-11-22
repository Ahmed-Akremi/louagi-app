"use client";
import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  widthClass,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal
        className={cn(
          "relative z-10 w-full rounded-xl border border-border bg-card shadow-floating",
          widthClass ?? "max-w-lg",
        )}
      >
        {title ? (
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-semibold text-text">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-text-muted hover:bg-card-muted hover:text-text"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        <div className="scrollbar-thin max-h-[70vh] overflow-y-auto p-5">
          {children}
        </div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
