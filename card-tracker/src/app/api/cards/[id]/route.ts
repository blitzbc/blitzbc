import { NextResponse } from "next/server";
import { deleteCard, getCard, priceHistory, updateCard, type CardInput } from "@/lib/db";
import { errorResponse, parseId } from "@/lib/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };
const notFound = () => NextResponse.json({ error: "Card not found." }, { status: 404 });

export async function GET(_req: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  const card = id ? getCard(id) : null;
  if (!card || !id) return notFound();
  return NextResponse.json({ card, history: priceHistory(id) });
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const id = parseId((await params).id);
    if (!id) return notFound();
    const card = updateCard(id, (await req.json()) as CardInput);
    return card ? NextResponse.json({ card }) : notFound();
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (!id || !deleteCard(id)) return notFound();
  return NextResponse.json({ ok: true });
}
