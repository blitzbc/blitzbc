import fs from "node:fs";
import { getImageFile } from "@/lib/db";
import { parseId } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  const file = id ? getImageFile(id) : null;
  if (!file || !fs.existsSync(file)) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(file), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
  });
}
