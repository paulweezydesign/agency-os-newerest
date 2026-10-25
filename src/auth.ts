import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import type { JWT } from "next-auth/jwt";
import { findSeedUser, type AppRole } from "@/lib/auth/seed-users";
import {
  isGitHubOAuthConfigured,
  isLocalDemoAuthEnabled,
  resolveGitHubOperator,
  resolveActiveSessionIdentity,
} from "@/lib/auth/operator-identity";

declare module "next-auth" {
  interface User {
    role: AppRole;
    tenantId: string;
  }
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      role: AppRole;
      tenantId: string;
    };
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: AppRole;
    tenantId?: string;
    authSource?: "github" | "demo";
  }
}

const demoEnabled = isLocalDemoAuthEnabled(process.env.NODE_ENV, process.env.AGENCYOS_ENABLE_DEMO_AUTH);
const githubEnabled = isGitHubOAuthConfigured(process.env.AUTH_GITHUB_ID, process.env.AUTH_GITHUB_SECRET);

const providers = [
  ...(githubEnabled ? [GitHub] : []),
  ...(demoEnabled ? [Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    authorize: async (credentials) => {
      if (typeof credentials?.email !== "string" || typeof credentials?.password !== "string") return null;
      const user = findSeedUser(credentials.email, credentials.password);
      if (!user) return null;
      return { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId };
    },
  })] : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  pages: { signIn: "/signin" },
  callbacks: {
    signIn: async ({ user, account }) => {
      if (account?.provider === "github") {
        // GitHub account IDs are immutable. Never authorize by editable login or email.
        const operator = resolveGitHubOperator(
          account.providerAccountId,
          process.env.AGENCYOS_GITHUB_ADMIN_IDS,
          process.env.AGENCYOS_GITHUB_OPERATOR_IDS,
        );
        if (!operator) return false;
        user.id = operator.id;
        user.role = operator.role;
        user.tenantId = operator.tenantId;
        return true;
      }
      return account?.provider === "credentials" && demoEnabled;
    },
    jwt: async ({ token, user, account }) => {
      if (user && account) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.authSource = account.provider === "github" ? "github" : "demo";
      }
      return token;
    },
    session: async ({ session, token }) => {
      const typed = token as JWT;
      const authorized = resolveActiveSessionIdentity(typed, {
        environment: process.env.NODE_ENV,
        demoFlag: process.env.AGENCYOS_ENABLE_DEMO_AUTH,
        adminIds: process.env.AGENCYOS_GITHUB_ADMIN_IDS,
        operatorIds: process.env.AGENCYOS_GITHUB_OPERATOR_IDS,
      });
      return {
        ...session,
        user: {
          ...session.user,
          id: authorized?.id ?? "",
          role: authorized?.role ?? ("" as AppRole),
          tenantId: authorized?.tenantId ?? "",
        },
      };
    },
  },
  // Auth.js infers trust with AUTH_URL; never trust arbitrary proxy headers.
  trustHost: Boolean(process.env.AUTH_URL),
});
