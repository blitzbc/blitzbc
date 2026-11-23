import { NextResponse } from "next/server";
import { createCard, listCards, type CardInput } from "@/lib/db";
import { errorResponse, parseDataUrl } from "@/lib/http";
import type { PriceReport } from "@/lib/types";

export const runtime = "nodejs";

export function GET() {
  try {
    return NextResponse.json({ cards: listCards() });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      card: CardInput;
      image?: string;
      identification?: unknown;
      priceReport?: PriceReport;
    };
    if (!body.card?.player?.trim()) {
      return NextResponse.json({ error: "Player name is required." }, { status: 400 });
    }
    const image = parseDataUrl(body.image);
    const card = createCard(body.card, {
      imageJpeg: image ? Buffer.from(image.data, "base64") : undefined,
      identification: body.identification,
      priceReport: body.priceReport,
    });
    return NextResponse.json({ card }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
