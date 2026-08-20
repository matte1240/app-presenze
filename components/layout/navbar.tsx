"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { Logo } from "@/components/ui/logo";
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  ClipboardList,
  Server,
  User,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

type NavbarProps = {
  userRole: string;
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
};

export default function Navbar({
  userRole,
  userName,
  userEmail,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userImage: _userImage,
}: NavbarProps) {
  const pathname = usePathname();
  const [isPending, setIsPending] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    setIsPending(true);
    await signOut({ redirect: false });
    window.location.href = "/";
  };

  // Close mobile menu on route change
  useEffect(() => {
    const t = setTimeout(() => setIsMobileMenuOpen(false), 0);
    return () => clearTimeout(t);
  }, [pathname]);

  // Close mobile menu on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileMenuOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileMenuOpen]);

  const adminLinks = [
    {
      href: "/dashboard/admin",
      label: "Overview",
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      href: "/dashboard/users",
      label: "Utenti",
      icon: <Users className="w-4 h-4" />,
    },
    {
      href: "/dashboard/calendar",
      label: "Calendario",
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      href: "/dashboard/reports",
      label: "Report",
      icon: <FileText className="w-4 h-4" />,
    },
    {
      href: "/dashboard/requests",
      label: "Richieste",
      icon: <ClipboardList className="w-4 h-4" />,
    },
    {
      href: "/dashboard/manage-server",
      label: "Manage Server",
      icon: <Server className="w-4 h-4" />,
    },
  ];

  const employeeLinks = [
    {
      href: "/dashboard/calendar",
      label: "Calendario",
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      href: "/dashboard/reports",
      label: "Report",
      icon: <FileText className="w-4 h-4" />,
    },
    {
      href: "/dashboard/requests",
      label: "Richieste",
      icon: <ClipboardList className="w-4 h-4" />,
    },
    {
      href: "/dashboard/profile",
      label: "Profilo",
      icon: <User className="w-4 h-4" />,
    },
  ];

  const links = userRole === "ADMIN" ? adminLinks : employeeLinks;

  return (
    <>
      <nav className="bg-background/80 backdrop-blur-md border-b border-border/40 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Logo/Brand */}
            <div className="flex items-center h-full">
              <Link href="/dashboard" className="flex items-center h-full py-3 group">
                {/* Capped so a wide customer logo — or the generated wordmark
                    for a long product name — cannot crowd out the nav links. */}
                <Logo className="h-10 w-auto max-w-[200px] transition-transform group-hover:scale-105 translate-y-0.5" />
              </Link>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center space-x-1">
              {links.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* Desktop User Menu */}
            <div className="hidden md:flex items-center space-x-4">
              <ThemeToggle />
              <Link
                href="/dashboard/profile"
                className="flex items-center gap-3 hover:opacity-80 transition-opacity group"
              >
                <div className="text-right">
                  <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {userName || userEmail}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {userRole === "ADMIN" ? "Amministratore" : "Dipendente"}
                  </div>
                </div>
                <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-semibold overflow-hidden relative border border-border">
                  {(userName || userEmail || "U").charAt(0).toUpperCase()}
                </div>
              </Link>
              <button
                onClick={handleLogout}
                disabled={isPending}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-destructive-foreground bg-destructive hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-destructive disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                {isPending ? "..." : "Esci"}
              </button>
            </div>

            {/* Mobile Logout Button */}
            <div className="flex items-center gap-2 md:hidden">
              <ThemeToggle />
              <button
                onClick={handleLogout}
                disabled={isPending}
                className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-destructive-foreground bg-destructive hover:bg-destructive/90 disabled:opacity-50 cursor-pointer transition-colors"
              >
                {isPending ? "..." : "Esci"}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Sidebar Drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden transition-opacity duration-300",
          isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Overlay */}
        <div
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />

        {/* Drawer */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-background border-r border-border shadow-2xl transform transition-transform duration-300 ease-out",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background">
            <Link
              href="/dashboard/profile"
              className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent overflow-hidden relative border border-border">
                <span className="text-lg font-bold text-foreground">
                  {(userName || userEmail || "U").charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {userName || userEmail}
                </div>
                <div className="text-xs text-muted-foreground">
                  {userRole === "ADMIN" ? "Amministratore" : "Dipendente"}
                </div>
              </div>
            </Link>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Close menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <span className="w-5 h-5 flex items-center justify-center">
                    {link.icon}
                  </span>
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Drawer Footer */}
          <div className="border-t border-border px-4 py-4">
            <button
              onClick={handleLogout}
              disabled={isPending}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 border border-transparent text-sm font-semibold rounded-lg text-destructive-foreground bg-destructive hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-destructive disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all shadow-md"
            >
              <LogOut className="h-5 w-5" />
              {isPending ? "Disconnessione..." : "Esci"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
