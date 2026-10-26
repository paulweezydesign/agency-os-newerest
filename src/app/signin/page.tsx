import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { GitHubSignInButton } from "./github-sign-in-button";
import { isGitHubOAuthConfigured, isLocalDemoAuthEnabled, safeSignInReturnPath } from "@/lib/auth/operator-identity";

type SignInPageProps = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

const SignInPage = async ({ searchParams }: SignInPageProps) => {
  const params = await searchParams;
  const destination = safeSignInReturnPath(params.callbackUrl);
  const githubReady = isGitHubOAuthConfigured(process.env.AUTH_GITHUB_ID, process.env.AUTH_GITHUB_SECRET);
  const demoEnabled = isLocalDemoAuthEnabled(process.env.NODE_ENV, process.env.AGENCYOS_ENABLE_DEMO_AUTH);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-500">AgencyOS</p>
        <h1 className="mt-2 text-3xl font-semibold">Sign in</h1>
        <p className="mt-2 text-base">Private agency access. Approved GitHub accounts only.</p>
      </div>
      {params.error ? (
        <p role="alert" className="rounded-md border border-pink-500 px-4 py-3">
          Sign-in was not completed or this GitHub account is not authorized.
        </p>
      ) : null}
      {githubReady ? (
        <GitHubSignInButton redirectTo={destination} />
      ) : (
        <p className="rounded-md border border-amber-200 p-4 text-base" role="status">
          GitHub sign-in is not configured. Contact the AgencyOS administrator.
        </p>
      )}
      {demoEnabled ? (
        <form className="flex flex-col gap-4 rounded-xl border p-6" action={async (formData) => {
          "use server";
          try {
            await signIn("credentials", {
              email: String(formData.get("email") ?? ""),
              password: String(formData.get("password") ?? ""),
              redirectTo: destination,
            });
          } catch (error) {
            if (error instanceof AuthError) {
              redirect(`/signin?error=CredentialsSignin&callbackUrl=${encodeURIComponent(destination)}`);
            }
            throw error;
          }
        }}>
          <p className="text-sm font-semibold">Local development login</p>
          <label className="flex flex-col gap-1 text-base">Email
            <input className="rounded-md border px-3 py-3" name="email" type="email" autoComplete="username" required />
          </label>
          <label className="flex flex-col gap-1 text-base">Password
            <input className="rounded-md border px-3 py-3" name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="rounded-md border border-pink-500 px-4 py-3 font-semibold" type="submit">Sign in to local demo</button>
        </form>
      ) : null}
    </main>
  );
};

export default SignInPage;
