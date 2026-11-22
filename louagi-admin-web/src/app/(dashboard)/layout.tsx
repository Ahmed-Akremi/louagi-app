"use client";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { CenteredSpinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";

const SIDEBAR_KEY = "louagi.admin.sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user || user.role !== "admin") router.replace("/login");
  }, [ready, user, router]);

  // Restore the last collapse choice. Done in an effect (not initial state) so
  // server and client first render agree and hydration stays clean.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "collapsed");
    } catch {
      /* storage blocked — fall back to expanded */
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "expanded");
      } catch {
        /* storage blocked — choice just won't persist */
      }
      return next;
    });
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <CenteredSpinner />
      </div>
    );
  }
  if (!user || user.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      {/* Content column is offset by the fixed rail's width on lg+ and animates
          in step with the sidebar. Below lg the rail is hidden, so no offset. */}
      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-col transition-[padding] duration-200 ease-out",
          collapsed ? "lg:ps-[72px]" : "lg:ps-60",
        )}
      >
        <Topbar />
        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
