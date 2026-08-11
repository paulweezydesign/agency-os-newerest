import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

type SignInPageProps = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

const SignInPage = async ({ searchParams }: SignInPageProps) => {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/dashboard";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-800">
          AgencyOS
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use a seed operator account for local development.
        </p>
      </div>

      {params.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Sign-in failed. Check email and password.
        </p>
      ) : null}

      <form
        className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        action={async (formData) => {
          "use server";

          try {
            await signIn("credentials", {
              email: String(formData.get("email") ?? ""),
              password: String(formData.get("password") ?? ""),
              redirectTo: callbackUrl,
            });
          } catch (error) {
            if (error instanceof AuthError) {
              redirect(`/signin?error=CredentialsSignin&callbackUrl=${encodeURIComponent(callbackUrl)}`);
            }

            throw error;
          }
        }}
      >
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Email
          <input
            className="rounded-md border border-slate-300 px-3 py-2"
            name="email"
            type="email"
            defaultValue="operator@agencyos.local"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Password
          <input
            className="rounded-md border border-slate-300 px-3 py-2"
            name="password"
            type="password"
            defaultValue="operator-dev"
            required
          />
        </label>
        <button
          className="rounded-md bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          type="submit"
        >
          Sign in
        </button>
      </form>

      <p className="text-xs text-slate-500">
        Seed users: admin@agencyos.local / admin-dev ·
        operator@agencyos.local / operator-dev
      </p>
    </main>
  );
};

export default SignInPage;
