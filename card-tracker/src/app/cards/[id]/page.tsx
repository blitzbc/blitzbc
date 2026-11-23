"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CardForm, type FormState } from "@/components/CardForm";
import { PriceReportView } from "@/components/PriceReportView";
import { api } from "@/lib/api";
import { cardTags, cardTitle, money } from "@/lib/format";
import type { CardWithValue } from "@/lib/types";

type History = { fetched_at: string; raw: number | null; value: number | null }[];

export default function CardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [card, setCard] = useState<CardWithValue | null>(null);
  const [history, setHistory] = useState<History>([]);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [busy, setBusy] = useState<null | "prices" | "save" | "delete">(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api<{ card: CardWithValue; history: History }>(`/api/cards/${id}`)
      .then((d) => {
        setCard(d.card);
        setHistory(d.history);
      })
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function run(kind: "prices" | "save" | "delete", fn: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const refresh = () =>
    run("prices", async () => {
      await api(`/api/cards/${id}/prices`, { method: "POST" });
      await load();
    });

  const save = () =>
    run("save", async () => {
      const d = await api<{ card: CardWithValue }>(`/api/cards/${id}`, { method: "PATCH", json: editing });
      setCard(d.card);
      setEditing(null);
      await load();
    });

  const remove = () => {
    if (!confirm("Remove this card from your collection?")) return;
    run("delete", async () => {
      await api(`/api/cards/${id}`, { method: "DELETE" });
      router.push("/");
    });
  };

  if (!card) return <p className="text-muted">{error ?? "Loading…"}</p>;

  const yourLabel = card.is_graded ? `${card.grader ?? ""} ${card.grade ?? ""}`.trim() : "Raw";
  const gain = card.estimated_value != null && card.purchase_price != null ? card.estimated_value - card.purchase_price : null;

  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm text-accent">‹ Collection</Link>

      <div className="flex gap-4">
        {card.has_image && (
          <a href={`/api/cards/${card.id}/image`} target="_blank" rel="noreferrer" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/cards/${card.id}/image`} alt={card.player} className="h-44 w-32 rounded-lg object-cover" />
          </a>
        )}
        <div className="min-w-0 space-y-2">
          <h1 className="text-xl font-bold leading-tight">{card.player}</h1>
          <p className="text-sm text-muted">{cardTitle({ ...card, player: "" })}</p>
          <div className="flex flex-wrap gap-1">
            {cardTags(card).map((t) => (
              <span key={t} className="rounded bg-surface-2 px-1.5 py-0.5 text-xs font-medium">{t}</span>
            ))}
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{money(card.estimated_value)}</p>
            <p className="text-xs text-muted">
              {card.value_basis ?? "Not priced yet"}
              {card.quantity > 1 && ` · ×${card.quantity} = ${money((card.estimated_value ?? 0) * card.quantity)}`}
            </p>
            {gain != null && (
              <p className={`text-xs ${gain >= 0 ? "text-good" : "text-danger"}`}>
                {gain >= 0 ? "+" : ""}{money(gain)} vs. {money(card.purchase_price)} paid
              </p>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Raw &amp; graded prices</h2>
          <button className="btn-secondary py-1.5" onClick={refresh} disabled={busy !== null}>
            {busy === "prices" ? "Checking…" : "Refresh prices"}
          </button>
        </div>
        {card.latest_price ? (
          <PriceReportView report={card.latest_price} yourLabel={yourLabel} />
        ) : (
          <p className="panel p-4 text-sm text-muted">No prices yet. Tap “Refresh prices”.</p>
        )}
      </section>

      {history.length > 1 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Price history</h2>
          <div className="panel overflow-hidden text-sm">
            <table className="w-full">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Checked</th>
                  <th className="px-4 py-2 text-right font-medium">Raw</th>
                  {card.is_graded && <th className="px-4 py-2 text-right font-medium">{yourLabel}</th>}
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((h) => (
                  <tr key={h.fetched_at} className="border-t border-border">
                    <td className="px-4 py-2">{new Date(h.fetched_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(h.raw)}</td>
                    {card.is_graded && <td className="px-4 py-2 text-right tabular-nums">{money(h.value)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-3">
        {editing ? (
          <>
            <h2 className="font-semibold">Edit card</h2>
            <CardForm value={editing} onChange={setEditing} />
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={save} disabled={busy !== null}>
                {busy === "save" ? "Saving…" : "Save changes"}
              </button>
              <button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            {card.notes && <p className="panel p-4 text-sm whitespace-pre-wrap">{card.notes}</p>}
            {card.cert_number && <p className="text-sm text-muted">Cert #{card.cert_number}</p>}
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setEditing({ ...card })}>Edit details</button>
              <button className="btn-secondary text-danger" onClick={remove} disabled={busy !== null}>Delete</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
