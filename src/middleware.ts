import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { resolveDashboardAccessForRole } from "@/lib/auth/portal-access";
import { findSeedClientIdForUser } from "@/lib/auth/seed-users";
import { resolvePortalAccess } from "@/lib/auth/portal-access";
import type { AuthSession } from "@/lib/auth/session-context";

const toSession = (token: {
  id?: unknown;
  sub?: unknown;
  role?: unknown;
  tenantId?: unknown;
} | null): AuthSession => {
  if (!token) {
    return null;
  }

  return {
    user: {
      id: String(token.id ?? token.sub ?? ""),
      role: String(token.role ?? ""),
      tenantId: String(token.tenantId ?? ""),
    },
  };
};

export const middleware = async (request: NextRequest) => {
  const { pathname } = request.nextUrl;
  const isDashboard = pathname.startsWith("/dashboard");
  const isPortal = pathname.startsWith("/portal");

  if (!isDashboard && !isPortal) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });
  const session = toSession(token);

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
