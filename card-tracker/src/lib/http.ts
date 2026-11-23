import { NextResponse } from "next/server";
import { EbayNotConfiguredError } from "./ebay";
import { IdentificationError, type CardImage } from "./identify";

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof IdentificationError || err instanceof EbayNotConfiguredError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  console.error(err);
  const message = err instanceof Error ? err.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status: 500 });
}

const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/;

/** Parses a browser data: URL into the base64 payload Claude expects. */
export function parseDataUrl(value: unknown): CardImage | null {
  if (typeof value !== "string") return null;
  const m = value.match(DATA_URL_RE);
  if (!m) return null;
  return { media_type: m[1] as CardImage["media_type"], data: m[2] };
}

export function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}
