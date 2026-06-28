/**
 * middleware.ts — Clerk auth middleware for Next.js App Router.
 *
 * clerkMiddleware() initializes Clerk on every matched request so that
 * useUser() / useAuth() work correctly on the client.
 *
 * Public routes (no sign-in required at the edge):
 *   /            → Landing page (React decides whether to show dashboard)
 *   /sign-in/*   → Clerk hosted sign-in
 *   /sign-up/*   → Clerk hosted sign-up
 *
 * All other routes inherit Clerk's session context but are NOT forcibly
 * redirected here — the React components handle that.
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  // Non-public routes: require authentication (redirects to /sign-in if not signed in)
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Run on all paths except Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
