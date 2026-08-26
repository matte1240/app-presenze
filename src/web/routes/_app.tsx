import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  Clock3,
  CreditCard,
  LogOut,
  Menu,
  Moon,
  Server,
  ShieldAlert,
  Sun,
  User,
  Users,
  X,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import { sessionQuery, useLogout, type CurrentUser } from "../api/session";
import { SubscriptionBanner } from "../features/billing/status-banner";
import { t } from "../i18n/it";
import { cn } from "../ui/cn";
import { Avatar, Button } from "../ui/primitives";
import { useTheme } from "../ui/theme";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery);
    if (!session) throw redirect({ to: "/", search: { expired: true } });
    return {
      user: session.user,
      organization: session.organization,
      impersonated: session.impersonated,
    };
  },
  component: AppShell,
});

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  employeeOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: "/calendario", label: t.nav.calendar, icon: CalendarDays },
  { to: "/richieste", label: t.nav.requests, icon: ClipboardList },
  { to: "/report", label: t.nav.reports, icon: ChartColumn },
  { to: "/utenti", label: t.nav.users, icon: Users, adminOnly: true },
  { to: "/organizzazione", label: t.nav.organization, icon: Building2, adminOnly: true },
  { to: "/abbonamento", label: t.nav.billing, icon: CreditCard, adminOnly: true },
  { to: "/manutenzione", label: t.nav.maintenance, icon: Server, adminOnly: true },
  { to: "/profilo", label: t.nav.profile, icon: User },
];

function visibleTo(user: CurrentUser) {
  return NAV.filter(
    (item) =>
      (!item.adminOnly || user.role === "ADMIN") && (!item.employeeOnly || user.role === "EMPLOYEE"),
  );
}

function AppShell() {
  const { user, organization, impersonated } = Route.useRouteContext();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const items = visibleTo(user);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = items.find((i) => pathname.startsWith(i.to))?.label ?? "Presenze";

  return (
    <div className="min-h-dvh bg-background">
      <Sidebar items={items} className="hidden lg:flex" />

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label={t.app.close}
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <Sidebar items={items} className="relative flex h-full w-56" onNavigate={() => setDrawerOpen(false)} />
        </div>
      ) : null}

      <div className="lg:pl-56">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setDrawerOpen(true)} aria-label="Menu">
            <Menu aria-hidden />
          </Button>

          <h1 className="min-w-0 flex-1 truncate text-label font-semibold">{title}</h1>

          <ThemeToggle />
          <UserMenu user={user} />
        </header>

        {/* Not dismissible, and above everything: somebody from support being
            inside this account is not a detail to tuck away. */}
        {impersonated ? (
          <div className="flex items-center gap-2 bg-warning px-4 py-2 text-label text-warning-foreground">
            <ShieldAlert className="size-4 shrink-0" aria-hidden />
            {t.platform.impersonationBanner}
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-[88rem] p-4 sm:px-6 sm:py-5">
          <SubscriptionBanner organization={organization} isAdmin={user.role === "ADMIN"} />
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  items,
  className,
  onNavigate,
}: {
  items: NavItem[];
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <nav
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-56 flex-col border-r border-border bg-surface",
        className,
      )}
    >
      <div className="flex h-12 items-center justify-between gap-2 border-b border-border px-4">
        <span className="flex items-center gap-2 text-label font-semibold tracking-[-0.01em]">
          <Clock3 className="size-4 text-primary" aria-hidden />
          Presenze
        </span>
        {onNavigate ? (
          <Button variant="ghost" size="icon-sm" onClick={onNavigate} aria-label={t.app.close}>
            <X aria-hidden />
          </Button>
        ) : null}
      </div>

      <div className="flex-1 space-y-0.5 overflow-y-auto px-4 py-2">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-label font-medium",
              "text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground",
              "data-[status=active]:bg-surface-sunken data-[status=active]:text-foreground",
              // A rail rather than a wash: the accent marks position, it does
              // not colour a whole block of the sidebar.
              "before:absolute before:inset-y-1.5 before:-left-2 before:w-0.5 before:rounded-r-full",
              "before:bg-transparent data-[status=active]:before:bg-primary",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const dark = theme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Passa al tema chiaro" : "Passa al tema scuro"}
    >
      {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}

function UserMenu({ user }: { user: CurrentUser }) {
  const logout = useLogout();
  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right sm:block">
        <p className="text-label font-medium leading-tight">{user.name}</p>
        <p className="text-micro text-muted-foreground">{t.users.roles[user.role]}</p>
      </div>
      <Avatar name={user.name} />
      <Button variant="ghost" size="icon-sm" onClick={() => logout.mutate()} aria-label={t.auth.signOut}>
        <LogOut aria-hidden />
      </Button>
    </div>
  );
}
