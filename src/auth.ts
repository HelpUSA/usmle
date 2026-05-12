/*
 * File: src/auth.ts
 *
 * Responsibility:
 * - Configure NextAuth v4 for the USMLE platform.
 * - Use Google OAuth provider.
 * - Use JWT-based sessions.
 * - Keep session lifetime at 24 hours.
 * - Remain compatible with getServerSession(authOptions).
 *
 * Important identity behavior:
 * - session.user.id is set to the same deterministic UUID derived from email
 *   that src/lib/auth.ts uses for database user_id resolution.
 * - This avoids mismatch between frontend session identity and PostgreSQL
 *   users_profile.user_id.
 *
 * Required env vars in production:
 * - AUTH_GOOGLE_ID
 * - AUTH_GOOGLE_SECRET
 * - NEXTAUTH_SECRET
 * - NEXTAUTH_URL should also be configured in the deployment environment.
 */

import type { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import crypto from "crypto";

export const AUTH_MODULE_MARKER = "src/auth.ts";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

function isStrictProductionDeployment(): boolean {
  return process.env.VERCEL_ENV === "production";
}

function readRequiredAuthEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value && isStrictProductionDeployment()) {
    throw new Error(`${name} is not set`);
  }

  return value ?? "";
}

function readRequiredAuthSecret(name: string): string | undefined {
  const value = process.env[name]?.trim();

  if (!value && isStrictProductionDeployment()) {
    throw new Error(`${name} is not set`);
  }

  return value || undefined;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Generates a deterministic UUID-shaped value from email.
 *
 * This intentionally mirrors the API/database identity strategy in
 * src/lib/auth.ts, without importing that file to avoid an authOptions cycle.
 */
function stableUuidFromEmail(email: string): string {
  const normalizedEmail = normalizeEmail(email);
  const hash = crypto.createHash("sha256").update(normalizedEmail).digest();
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

export const authOptions: NextAuthOptions = {
  providers: [
    Google({
      clientId: readRequiredAuthEnv("AUTH_GOOGLE_ID"),
      clientSecret: readRequiredAuthEnv("AUTH_GOOGLE_SECRET"),
    }),
  ],

  secret: readRequiredAuthSecret("NEXTAUTH_SECRET"),

  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },

  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
  },

  callbacks: {
    async jwt({ token }) {
      if (typeof token.email === "string") {
        token.email = normalizeEmail(token.email);
      }

      return token;
    },

    async session({ session, token }) {
      const tokenEmail =
        typeof token.email === "string" ? normalizeEmail(token.email) : null;

      const sessionEmail =
        typeof session.user?.email === "string"
          ? normalizeEmail(session.user.email)
          : tokenEmail;

      if (session.user && sessionEmail) {
        session.user.email = sessionEmail;

        const sessionUser = session.user as typeof session.user & {
          id?: string;
        };

        sessionUser.id = stableUuidFromEmail(sessionEmail);
      }

      return session;
    },
  },
};