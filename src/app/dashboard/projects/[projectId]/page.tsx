import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveDashboardAccess } from "@/lib/auth/dashboard-access";
import { getSessionContext } from "@/lib/auth/session-context";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import {
  handleGetProject,
  handleListBudgetAlerts,
} from "@/lib/projects/projects-api";
import { getProjectService } from "@/lib/projects/get-project-service";
import { handleListTasksForProject } from "@/lib/tasks/tasks-api";
import { getTaskService } from "@/lib/tasks/get-task-service";
import { BindGithubForm } from "./bind-github-form";
import { CreateTaskForm } from "./create-task-form";
import { RecordSpendForm } from "./record-spend-form";
import { TaskBoard } from "./task-board";

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

  const projectService = await getProjectService();
  const taskService = await getTaskService();
  const result = await handleGetProject({
    session: authSession,
    service: projectService,
    projectId,
  });

  if (result.status === 404) {
    notFound();
  }

  if (result.status !== 200) {
    redirect("/signin");
  }

  const listed = await handleListTasksForProject({
    session: authSession,
    service: taskService,
    projectId,
  });
  const tasks = listed.status === 200 ? listed.body : [];
  const project = result.body;
  const alertsResult = await handleListBudgetAlerts({
    session: authSession,
    service: projectService,
    projectId,
  });
  const alerts = alertsResult.status === 200 ? alertsResult.body : [];
  const burnPercent =
    project.budget > 0
      ? Math.round((project.spend / project.budget) * 100)
      : project.spend > 0
        ? Number.POSITIVE_INFINITY
        : 0;

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
          <p className="mt-2 text-slate-600">
            Project board for tenant {context!.tenantId}.
          </p>
        </div>
        <Link
          href={`/dashboard/clients/${project.clientId}`}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Back to client
        </Link>
      </header>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Budget
          </p>
          <p className="mt-1 font-medium text-slate-900">{project.budget}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Spend / burn
          </p>
          <p className="mt-1 font-medium text-slate-900">
            {project.spend}
            {Number.isFinite(burnPercent) ? ` (${burnPercent}%)` : " (over)"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Timeline
          </p>
          <p className="mt-1 font-medium text-slate-900">
            {project.timelineStart} → {project.timelineEnd}
          </p>
        </div>
        <div className="md:col-span-3">
          <RecordSpendForm projectId={projectId} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">Budget alerts</h2>
        {alerts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            No budget guardrail alerts yet.
          </p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
              >
                {alert.threshold}% of budget crossed — spend {alert.spend} /{" "}
                {alert.budget} at {new Date(alert.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">GitHub binding</h2>
        <p className="mt-2 text-sm text-slate-600">
          Link a client repo (`owner/name`). Agents may open branches and PRs;
          merging stays human-owned.
        </p>
        <p className="mt-2 text-sm font-medium text-slate-900">
          Bound repo: {project.githubRepo ?? "none"}
        </p>
        <div className="mt-4">
          <BindGithubForm
            projectId={projectId}
            githubRepo={project.githubRepo}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">New task</h2>
        <div className="mt-4">
          <CreateTaskForm projectId={projectId} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-medium text-slate-900">Task board</h2>
        <TaskBoard projectId={projectId} tasks={tasks} />
      </section>
    </main>
  );
};

export default ProjectDetailPage;
