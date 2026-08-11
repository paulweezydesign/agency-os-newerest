import Link from "next/link";

const HomePage = () => (
  <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6">
    <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-800">
      AgencyOS
    </p>
    <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
      Operate the agency. Orchestrate the agents.
    </h1>
    <p className="max-w-xl text-lg text-slate-600">
      Sign in as an operator to open the empty dashboard shell. Session context
      carries your role and tenantId.
    </p>
    <div>
      <Link
        href="/signin"
        className="inline-flex rounded-md bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
      >
        Sign in
      </Link>
    </div>
  </main>
);

export default HomePage;
