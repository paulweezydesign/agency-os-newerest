import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveDashboardAccess } from "@/lib/auth/dashboard-access";
import { getSessionContext } from "@/lib/auth/session-context";
import { toAuthSession } from "@/lib/auth/to-auth-session";
import { getPolicyGateService } from "@/lib/policy-gates/get-policy-gate-service";
import { handleListPolicyGates } from "@/lib/policy-gates/policy-gates-api";
import { PolicyGateDecisionButtons } from "./decision-buttons";
import { RequestClientEmailForm } from "./request-client-email-form";

export const dynamic = "force-dynamic";

const PolicyGatesPage = async () => {
  const authSession = toAuthSession(await auth());
  const context = getSessionContext(authSession);
  const access = resolveDashboardAccess(context);

  if (access.status === "redirect") {
    redirect(access.to);
  }

  const service = await getPolicyGateService();
  const listed = await handleListPolicyGates({
    session: authSession,
    service,
    pendingOnly: false,
  });
  const gates = listed.status === 200 ? listed.body : [];
  const pending = gates.filter((gate) => gate.status === "pending");
  const decided = gates.filter((gate) => gate.status !== "pending");

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-800">
            AgencyOS
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            Policy gate queue
          </h1>
          <p className="mt-2 text-slate-600">
            Client-facing and money actions wait here until an admin or
            agent-operator approves or denies them.
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
        <h2 className="text-lg font-medium text-slate-900">
          Request demo client email gate
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Creates a pending `client_email` gate. Approve runs a demo effect
          (no Resend send).
        </p>
        <div className="mt-4">
          <RequestClientEmailForm />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No pending gates.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {pending.map((gate) => (
              <li
                key={gate.id}
                className="rounded-md border border-slate-200 px-4 py-3"
              >
                <p className="font-medium text-slate-900">{gate.actionType}</p>
                <p className="mt-1 text-sm text-slate-600">
                  Requested by {gate.requestedBy}
                  {gate.projectId ? ` · project ${gate.projectId}` : ""}
                </p>
                <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-700">
                  {JSON.stringify(gate.payload, null, 2)}
                </pre>
                <div className="mt-3">
                  <PolicyGateDecisionButtons gateId={gate.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">Recent decisions</h2>
        {decided.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No decisions yet.</p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {decided.map((gate) => (
              <li
                key={gate.id}
                className="rounded-md border border-slate-100 px-3 py-2 text-sm text-slate-700"
              >
                {gate.status} · {gate.actionType} · decided by{" "}
                {gate.decidedBy ?? "unknown"}
                {gate.effectRan ? " · effect ran" : " · effect skipped"}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
};

export default PolicyGatesPage;
