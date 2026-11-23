import { NextResponse } from "next/server";
import { lookupPrices } from "@/lib/ebay";
import { errorResponse } from "@/lib/http";
import type { CardDetails } from "@/lib/types";

export const runtime = "nodejs";

/** Price preview for a card that hasn't been saved yet. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { card?: Partial<CardDetails>; query?: string };
    const report = await lookupPrices(body.card ?? {}, body.query);
    return NextResponse.json({ report });
  } catch (err) {
    return errorResponse(err);
  }
}
