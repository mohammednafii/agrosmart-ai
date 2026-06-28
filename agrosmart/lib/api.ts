/**
 * lib/api.ts — Authenticated API client for FastAPI.
 *
 * Every request automatically attaches the Clerk JWT as an
 * Authorization: Bearer <token> header.
 *
 * Usage (inside any React component):
 *   const { authFetch } = useAuthenticatedFetch();
 *   const res = await authFetch("http://localhost:8000/predict?...", { method: "POST" });
 */

"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

export function useAuthenticatedFetch() {
  const { getToken } = useAuth();

  /**
   * Drop-in replacement for `fetch()` that injects the Clerk JWT.
   * Falls back to an unauthenticated request if the token is unavailable
   * (so the UI never silently breaks during edge cases like token refresh).
   */
  const authFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
      const token = await getToken();

      return fetch(input, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    },
    [getToken],
  );

  return { authFetch };
}
