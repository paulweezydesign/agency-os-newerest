import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveDashboardAccess } from "@/lib/auth/dashboard-access";
import { getSessionContext } from "@/lib/auth/session-context";
import { SEED_ROSTER } from "@/lib/agents/seed-roster";
import { toAuthSession } from "@/lib/auth/to-auth-session";

export const dynamic = "force-dynamic";

const AgentsPage = async () => {
  const authSession = toAuthSession(await auth());
  const context = getSessionContext(authSession);
  const access = resolveDashboardAccess(context);

  if (access.status === "redirect") {
    redirect(access.to);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-800">
            AgencyOS
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            Seed roster
          </h1>
          <p className="mt-2 text-slate-600">
            Chat with seed teammate agents. The Project Manager may spawn up to
            10 extra specialists per Project.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Dashboard
        </Link>
      </header>

      <ul className="grid gap-3 md:grid-cols-2">
        {SEED_ROSTER.map((role) => (
          <li key={role}>
            <Link
              href={`/dashboard/agents/${role}`}
              className="block rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-teal-700"
            >
              <p className="font-medium text-slate-900">{role}</p>
              <p className="mt-1 text-sm text-slate-600">Open chat</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
};

export default AgentsPage;
