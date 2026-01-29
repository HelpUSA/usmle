import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { rows } = await query("SELECT NOW() as now");
    return NextResponse.json({ status: "ok", db: "up", dbTime: rows[0]?.now ?? null });
  } catch (err: any) {
    return NextResponse.json(
      { status: "ok", db: "down", error: err?.message ?? String(err) },
      { status: 200 }
    );
  }
}
