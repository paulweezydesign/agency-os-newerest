import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { findSeedClientIdForUser } from "@/lib/auth/seed-users";
import { resolvePortalAccess } from "@/lib/auth/portal-access";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { getClientService } from "@/lib/clients/get-client-service";
import { getDesignReviewService } from "@/lib/design-reviews/get-design-review-service";
import { getArtifactService } from "@/lib/project-artifacts/get-artifact-service";
import { handleGetPortalProject } from "@/lib/portal/portal-api";
import { getProjectService } from "@/lib/projects/get-project-service";
import { DesignReviewActions } from "./design-review-actions";

export const dynamic = "force-dynamic";

type PortalProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

const PortalProjectPage = async ({ params }: PortalProjectPageProps) => {
  const { projectId } = await params;
  const session = toAuthSession(await auth());
  const access = resolvePortalAccess(session, findSeedClientIdForUser);

  if (access.status === "redirect") {
    redirect(access.to);
  }

  const result = await handleGetPortalProject({
    session,
    clients: await getClientService(),
    projects: await getProjectService(),
    artifacts: await getArtifactService(),
    projectId,
  });

  if (result.status === 404) {
    notFound();
  }

  if (result.status !== 200) {
    redirect("/signin");
  }

  const { project, artifacts } = result.body;
  const designReviews = await (
    await getDesignReviewService()
  ).listByProject(access.context.tenantId, projectId);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <div>
        <Link href="/portal" className="text-sm text-teal-800 hover:underline">
          ← All projects
        </Link>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">
          {project.name}
        </h1>
        <p className="mt-2 text-slate-600">
          Project status and delivery artifacts (no agency operator chrome).
        </p>
      </div>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Timeline
          </p>
          <p className="mt-1 font-medium">
            {project.timelineStart} → {project.timelineEnd}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Budget
          </p>
          <p className="mt-1 font-medium">{project.budget}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Spend</p>
          <p className="mt-1 font-medium">{project.spend}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-medium text-slate-900">Design reviews</h2>
        {designReviews.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No design reviews yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {designReviews.map((review) => (
              <li key={review.id} className="py-3">
                <p className="font-medium text-slate-900">
                  {review.title}{" "}
                  <span className="text-xs uppercase text-slate-500">
                    {review.status}
                  </span>
                </p>
                <a
                  href={review.assetUrl}
                  className="text-sm text-teal-800 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open asset
                </a>
                {review.annotation ? (
                  <p className="mt-1 text-sm text-slate-600">
                    Annotation: {review.annotation}
                  </p>
                ) : null}
                {review.status === "pending" || review.status === "annotated" ? (
                  <DesignReviewActions
                    projectId={projectId}
                    reviewId={review.id}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-medium text-slate-900">
          Delivery artifacts
        </h2>
        {artifacts.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No artifacts yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {artifacts.map((artifact) => (
              <li key={artifact.id} className="py-3">
                <p className="font-medium text-slate-900">
                  {artifact.title}{" "}
                  <span className="text-xs uppercase text-slate-500">
                    {artifact.kind}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                  {artifact.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
};

export default PortalProjectPage;
