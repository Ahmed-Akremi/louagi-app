"use client";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import clsx from "clsx";
import { CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";

type ToastVariant = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
let counter = 0;

const ICONS: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const STYLES: Record<ToastVariant, string> = {
  success: "bg-success-bg text-success border-success/30",
  error: "bg-danger-bg text-danger border-danger/30",
  info: "bg-info-bg text-info border-info/30",
  warning: "bg-warning-bg text-warning border-warning/30",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = ++counter;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3800);
    },
    [],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.variant];
          return (
            <div
              key={toast.id}
              role="status"
              className={clsx(
                "pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium shadow-floating",
                STYLES[toast.variant],
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{toast.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const v = useContext(ToastContext);
  if (!v) throw new Error("useToast must be used inside ToastProvider");
  return v;
}
