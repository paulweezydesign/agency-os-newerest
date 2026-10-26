"use client";

import { useState } from "react";
import { startGitHubSignIn } from "./github-sign-in";

export function GitHubSignInButton({ redirectTo }: { redirectTo: string }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleClick = async () => {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      await startGitHubSignIn(redirectTo);
    } catch {
      setPending(false);
      setFailed(true);
    }
  };

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => void handleClick()}
        className="w-full rounded-lg bg-pink-600 px-5 py-3 text-base font-semibold text-white hover:bg-pink-700 focus-visible:outline-4 focus-visible:outline-pink-500 disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Redirecting to GitHub…" : "Continue with GitHub"}
      </button>
      {failed ? (
        <p role="alert" className="mt-2 text-sm text-red-500">
          Unable to start GitHub sign-in. Please try again.
        </p>
      ) : null}
    </div>
  );
}
