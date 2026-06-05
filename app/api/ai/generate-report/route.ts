import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hit: "AI ROUTE IS ACTIVE",
    time: new Date().toISOString(),
  });
}

export async function POST() {
  return NextResponse.json({
    hit: "POST WORKS",
    time: new Date().toISOString(),
  });
}