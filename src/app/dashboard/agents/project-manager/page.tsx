import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSessionContext } from "@/lib/auth/session-context";
import { resolveDashboardAccess } from "@/lib/auth/dashboard-access";
import { ProjectManagerChat } from "./project-manager-chat";

export const dynamic = "force-dynamic";

const ProjectManagerAgentPage = async () => {
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

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-800">
            AgencyOS
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            Project Manager
          </h1>
          <p className="mt-2 text-slate-600">
            Orchestrator agent — list and create Tasks via tools. No deliverable
            execution.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Dashboard
        </Link>
      </header>

      <ProjectManagerChat />
    </main>
  );
};

export default ProjectManagerAgentPage;
