import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveDashboardAccess } from "@/lib/auth/dashboard-access";
import { getSessionContext } from "@/lib/auth/session-context";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { handleGetProject } from "@/lib/projects/projects-api";
import { getProjectService } from "@/lib/projects/get-project-service";

export const dynamic = "force-dynamic";

type ProjectDetailPageProps = {
  params: Promise<{ projectId: string }>;
};

const ProjectDetailPage = async ({ params }: ProjectDetailPageProps) => {
  const { projectId } = await params;
  const authSession = toAuthSession(await auth());
  const context = getSessionContext(authSession);
  const access = resolveDashboardAccess(context);

  if (access.status === "redirect") {
    redirect(access.to);
  }

  const service = await getProjectService();
  const result = await handleGetProject({
    session: authSession,
    service,
    projectId,
  });

  if (result.status === 404) {
    notFound();
  }

  if (result.status !== 200) {
    redirect("/signin");
  }

  const project = result.body;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-800">
            AgencyOS
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            {project.name}
          </h1>
          <p className="mt-2 text-slate-600">Project detail</p>
        </div>
        <Link
          href={`/dashboard/clients/${project.clientId}`}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Back to client
        </Link>
      </header>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Budget
          </p>
          <p className="mt-1 font-medium text-slate-900">{project.budget}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Client
          </p>
          <p className="mt-1 font-medium text-slate-900">{project.clientId}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Timeline start
          </p>
          <p className="mt-1 font-medium text-slate-900">
            {project.timelineStart}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Timeline end
          </p>
          <p className="mt-1 font-medium text-slate-900">
            {project.timelineEnd}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Tenant
          </p>
          <p className="mt-1 font-medium text-slate-900">{project.tenantId}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Created
          </p>
          <p className="mt-1 font-medium text-slate-900">
            {new Date(project.createdAt).toLocaleString()}
          </p>
        </div>
      </section>
    </main>
  );
};

export default ProjectDetailPage;
