import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveDashboardAccess } from "@/lib/auth/dashboard-access";
import { getSessionContext } from "@/lib/auth/session-context";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { handleGetClient } from "@/lib/clients/clients-api";
import { getClientService } from "@/lib/clients/get-client-service";
import { handleListProjectsForClient } from "@/lib/projects/projects-api";
import { getProjectService } from "@/lib/projects/get-project-service";
import { CreateProjectForm } from "./create-project-form";
import { RunPipelineForm } from "./run-pipeline-form";

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

  const clientService = await getClientService();
  const projectService = await getProjectService();
  const result = await handleGetClient({
    session: authSession,
    service: clientService,
    clientId,
  });

  if (result.status === 404) {
    notFound();
  }

  if (result.status !== 200) {
    redirect("/signin");
  }

  const listed = await handleListProjectsForClient({
    session: authSession,
    service: projectService,
    clientId,
  });
  const projects = listed.status === 200 ? listed.body : [];
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
          <p className="mt-2 text-slate-600">
            Client detail and projects for tenant {context!.tenantId}.
          </p>
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
            Pipeline
          </p>
          <p className="mt-1 font-medium text-slate-900">
            {client.pipelineStage} · score {client.leadScore}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Contact
          </p>
          <p className="mt-1 font-medium text-slate-900">
            {client.contactEmail ?? "—"}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">Client pipeline</h2>
        <p className="mt-1 text-sm text-slate-600">
          Prospect → qualify → nurture/onboard with lead-score branching.
          Client email is policy-gated before Resend.
        </p>
        <div className="mt-4">
          <RunPipelineForm
            clientId={clientId}
            defaultEmail={client.contactEmail ?? ""}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">New project</h2>
        <div className="mt-4">
          <CreateProjectForm clientId={clientId} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">Projects</h2>
        {projects.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No projects yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {projects.map((project) => (
              <li key={project.id} className="py-3">
                <Link
                  href={`/dashboard/projects/${project.id}`}
                  className="font-medium text-teal-800 hover:underline"
                >
                  {project.name}
                </Link>
                <p className="text-xs text-slate-500">
                  Budget {project.budget} · {project.timelineStart} →{" "}
                  {project.timelineEnd}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
};

export default ClientDetailPage;
