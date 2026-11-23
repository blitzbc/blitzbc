import { NextResponse } from "next/server";
import { identifyCard } from "@/lib/identify";
import { errorResponse, parseDataUrl } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { front?: string; back?: string };
    const front = parseDataUrl(body.front);
    if (!front) {
      return NextResponse.json({ error: "A photo of the card front is required." }, { status: 400 });
    }
    const back = parseDataUrl(body.back) ?? undefined;
    const identification = await identifyCard(front, back);
    return NextResponse.json({ identification });
  } catch (err) {
    return errorResponse(err);
  }
}
