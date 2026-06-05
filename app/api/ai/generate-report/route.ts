import { NextResponse } from "next/server";

export async function POST(req: Request) {
  console.log("🔥 RAW POST HIT");

  const body = await req.text();

  console.log("BODY:", body);

  return NextResponse.json({
    ok: true,
    received: body || "empty",
  });
}