"use client";
import { ReactNode } from "react";
import { ThemeProvider } from "@/context/ThemeProvider";
import { I18nProvider } from "@/context/I18nProvider";
import { QueryProvider } from "@/context/QueryProvider";
import { AuthProvider } from "@/context/AuthProvider";
import { ToastProvider } from "@/context/ToastProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <QueryProvider>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </QueryProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
