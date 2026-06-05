import { NextResponse } from "next/server";

export async function POST() {
  console.log("🔥 POST WORKS");

  return NextResponse.json({
    ok: true,
    method: "POST working",
  });
}