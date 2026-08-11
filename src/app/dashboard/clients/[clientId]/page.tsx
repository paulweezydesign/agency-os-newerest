import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveDashboardAccess } from "@/lib/auth/dashboard-access";
import { getSessionContext } from "@/lib/auth/session-context";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { handleGetClient } from "@/lib/clients/clients-api";
import { getClientService } from "@/lib/clients/get-client-service";

export const dynamic = "force-dynamic";

type ClientDetailPageProps = {
  params: Promise<{ clientId: string }>;
};

const ClientDetailPage = async ({ params }: ClientDetailPageProps) => {
  const { clientId } = await params;
  const authSession = toAuthSession(await auth());
  const context = getSessionContext(authSession);
  const access = resolveDashboardAccess(context);

  if (access.status === "redirect") {
    redirect(access.to);
  }

  const service = await getClientService();
  const result = await handleGetClient({
    session: authSession,
    service,
    clientId,
  });

  if (result.status === 404) {
    notFound();
  }

  if (result.status !== 200) {
    redirect("/signin");
  }

  const client = result.body;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-800">
            AgencyOS
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            {client.name}
          </h1>
          <p className="mt-2 text-slate-600">Client detail</p>
        </div>
        <Link
          href="/dashboard/clients"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          All clients
        </Link>
      </header>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Name</p>
          <p className="mt-1 font-medium text-slate-900">{client.name}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Tenant
          </p>
          <p className="mt-1 font-medium text-slate-900">{client.tenantId}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Created
          </p>
          <p className="mt-1 font-medium text-slate-900">
            {new Date(client.createdAt).toLocaleString()}
          </p>
        </div>
      </section>
    </main>
  );
};

export default ClientDetailPage;
