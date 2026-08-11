import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/auth";

const PortalLayout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-teal-800">
            AgencyOS
          </p>
          <p className="text-sm text-slate-600">Client portal</p>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/portal" className="text-teal-800 hover:underline">
            Projects
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/signin" });
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
    {children}
  </div>
);

export default PortalLayout;
