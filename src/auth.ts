import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { JWT } from "next-auth/jwt";
import { findSeedUser } from "@/lib/auth/seed-users";
import type { AppRole } from "@/lib/auth/seed-users";

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
  }
}

const toAppRole = (value: unknown): AppRole => {
  if (value === "admin" || value === "agent-operator" || value === "client") {
    return value;
  }

  throw new Error(`Unexpected role on token: ${String(value)}`);
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;

        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = findSeedUser(email, password);

        if (!user) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
        };
      },
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
      }

      return token;
    },
    session: async ({ session, token }) => {
      const typedToken = token as JWT;

      return {
        ...session,
        user: {
          ...session.user,
          id: String(typedToken.id ?? ""),
          role: toAppRole(typedToken.role),
          tenantId: String(typedToken.tenantId ?? ""),
        },
      };
    },
  },
  trustHost: true,
});
