import { NextResponse } from "next/server";
import { ebayConfigured } from "@/lib/ebay";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    claude: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
    ebay: ebayConfigured(),
  });
}
