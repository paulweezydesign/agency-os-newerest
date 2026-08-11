import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveDashboardAccess } from "@/lib/auth/dashboard-access";
import { getSessionContext } from "@/lib/auth/session-context";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { handleListClients } from "@/lib/clients/clients-api";
import { getClientService } from "@/lib/clients/get-client-service";
import { CreateClientForm } from "./create-client-form";

export const dynamic = "force-dynamic";

const ClientsPage = async () => {
  const authSession = toAuthSession(await auth());
  const context = getSessionContext(authSession);
  const access = resolveDashboardAccess(context);

  if (access.status === "redirect") {
    redirect(access.to);
  }

  const service = await getClientService();
  const listed = await handleListClients({
    session: authSession,
    service,
  });

  const clients = listed.status === 200 ? listed.body : [];

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-800">
            AgencyOS
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            Clients
          </h1>
          <p className="mt-2 text-slate-600">
            Create and open clients for tenant {context!.tenantId}.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Dashboard
        </Link>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">New client</h2>
        <div className="mt-4">
          <CreateClientForm />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">All clients</h2>
        {clients.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No clients yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {clients.map((client) => (
              <li key={client.id} className="py-3">
                <Link
                  href={`/dashboard/clients/${client.id}`}
                  className="font-medium text-teal-800 hover:underline"
                >
                  {client.name}
                </Link>
                <p className="text-xs text-slate-500">
                  Created {new Date(client.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
};

export default ClientsPage;
