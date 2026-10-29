"use client";

import { signIn } from "next-auth/react";

// Auth.js handles the same-origin CSRF-protected POST, then navigates the
// browser to GitHub. Do not initiate OAuth through a Server Action redirect:
// the React fetch can follow that redirect as a cross-origin POST (CORS).
export const startGitHubSignIn = (redirectTo: string): Promise<void> =>
  signIn("github", { redirectTo });
