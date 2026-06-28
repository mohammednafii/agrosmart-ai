/**
 * lib/session.ts — localStorage-backed auth session persistence.
 *
 * Single source of truth for the "agrosmart_session" key so every
 * component (Login, page.tsx, Dashboard) reads/writes it the same way.
 */

const SESSION_KEY = "agrosmart_session";

export interface AgroSmartSession {
  loggedIn: boolean;
  user: string;
}

export function saveSession(session: AgroSmartSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): AgroSmartSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AgroSmartSession;
    return parsed?.loggedIn ? parsed : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
