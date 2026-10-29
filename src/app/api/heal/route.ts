import { NextResponse } from "next/server";
import { selfHealingOrchestrator } from "@/lib/self-healing-orchestrator";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code = body.code || "";
    const filename = body.filename || "sample_workflow.ts";

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { success: false, error: "Code content is required" },
        { status: 400 }
      );
    }

    if (Buffer.byteLength(code, "utf8") > 8192) {
      return NextResponse.json(
        { success: false, error: "Input code exceeds maximum allowed size of 8192 UTF-8 bytes" },
        { status: 400 }
      );
    }

    const session = await selfHealingOrchestrator.executeHealingLoop(code, filename);
    return NextResponse.json({
      success: true,
      data: session,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Self-healing loop failed" },
      { status: 500 }
    );
  }
}
