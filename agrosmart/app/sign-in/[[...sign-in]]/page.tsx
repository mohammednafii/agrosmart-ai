import { SignIn } from "@clerk/nextjs";
import { AgrosmartLogo } from "@/components/ui/AgrosmartLogo";

/**
 * /sign-in — Clerk hosted sign-in page.
 *
 * The [[...sign-in]] catch-all handles all Clerk sub-paths
 * (SSO callbacks, factor one/two, forgot password, etc.).
 *
 * After successful sign-in, Clerk redirects to NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL (/)
 * which renders the Dashboard because useUser().isSignedIn === true.
 */
export default function SignInPage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-8"
      style={{ background: "#0a0a0b" }}
    >
      <AgrosmartLogo variant="wordmark" theme="dark" iconSize={36} />
      <SignIn />
    </div>
  );
}
