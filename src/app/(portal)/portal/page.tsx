import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { findSeedClientIdForUser } from "@/lib/auth/seed-users";
import { resolvePortalAccess } from "@/lib/auth/portal-access";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { getClientService } from "@/lib/clients/get-client-service";
import { handleListPortalProjects } from "@/lib/portal/portal-api";
import { getProjectService } from "@/lib/projects/get-project-service";

export const dynamic = "force-dynamic";

const PortalHomePage = async () => {
  const session = toAuthSession(await auth());
  const access = resolvePortalAccess(session, findSeedClientIdForUser);

  if (access.status === "redirect") {
    redirect(access.to);
  }

  const result = await handleListPortalProjects({
    session,
    clients: await getClientService(),
    projects: await getProjectService(),
  });

  if (result.status !== 200) {
    redirect("/signin");
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Your projects</h1>
        <p className="mt-2 text-slate-600">
          Status and delivery artifacts for your AgencyOS engagements.
        </p>
      </div>

      {result.body.length === 0 ? (
        <p className="text-sm text-slate-600">No projects yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {result.body.map((project) => (
            <li key={project.id} className="px-5 py-4">
              <Link
                href={`/portal/projects/${project.id}`}
                className="font-medium text-teal-800 hover:underline"
              >
                {project.name}
              </Link>
              <p className="mt-1 text-sm text-slate-600">
                Timeline {project.timelineStart} → {project.timelineEnd} · Budget{" "}
                {project.budget} · Spend {project.spend}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export default PortalHomePage;
