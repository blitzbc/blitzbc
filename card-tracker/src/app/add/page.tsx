"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CardForm, type FormState } from "@/components/CardForm";
import { PriceReportView } from "@/components/PriceReportView";
import { StatusBanner } from "@/components/StatusBanner";
import { api } from "@/lib/api";
import { fileToResizedDataUrl } from "@/lib/image";
import type { Identification, PriceReport } from "@/lib/types";

function PhotoSlot({ label, value, onPick }: { label: string; value: string | null; onPick: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      className="panel flex aspect-[5/7] w-full flex-col items-center justify-center overflow-hidden border-dashed text-sm text-muted hover:bg-surface-2"
    >
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt={label} className="h-full w-full object-cover" />
      ) : (
        <>
          <span className="mb-1 text-3xl">📷</span>
          {label}
        </>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </button>
  );
}

const CONFIDENCE_STYLE = {
  high: "text-good",
  medium: "text-warn-text",
  low: "text-danger",
} as const;

export default function AddCardPage() {
  const router = useRouter();
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [identification, setIdentification] = useState<Identification | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [report, setReport] = useState<PriceReport | null>(null);
  const [busy, setBusy] = useState<null | "identify" | "prices" | "save">(null);
  const [error, setError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);

  const pick = (setter: (v: string) => void) => async (file: File) => {
    setError(null);
    try {
      setter(await fileToResizedDataUrl(file));
    } catch {
      setError("Couldn't read that photo. Try a JPEG or PNG.");
    }
  };

  async function fetchPrices(card: FormState) {
    setBusy("prices");
    setPriceError(null);
    try {
      const { report } = await api<{ report: PriceReport }>("/api/prices", {
        method: "POST",
        json: { card, query: card.search_query },
      });
      setReport(report);
    } catch (e) {
      setReport(null);
      setPriceError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function identify() {
    if (!front) return;
    setBusy("identify");
    setError(null);
    try {
      const { identification } = await api<{ identification: Identification }>("/api/identify", {
        method: "POST",
        json: { front, back },
      });
      setIdentification(identification);
      const next: FormState = { ...identification, quantity: 1, notes: "" };
      setForm(next);
      await fetchPrices(next);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  async function save() {
    if (!form) return;
    setBusy("save");
    setError(null);
    try {
      const { card } = await api<{ card: { id: number } }>("/api/cards", {
        method: "POST",
        json: { card: form, image: front, identification, priceReport: report ?? undefined },
      });
      router.push(`/cards/${card.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  const yourLabel = form?.is_graded ? `${form.grader ?? ""} ${form.grade ?? ""}`.trim() : "Raw";

  return (
    <div className="space-y-5">
      <StatusBanner />
      <div>
        <h1 className="text-xl font-bold">Add a card</h1>
        <p className="text-sm text-muted">Photograph the front (and the back, for a more exact match). Fill the frame, avoid glare.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <PhotoSlot label="Front" value={front} onPick={pick(setFront)} />
        <PhotoSlot label="Back (optional)" value={back} onPick={pick(setBack)} />
      </div>

      {!form && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="btn-primary flex-1" disabled={!front || busy !== null} onClick={identify}>
            {busy === "identify" ? "Identifying…" : "Identify card"}
          </button>
          <button
            className="btn-secondary"
            disabled={busy !== null}
            onClick={() => setForm({ player: "", quantity: 1, rookie: false, autograph: false, memorabilia: false, is_graded: false })}
          >
            Enter details manually
          </button>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {form && (
        <>
          {identification && (
            <div className="panel p-4 text-sm">
              <p>
                Identified with{" "}
                <b className={CONFIDENCE_STYLE[identification.confidence]}>{identification.confidence} confidence</b>. Check the
                details below and correct anything that&apos;s off.
              </p>
              {identification.notes && <p className="mt-1 text-muted">{identification.notes}</p>}
            </div>
          )}

          <CardForm value={form} onChange={setForm} />

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Market prices</h2>
              <button className="btn-secondary py-1.5" disabled={busy !== null || !form.player} onClick={() => fetchPrices(form)}>
                {busy === "prices" ? "Checking…" : report ? "Re-check" : "Check prices"}
              </button>
            </div>
            {priceError && <p className="text-sm text-danger">{priceError}</p>}
            {busy === "prices" && !report && <p className="text-sm text-muted">Searching eBay…</p>}
            {report && <PriceReportView report={report} yourLabel={yourLabel} />}
          </section>

          <button className="btn-primary w-full py-3" disabled={busy !== null || !form.player?.trim()} onClick={save}>
            {busy === "save" ? "Saving…" : "Save to collection"}
          </button>
        </>
      )}
    </div>
  );
}
