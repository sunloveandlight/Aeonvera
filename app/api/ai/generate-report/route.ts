import { NextResponse } from "next/server";

export const runtime = "nodejs"; // 🔥 IMPORTANT FIX

export async function POST(req: Request) {
  console.log("🔥 POST HIT CONFIRMED");

  const body = await req.text();

  return NextResponse.json({
    ok: true,
    method: "POST",
    received: body,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    method: "GET fallback",
  });
}