"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { signOut } from "next-auth/react";
import { ChevronsLeft, LogOut, Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getNavGroups, getPageTitle, type NavGroup } from "./nav-config";
import {
  getCollapsedServerSnapshot,
  getCollapsedSnapshot,
  subscribeCollapsed,
  toggleCollapsed,
} from "./sidebar-store";

type AppShellProps = {
  userRole: string;
  userName?: string | null;
  userEmail?: string | null;
  children: React.ReactNode;
};

export default function AppShell({
  userRole,
  userName,
  userEmail,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot
  );

  const groups = getNavGroups(userRole);
  const title = getPageTitle(pathname, userRole);
  const displayName = userName || userEmail || "Utente";
  const roleLabel = userRole === "ADMIN" ? "Amministratore" : "Dipendente";

  useEffect(() => {
    if (!mobileOpen) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onEscape);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const handleLogout = async () => {
    setSigningOut(true);
    await signOut({ redirect: false });
    window.location.href = "/";
  };

  const closeMobile = () => setMobileOpen(false);

  const sidebarBody = (
    <>
      <nav className="scrollbar-slim flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((group, index) => (
          <NavSection
            key={group.label ?? `group-${index}`}
            group={group}
            pathname={pathname}
            collapsed={collapsed}
            onNavigate={closeMobile}
          />
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <Link
          href="/dashboard/profile"
          onClick={closeMobile}
          className={cn(
            "flex items-center gap-2.5 rounded-md p-2 transition-colors hover:bg-accent",
            collapsed && "justify-center"
          )}
          title={collapsed ? displayName : undefined}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[13px] font-semibold text-primary">
            {displayName.charAt(0).toUpperCase()}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-foreground">
                {displayName}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {roleLabel}
              </span>
            </span>
          )}
        </Link>

        <div
          className={cn(
            "mt-1 flex items-center gap-1",
            collapsed && "flex-col"
          )}
        >
          <ThemeToggle className="text-muted-foreground" />
          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            title="Esci"
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-[13px] font-medium",
              "text-muted-foreground transition-colors hover:bg-destructive-subtle hover:text-destructive",
              "disabled:cursor-not-allowed disabled:opacity-50",
              collapsed ? "justify-center" : "flex-1"
            )}
          >
            <LogOut className="size-4 shrink-0" />
            {!collapsed && (signingOut ? "Disconnessione…" : "Esci")}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ---------------------------------------------------------------- */}
      {/* Desktop sidebar                                                   */}
      {/* ---------------------------------------------------------------- */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-card md:flex",
          "transition-[width] duration-200 ease-[var(--ease-out-quart)]",
          collapsed ? "w-[68px]" : "w-60"
        )}
      >
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b border-border px-3",
            collapsed ? "justify-center" : "justify-between"
          )}
        >
          <Link href="/dashboard" className="flex min-w-0 items-center">
            <Logo
              className={cn(
                "w-auto",
                collapsed ? "h-7 max-w-[36px] object-contain object-left" : "h-8 max-w-[150px]"
              )}
            />
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Comprimi barra laterale"
              className="cursor-pointer rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronsLeft className="size-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Espandi barra laterale"
            className="mx-auto mt-2 cursor-pointer rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronsLeft className="size-4 rotate-180" />
          </button>
        )}

        {sidebarBody}
      </aside>

      {/* ---------------------------------------------------------------- */}
      {/* Mobile drawer                                                     */}
      {/* ---------------------------------------------------------------- */}
      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          onClick={() => setMobileOpen(false)}
          className={cn(
            "absolute inset-0 bg-foreground/20 backdrop-blur-[2px] transition-opacity duration-200",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex w-[17rem] max-w-[85vw] flex-col border-r border-border bg-card",
            "shadow-elevation-3 transition-transform duration-200 ease-[var(--ease-out-quart)]",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
            <Logo className="h-8 w-auto max-w-[150px]" />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Chiudi menu"
              className="cursor-pointer rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          {sidebarBody}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Content column                                                    */}
      {/* ---------------------------------------------------------------- */}
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-200 ease-[var(--ease-out-quart)]",
          collapsed ? "md:pl-[68px]" : "md:pl-60"
        )}
      >
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Apri menu"
          >
            <Menu />
          </Button>

          <h1 className="truncate text-sm font-semibold text-foreground">
            {title}
          </h1>

          <div className="ml-auto flex items-center gap-2 md:hidden">
            <ThemeToggle className="text-muted-foreground" />
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

function NavSection({
  group,
  pathname,
  collapsed,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  return (
    <div className="space-y-1">
      {group.label && !collapsed && (
        <p className="px-2 pb-1 text-[11px] font-medium text-muted-foreground/70">
          {group.label}
        </p>
      )}
      {group.label && collapsed && <div className="mx-2 border-t border-border" />}

      {group.items.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] font-medium",
              "transition-colors duration-100",
              collapsed && "justify-center",
              isActive
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            {/* A flush accent bar marks the active route — clearer at a glance
                than a tinted pill, and it survives a rebrand to any hue. */}
            {isActive && (
              <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary" />
            )}
            <Icon className="size-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </div>
  );
}
