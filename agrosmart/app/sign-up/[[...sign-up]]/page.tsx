import { SignUp } from "@clerk/nextjs";
import { AgrosmartLogo } from "@/components/ui/AgrosmartLogo";

/**
 * /sign-up — Clerk hosted sign-up page.
 *
 * The [[...sign-up]] catch-all handles email verification,
 * OAuth callbacks, and any other Clerk sub-flow for registration.
 *
 * After successful sign-up, Clerk redirects to NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL (/)
 * which syncs the new user with the FastAPI database on first /predict call.
 */
export default function SignUpPage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-8"
      style={{ background: "#0a0a0b" }}
    >
      <AgrosmartLogo variant="wordmark" theme="dark" iconSize={36} />
      <SignUp />
    </div>
  );
}
