import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// ──────────────────────────────────────────────
// Route definitions
// ──────────────────────────────────────────────

/** Pages accessible without authentication */
const PUBLIC_PAGES = ["/", "/setup", "/reset-password", "/~offline"];

/** API prefixes accessible without authentication */
const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/health",
  "/api/setup",
  "/api/uploads",
];

/** Special public API paths (exact match) */
const PUBLIC_API_EXACT = ["/api/admin/backups/restore"];

/** Dashboard pages that require ADMIN role */
const ADMIN_PAGES = ["/dashboard/admin", "/dashboard/users", "/dashboard/manage-server"];

/** Static / framework paths that should always pass through */
const STATIC_PREFIXES = [
  "/_next",
  "/icons",
  "/sw.js",
  "/swe-worker",
  "/workbox-",
  // The PWA manifest is generated from the branding config at /manifest.webmanifest.
  // Browsers may request it without credentials, so it must stay unauthenticated.
  "/manifest.webmanifest",
  "/manifest.json",
  "/favicon.ico",
];

/** File extensions that are always public (static assets in /public/) */
const STATIC_EXTENSIONS = [
  ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
  ".css", ".js", ".map", ".woff", ".woff2", ".ttf", ".eot",
];

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function isStaticPath(pathname: string): boolean {
  if (STATIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "-")
  )) return true;

  // Allow all static asset files (e.g. /logo.svg, /icon-192x192.png)
  return STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}

function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGES.some((p) => pathname === p);
}

function isPublicApi(pathname: string): boolean {
  if (PUBLIC_API_EXACT.includes(pathname)) return true;
  return PUBLIC_API_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

function isAdminPage(pathname: string): boolean {
  return ADMIN_PAGES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

/**
 * Determine if an API route requires ADMIN role.
 *
 * Admin routes:
 *  - /api/admin/*
 *  - /api/users/* EXCEPT /api/users/me/* and /api/users/[id]/image
 *  - /api/requests/[id]  (sub-path = has segment after /api/requests/)
 */
function isAdminApiRoute(pathname: string): boolean {
  // /api/admin/* → admin (except the public restore endpoint handled above)
  if (pathname.startsWith("/api/admin/")) return true;

  // /api/users/* with exceptions
  if (pathname.startsWith("/api/users/")) {
    // /api/users/me/* → auth-only (not admin)
    if (pathname.startsWith("/api/users/me")) return false;
    // /api/users/[id]/image → auth-only (not admin)
    if (/^\/api\/users\/[^/]+\/image$/.test(pathname)) return false;
    // Everything else under /api/users/* → admin
    return true;
  }
  // /api/users (list/create) → admin
  if (pathname === "/api/users") return true;

  // /api/requests/[id] (with sub-path segment) → admin
  // Match: /api/requests/abc123 but NOT /api/requests
  if (/^\/api\/requests\/[^/]+/.test(pathname)) return true;

  return false;
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

/**
 * Log API request as structured JSON (Edge-compatible, console only).
 */
function logApiAccess(request: NextRequest): void {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const entry = {
    timestamp: new Date().toISOString(),
    category: "ACCESS",
    method: request.method,
    path: request.nextUrl.pathname,
    ip,
  };

  console.log(JSON.stringify(entry));
}

// ──────────────────────────────────────────────
// Proxy (replaces middleware in Next.js 16)
// ──────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Static assets — always pass through
  if (isStaticPath(pathname)) {
    return NextResponse.next();
  }

  // 2. Log all API requests
  if (isApiRoute(pathname)) {
    logApiAccess(request);
  }

  // 3. Public pages & API — pass through
  if (isPublicPage(pathname) || isPublicApi(pathname)) {
    return NextResponse.next();
  }

  // 4. Decode JWT token (Edge-compatible, no DB access)
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // 5. Not authenticated
  if (!token) {
    if (isApiRoute(pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Page — redirect to login
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/";
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 6. Admin-only routes
  const role = token.role as string | undefined;

  if (isAdminPage(pathname) && role !== "ADMIN") {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashUrl);
  }

  if (isApiRoute(pathname) && isAdminApiRoute(pathname) && role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden: Admin access required" },
      { status: 403 }
    );
  }

  // 7. Authenticated & authorized — pass through
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files served by Next.js.
     * This uses a negative lookahead to skip _next/static and _next/image.
     */
    "/((?!_next/static|_next/image).*)",
  ],
};
