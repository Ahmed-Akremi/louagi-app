"use client";
import {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  forwardRef,
} from "react";
import { cn } from "@/lib/cn";

// 12px radius + 1.5px border + navy focus, matching the mobile app's Input.
const baseControl =
  "w-full rounded-lg border-[1.5px] border-border bg-bg px-3 py-2.5 text-sm text-text placeholder:text-text-muted/70 focus:border-navy focus:outline-hidden focus:ring-2 focus:ring-navy/20 disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(baseControl, className)} {...rest} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea ref={ref} className={cn(baseControl, "resize-y", className)} {...rest} />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(baseControl, "pr-8", className)} {...rest}>
      {children}
    </select>
  );
});

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label?: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      {label ? (
        <span className="mb-1.5 block text-xs font-medium text-text-muted">
          {label}
        </span>
      ) : null}
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-text-muted">{hint}</span>
      ) : null}
    </label>
  );
}
