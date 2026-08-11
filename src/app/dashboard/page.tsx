import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { getSessionContext } from "@/lib/auth/session-context";
import { resolveDashboardAccess } from "@/lib/auth/dashboard-access";
import { connectMongo } from "@/lib/db/mongodb";
import { getLinearRuntime } from "@/lib/linear/get-linear-runtime";

export const dynamic = "force-dynamic";

const DashboardPage = async () => {
  const session = await auth();
  const context = getSessionContext(
    session?.user
      ? {
          user: {
            id: session.user.id,
            role: session.user.role,
            tenantId: session.user.tenantId,
          },
        }
      : null,
  );
  const access = resolveDashboardAccess(context);

  if (access.status === "redirect") {
    redirect(access.to);
  }

  const mongo = await connectMongo();
  const { syncLogs } = await getLinearRuntime();
  const recentSyncLogs = await syncLogs.listByTenant(context!.tenantId, 10);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-800">
            AgencyOS
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            Dashboard
          </h1>
          <p className="mt-2 text-slate-600">
            Operator shell. Open Clients for CRM, or chat with the Project
            Manager agent.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/agents/project-manager"
            className="inline-flex h-8 items-center rounded-lg border border-teal-800 px-2.5 text-sm font-medium text-teal-900 hover:bg-teal-50"
          >
            Project Manager
          </Link>
          <Link
            href="/dashboard/clients"
            className="inline-flex h-8 items-center rounded-lg bg-teal-800 px-2.5 text-sm font-medium text-white hover:bg-teal-700"
          >
            Clients
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Role</p>
          <p className="mt-1 font-medium text-slate-900">{context!.role}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Tenant
          </p>
          <p className="mt-1 font-medium text-slate-900">{context!.tenantId}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Mongo
          </p>
          <p className="mt-1 font-medium text-slate-900">
            {mongo.ready ? "ready" : "not ready"}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Linear sync log
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Status/assignee mirror outcomes. Scope and description stay
          AgencyOS-owned; rejected tracker edits appear here.
        </p>
        {recentSyncLogs.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No sync events yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {recentSyncLogs.map((log) => (
              <li key={log.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-700">
                    {log.outcome}
                  </span>
                  <span className="text-xs text-slate-500">{log.direction}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-slate-800">{log.message}</p>
                {log.rejectedFields && log.rejectedFields.length > 0 ? (
                  <p className="mt-1 text-xs text-amber-800">
                    Rejected fields: {log.rejectedFields.join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
};

export default DashboardPage;
