// Browser-side helper: shrinks a phone photo before upload. Phone photos are
// often 4-12 MB; 1600px on the long edge is plenty to read a card.

export async function fileToResizedDataUrl(file: File, maxEdge = 1600, quality = 0.88): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}
