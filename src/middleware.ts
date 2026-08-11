import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getSessionContext } from "@/lib/auth/session-context";
import { resolveDashboardAccess } from "@/lib/auth/dashboard-access";

export const middleware = async (request: NextRequest) => {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });

  const session = token
    ? {
        user: {
          id: String(token.id ?? token.sub ?? ""),
          role: String(token.role ?? ""),
          tenantId: String(token.tenantId ?? ""),
        },
      }
    : null;

  const access = resolveDashboardAccess(getSessionContext(session));

  if (access.status === "redirect") {
    const url = new URL(access.to, request.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
};

export const config = {
  matcher: ["/dashboard/:path*"],
};
