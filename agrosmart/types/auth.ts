/**
 * types/auth.ts — Shared TypeScript types for authentication & user data.
 *
 * These mirror the backend's User model returned by GET /profile so that
 * the frontend and backend agree on the shape of the user object.
 */

/** User profile as returned by FastAPI GET /profile */
export interface UserProfile {
  id: string;         // Clerk user ID (sub claim)
  email: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

/** Shape stored in the Clerk JWT payload (relevant claims only) */
export interface ClerkJWTPayload {
  sub: string;   // Clerk user ID
  iss: string;   // Clerk Frontend API URL
  exp: number;
  iat: number;
}
