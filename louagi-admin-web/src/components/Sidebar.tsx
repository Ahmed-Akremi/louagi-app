"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CarFront,
  Users,
  Route as RouteIcon,
  CreditCard,
  Send,
  ScrollText,
  ShieldCheck,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useLocale } from "@/context/I18nProvider";
import { Logo } from "@/components/Logo";

const NAV = [
  { href: "/overview", icon: LayoutDashboard, key: "admin:commandCenter", fallback: "Command center" },
  { href: "/drivers", icon: CarFront, key: "admin:navDrivers", fallback: "Drivers" },
  { href: "/users", icon: Users, key: "admin:navUsers", fallback: "Users" },
  { href: "/rides", icon: RouteIcon, key: "admin:navRides", fallback: "Rides" },
  { href: "/payments", icon: CreditCard, key: "admin:navPayments", fallback: "Payments" },
  { href: "/broadcast", icon: Send, key: "admin:navBroadcast", fallback: "Broadcast" },
  { href: "/audit", icon: ScrollText, key: "admin:navAudit", fallback: "Audit" },
  { href: "/profile", icon: ShieldCheck, key: "admin:navProfile", fallback: "Profile" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    // Fixed rail: stays put while the content column scrolls. Hidden below lg
    // (the dashboard has no mobile drawer yet). Width animates on collapse.
    <aside
      className={cn(
        "fixed inset-y-0 inset-s-0 z-40 hidden flex-col border-e border-white/6 bg-sidebar transition-[width] duration-200 ease-out lg:flex",
        collapsed ? "w-[72px]" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center gap-2.5",
          collapsed ? "justify-center px-0" : "px-5",
        )}
      >
        <Logo size={32} className="shrink-0 rounded-lg" />
        {!collapsed ? (
          <span className="truncate text-sm font-semibold text-sidebar-text">
            Louagi Admin
          </span>
        ) : null}
      </div>

      <nav className={cn("flex-1 space-y-1 py-2", collapsed ? "px-2" : "px-3")}>
        {NAV.map((item) => {
          const active = pathname?.startsWith(item.href) ?? false;
          const Icon = item.icon;
          const label = t(item.key, { defaultValue: item.fallback });
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center rounded-md py-2 text-sm font-medium outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-active/60",
                collapsed ? "justify-center px-0" : "gap-3 px-3",
                active
                  ? "bg-white/10 text-sidebar-text"
                  : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-text",
              )}
            >
              {/* Red left-bar marks the active route; works in both the wide and
                  the collapsed icon-only rail. */}
              <span
                className={cn(
                  "absolute inset-s-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-e-full bg-sidebar-active transition-opacity",
                  active ? "opacity-100" : "opacity-0",
                )}
              />
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed ? <span className="truncate">{label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/6 p-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className={cn(
            "flex w-full items-center rounded-md py-2 text-sm font-medium text-sidebar-muted outline-hidden transition-colors hover:bg-white/5 hover:text-sidebar-text focus-visible:ring-2 focus-visible:ring-sidebar-active/60",
            collapsed ? "justify-center px-0" : "gap-3 px-3",
          )}
        >
          {collapsed ? (
            <ChevronsRight className="h-[18px] w-[18px] shrink-0" />
          ) : (
            <>
              <ChevronsLeft className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">
                {t("admin:collapse", { defaultValue: "Collapse" })}
              </span>
              <span className="ms-auto text-[11px] text-sidebar-muted/70">
                v0.1.0
              </span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
