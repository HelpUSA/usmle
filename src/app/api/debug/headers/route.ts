import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function GET() {
  const h = headers();
  return NextResponse.json({
    "x-user-id": h.get("x-user-id"),
    all: Object.fromEntries(h.entries()),
  });
}
