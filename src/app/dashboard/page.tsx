import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getSessionContext } from "@/lib/auth/session-context";
import { resolveDashboardAccess } from "@/lib/auth/dashboard-access";
import { connectMongo } from "@/lib/db/mongodb";

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
            Operator shell. Open Clients to create and manage client orgs.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/clients"
            className="rounded-md bg-teal-800 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            Clients
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              type="submit"
            >
              Sign out
            </button>
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
    </main>
  );
};

export default DashboardPage;
