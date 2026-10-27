import { NextResponse } from "next/server";
import { nebiusClient } from "@/lib/nebius-client";

export async function GET() {
  try {
    const health = await nebiusClient.testConnection();
    return NextResponse.json({
      success: true,
      data: health,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to check Nebius health",
      },
      { status: 500 }
    );
  }
}
