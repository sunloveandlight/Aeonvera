import { NextRequest, NextResponse } from "next/server";
import { runCoachPipeline } from "@/lib/coach/runCoachPipeline";

/**
 * POST /api/coach/run
 * Body: { userId: string }
 *
 * Triggers full Aeonvera intelligence loop:
 * health_state → coaching → alerts
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      );
    }

    const result = await runCoachPipeline(userId);

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}