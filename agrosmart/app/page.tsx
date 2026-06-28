"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ToastProvider } from "@/components/ui/toast";
import Landing from "@/components/Landing";
import Dashboard from "@/components/Dashboard";

/**
 * Home — root page (/).
 *
 * Auth state is owned by Clerk (useUser) instead of localStorage.
 *
 * Flow:
 *   Not signed in → Landing page
 *   Signed in     → Dashboard
 *
 * Sign-in / sign-up redirect to /sign-in and /sign-up (Clerk hosted pages).
 * After successful auth, Clerk redirects back here and isSignedIn becomes true.
 */
export default function Home() {
  const { isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  // Wait for Clerk to restore the session before rendering anything.
  // This prevents the landing page from flashing for an already-signed-in user.
  if (!isLoaded) return null;

  const handleLaunch = () => {
    if (isSignedIn) {
      // Already authenticated — the conditional below already shows Dashboard,
      // so nothing extra is needed. This branch handles the edge case where
      // the user clicks "Dashboard" on the landing page while already signed in.
    } else {
      router.push("/sign-in");
    }
  };

  const handleRegister = () => {
    router.push("/sign-up");
  };

  const handleSignOut = async () => {
    // signOut() invalidates the Clerk session on all devices (not just this tab).
    await signOut({ redirectUrl: "/" });
  };

  return (
    <ToastProvider>
      <main>
        {isSignedIn ? (
          <div className="h-screen w-full animate-fade-in">
            <Dashboard onSignOut={handleSignOut} />
          </div>
        ) : (
          <div className="animate-fade-in">
            <Landing
              isAuthenticated={false}
              onLaunch={handleLaunch}
              onRegister={handleRegister}
            />
          </div>
        )}
      </main>
    </ToastProvider>
  );
}
