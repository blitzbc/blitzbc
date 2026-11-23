import { NextResponse } from "next/server";
import { getCard, savePriceReport } from "@/lib/db";
import { lookupPrices } from "@/lib/ebay";
import { errorResponse, parseId } from "@/lib/http";

export const runtime = "nodejs";

/** Fetches fresh prices for a saved card and records them in its history. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await params).id);
    const card = id ? getCard(id) : null;
    if (!id || !card) return NextResponse.json({ error: "Card not found." }, { status: 404 });
    const report = await lookupPrices(card, card.search_query || undefined);
    savePriceReport(id, report);
    return NextResponse.json({ card: getCard(id) });
  } catch (err) {
    return errorResponse(err);
  }
}
