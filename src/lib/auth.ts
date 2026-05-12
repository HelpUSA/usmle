/*
 * File: src/lib/auth.ts
 *
 * Responsibility:
 * - Centralize API user identification logic.
 * - Support authenticated browser calls through NextAuth v4 session.
 * - Support development/test calls through x-user-id only outside production.
 * - Generate a deterministic UUID from the authenticated user's email so the
 *   same user maps consistently to users_profile.user_id in PostgreSQL.
 *
 * Preferred API helper:
 * - getUserIdForApi(req)
 *
 * Compatibility helper:
 * - getUserIdFromRequest(req)
 * - Header-only, development/test oriented.
 *
 * Important security behavior:
 * - x-user-id must not be trusted in production.
 * - In production, user identity should come from the authenticated session.
 */

import { AUTH_MODULE_MARKER, authOptions } from "@/auth";
import { getServerSession } from "next-auth";
import { createHash } from "crypto";

type ApiUser = {
  email: string;
  name: string | null;
  image: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isDevUserHeaderAllowed(): boolean {
  return process.env.NODE_ENV !== "production";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeHeaderUserId(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (!UUID_RE.test(trimmed)) {
    throw new Error("Invalid x-user-id header. Expected UUID.");
  }

  return trimmed.toLowerCase();
}

/**
 * Compatibility with PowerShell/dev/test calls.
 *
 * This helper is intentionally header-only.
 * For real authenticated browser/API use, prefer getUserIdForApi(req).
 *
 * Security:
 * - x-user-id is accepted only outside production.
 */
export function getUserIdFromRequest(req: Request): string {
  if (!isDevUserHeaderAllowed()) {
    throw new Error("x-user-id header is not allowed in production");
  }

  const userId = normalizeHeaderUserId(req.headers.get("x-user-id"));

  if (!userId) {
    throw new Error("Missing x-user-id header");
  }

  return userId;
}

/**
 * Obtains the authenticated user through NextAuth v4.
 */
export async function getUserFromSession(): Promise<ApiUser> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new Error("Not authenticated");
  }

  return {
    email: normalizeEmail(session.user.email),
    name: session.user.name ?? null,
    image: session.user.image ?? null,
  };
}

/**
 * Generates a deterministic UUID-shaped value from a string, usually email.
 *
 * Implementation:
 * - Uses the first 16 bytes of SHA-256.
 * - Sets UUID version bits.
 * - Sets RFC 4122 variant bits.
 *
 * Note:
 * - The UUID is deterministic, not random.
 * - The version bits are set for UUID compatibility with PostgreSQL uuid fields.
 */
function stableUuidFromString(input: string): string {
  const normalizedInput = input.trim().toLowerCase();
  const hash = createHash("sha256").update(normalizedInput).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/**
 * Preferred helper for API routes.
 *
 * Resolution order:
 * 1. Development/test x-user-id header, only outside production.
 * 2. Authenticated NextAuth session.
 *
 * Production behavior:
 * - Ignores x-user-id.
 * - Requires a valid authenticated session.
 */
export async function getUserIdForApi(req: Request): Promise<string> {
  if (isDevUserHeaderAllowed()) {
    const headerUserId = normalizeHeaderUserId(req.headers.get("x-user-id"));

    if (headerUserId) {
      return headerUserId;
    }
  }

  if (!AUTH_MODULE_MARKER) {
    throw new Error("Auth module marker missing.");
  }

  const user = await getUserFromSession();

  return stableUuidFromString(user.email);
}