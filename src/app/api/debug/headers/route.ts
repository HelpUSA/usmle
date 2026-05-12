/*
 * File: src/app/api/debug/headers/route.ts
 *
 * Responsibility:
 * - Development-only diagnostic endpoint for checking whether selected request
 *   headers are reaching the Next.js API layer.
 *
 * Security behavior:
 * - Disabled in production.
 * - Does not return all headers.
 * - Does not return cookies, authorization headers, secrets, or raw request
 *   identity material.
 * - Reports only safe presence/diagnostic fields.
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export async function GET() {
  if (isProduction()) {
    return NextResponse.json(
      {
        error: "Not found",
      },
      {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const h = headers();

  return NextResponse.json(
    {
      environment: process.env.NODE_ENV,
      diagnostics: {
        has_x_user_id: Boolean(h.get("x-user-id")),
        has_cookie: Boolean(h.get("cookie")),
        has_authorization: Boolean(h.get("authorization")),
        host: h.get("host"),
        forwarded_host: h.get("x-forwarded-host"),
        forwarded_proto: h.get("x-forwarded-proto"),
        forwarded_for_present: Boolean(h.get("x-forwarded-for")),
        user_agent_present: Boolean(h.get("user-agent")),
      },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}