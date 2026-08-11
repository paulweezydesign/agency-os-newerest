import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveDashboardAccess } from "@/lib/auth/dashboard-access";
import { getSessionContext } from "@/lib/auth/session-context";
import {
  isSeedTeammateRole,
  PROJECT_MANAGER_ROLE,
} from "@/lib/agents/seed-roster";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { AgentChat } from "../agent-chat";

export const dynamic = "force-dynamic";

type AgentPageProps = {
  params: Promise<{ name: string }>;
};

const AgentPage = async ({ params }: AgentPageProps) => {
  const { name } = await params;

  if (name === PROJECT_MANAGER_ROLE) {
    redirect("/dashboard/agents/project-manager");
  }

  if (!isSeedTeammateRole(name)) {
    notFound();
  }

  const authSession = toAuthSession(await auth());
  const context = getSessionContext(authSession);
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
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">{name}</h1>
          <p className="mt-2 text-slate-600">
            Seed roster teammate — scoped tools and policy-gate safety rules.
          </p>
        </div>
        <Link
          href="/dashboard/agents"
          className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Roster
        </Link>
      </header>

      <AgentChat agentName={name} />
    </main>
  );
};

export default AgentPage;
