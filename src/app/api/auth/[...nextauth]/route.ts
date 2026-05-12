/*
 * File: src/app/api/auth/[...nextauth]/route.ts
 *
 * Responsibility:
 * - Expose NextAuth v4 GET/POST route handlers in the Next.js App Router.
 * - Use the centralized authOptions from src/auth.ts.
 *
 * Important behavior:
 * - Do not define authOptions here.
 * - Authentication providers, callbacks, session strategy, JWT settings,
 *   and secret handling must remain centralized in src/auth.ts.
 *
 * Runtime behavior:
 * - Authentication must run dynamically.
 * - This route uses the Node.js runtime because NextAuth v4 depends on
 *   Node-compatible behavior.
 */

import NextAuth from "next-auth";
import { authOptions } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };