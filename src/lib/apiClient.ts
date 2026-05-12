/*
 * File: src/lib/apiClient.ts
 *
 * Responsibility:
 * - Centralized frontend fetch helper for API calls.
 * - Adds JSON Content-Type automatically when a request body is present.
 * - Disables fetch caching for API reads/writes.
 * - Parses JSON responses safely.
 * - Preserves support for an explicit development-only x-user-id override.
 *
 * Important behavior:
 * - Production must NOT send a hardcoded x-user-id.
 * - In production, authenticated API routes should resolve the user from NextAuth/session.
 * - In development only, x-user-id may be injected by setting:
 *
 *   NEXT_PUBLIC_DEV_USER_ID=11111111-1111-1111-1111-111111111111
 */

const DEV_USER_ID =
  process.env.NODE_ENV !== "production"
    ? process.env.NEXT_PUBLIC_DEV_USER_ID
    : undefined;

function parseJsonSafely(text: string): unknown {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getErrorMessage(data: unknown, fallback: string): string {
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof (data as { error?: unknown }).error === "string"
  ) {
    return (data as { error: string }).error;
  }

  return fallback;
}

export async function apiFetch<T>(
  url: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);

  /*
   * Development-only override.
   *
   * This is intentionally disabled in production so real users are resolved
   * by the backend session/auth layer instead of a shared hardcoded ID.
   */
  if (DEV_USER_ID) {
    headers.set("x-user-id", DEV_USER_ID);
  }

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });

  const text = await res.text();
  const data = parseJsonSafely(text);

  if (!res.ok) {
    throw new Error(
      getErrorMessage(data, text || `Request failed (${res.status})`)
    );
  }

  return data as T;
}