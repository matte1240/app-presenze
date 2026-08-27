import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { platformMeQuery, usePlatformLogout } from "../api/platform";
import { t } from "../i18n/it";
import { Button } from "../ui/primitives";

/**
 * The back-office layout.
 *
 * It exists because of a defect worth remembering. `piattaforma/organizzazioni`
 * is a child route of this file whether this file wants children or not, and
 * while this file *was* the sign-in page — with no `<Outlet/>` — signing in led
 * straight back to the sign-in page. The whole section was unreachable in a
 * browser while every API test passed, because no API test navigates. The smoke
 * suite in `e2e/` is the other half of that lesson.
 *
 * The chrome appears only once there is a session, so the sign-in page beneath
 * it stays bare.
 */
export const Route = createFileRoute("/piattaforma")({ component: BackOfficeLayout });

function BackOfficeLayout() {
  const { data } = useQuery(platformMeQuery);
  const logout = usePlatformLogout();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!data) {
    return (
      <div className="min-h-dvh bg-background">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur">
        <Link
          to="/piattaforma/organizzazioni"
          className="flex items-center gap-2 text-label font-semibold tracking-[-0.01em]"
        >
          <ShieldCheck className="size-4 text-primary" aria-hidden />
          {t.platform.title}
        </Link>

        <nav className="flex flex-1 items-center gap-1">
          <NavLink to="/piattaforma/organizzazioni" active={pathname.includes("/organizz")}>
            {t.platform.organizations}
          </NavLink>
          <NavLink to="/piattaforma/amministratori" active={pathname.endsWith("/amministratori")}>
            {t.platform.admins}
          </NavLink>
          <NavLink to="/piattaforma/backup" active={pathname.endsWith("/backup")}>
            {t.platform.backups}
          </NavLink>
        </nav>

        <span className="hidden text-label text-muted-foreground sm:inline">{data.admin.email}</span>
        <Button variant="ghost" size="sm" onClick={() => logout.mutate()}>
          {t.auth.signOut}
        </Button>
      </header>

      <Outlet />
    </div>
  );
}

function NavLink({
  to,
  active,
  children,
}: {
  to: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className={
        active
          ? "rounded-sm px-2.5 py-1 text-label font-medium text-foreground"
          : "rounded-sm px-2.5 py-1 text-label text-muted-foreground transition-colors hover:text-foreground"
      }
    >
      {children}
    </Link>
  );
}
