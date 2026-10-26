import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readAuthSessionToken } from "@/lib/auth/read-session-token";
import { resolveDashboardAccessForRole } from "@/lib/auth/portal-access";
import { findSeedClientIdForUser } from "@/lib/auth/seed-users";
import { resolvePortalAccess } from "@/lib/auth/portal-access";
import { toMiddlewareAuthSession } from "@/lib/auth/middleware-session";

export const middleware = async (request: NextRequest) => {
  const { pathname } = request.nextUrl;
  const isDashboard = pathname.startsWith("/dashboard");
  const isPortal = pathname.startsWith("/portal");

  if (!isDashboard && !isPortal) {
    return NextResponse.next();
  }

  const token = await readAuthSessionToken(request, process.env.AUTH_SECRET);
  // Recheck the active allowlist on every protected page request.
  const session = toMiddlewareAuthSession(token, {
    environment: process.env.NODE_ENV,
    demoFlag: process.env.AGENCYOS_ENABLE_DEMO_AUTH,
    adminIds: process.env.AGENCYOS_GITHUB_ADMIN_IDS,
    operatorIds: process.env.AGENCYOS_GITHUB_OPERATOR_IDS,
  });

  if (isDashboard) {
    const access = resolveDashboardAccessForRole(session);
    if (access.status === "redirect") {
      const url = new URL(access.to, request.nextUrl.origin);
      if (access.to === "/signin") {
        url.searchParams.set("callbackUrl", pathname);
      }
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const access = resolvePortalAccess(session, findSeedClientIdForUser);
  if (access.status === "redirect") {
    const url = new URL(access.to, request.nextUrl.origin);
    if (access.to === "/signin") {
      url.searchParams.set("callbackUrl", pathname);
    }
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
};

export const config = {
  matcher: ["/dashboard/:path*", "/portal/:path*"],
};
