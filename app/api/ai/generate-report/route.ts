import { NextResponse } from "next/server";

export async function POST() {
  console.log("STEP 1 HIT");

  const start = Date.now();

  while (Date.now() - start < 3000) {
    // simulate work
  }

  console.log("STEP 2 DONE");

  return NextResponse.json({
    ok: true,
    message: "no supabase, no openai, pure execution works",
  });
}