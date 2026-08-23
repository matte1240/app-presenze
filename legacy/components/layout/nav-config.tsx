import {
  Calendar,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Server,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type NavGroup = {
  /** Rendered as a small caption above the group; omit for the first group. */
  label?: string;
  items: NavItem[];
};

/*
 * Navigation is grouped by what the user is doing, not by who they are: the
 * daily work first, oversight second, administration last. A flat list of six
 * links — which is what the old top navbar rendered — gives no such ordering.
 */
const adminNav: NavGroup[] = [
  {
    items: [
      { href: "/dashboard/admin", label: "Panoramica", icon: LayoutDashboard },
      { href: "/dashboard/calendar", label: "Calendario", icon: Calendar },
    ],
  },
  {
    label: "Gestione",
    items: [
      { href: "/dashboard/requests", label: "Richieste", icon: ClipboardList },
      { href: "/dashboard/users", label: "Utenti", icon: Users },
      { href: "/dashboard/reports", label: "Report", icon: FileText },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/dashboard/manage-server", label: "Server", icon: Server },
    ],
  },
];

const employeeNav: NavGroup[] = [
  {
    items: [
      { href: "/dashboard/calendar", label: "Calendario", icon: Calendar },
      { href: "/dashboard/requests", label: "Richieste", icon: ClipboardList },
      { href: "/dashboard/reports", label: "Report", icon: FileText },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/dashboard/profile", label: "Profilo", icon: User }],
  },
];

export function getNavGroups(userRole: string): NavGroup[] {
  return userRole === "ADMIN" ? adminNav : employeeNav;
}

/** Label of the current route, for the topbar heading and the document title. */
export function getPageTitle(pathname: string, userRole: string): string {
  const match = getNavGroups(userRole)
    .flatMap((group) => group.items)
    .find((item) => item.href === pathname);

  return match?.label ?? "Dashboard";
}
