"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusBanner } from "@/components/StatusBanner";
import { api } from "@/lib/api";
import { cardTags, cardTitle, money } from "@/lib/format";
import type { CardWithValue } from "@/lib/types";

type Sort = "newest" | "value" | "player";

export default function CollectionPage() {
  const [cards, setCards] = useState<CardWithValue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<Sort>("newest");

  useEffect(() => {
    api<{ cards: CardWithValue[] }>("/api/cards")
      .then((d) => setCards(d.cards))
      .catch((e: Error) => setError(e.message));
  }, []);

  const shown = useMemo(() => {
    if (!cards) return [];
    const q = filter.trim().toLowerCase();
    const list = q ? cards.filter((c) => `${cardTitle(c)} ${c.team ?? ""} ${cardTags(c).join(" ")}`.toLowerCase().includes(q)) : [...cards];
    if (sort === "value") list.sort((a, b) => (b.estimated_value ?? -1) * b.quantity - (a.estimated_value ?? -1) * a.quantity);
    if (sort === "player") list.sort((a, b) => a.player.localeCompare(b.player));
    return list;
  }, [cards, filter, sort]);

  const totals = useMemo(() => {
    let value = 0, paid = 0, count = 0, unpriced = 0;
    for (const c of cards ?? []) {
      count += c.quantity;
      if (c.estimated_value != null) value += c.estimated_value * c.quantity;
      else unpriced += c.quantity;
      if (c.purchase_price != null) paid += c.purchase_price * c.quantity;
    }
    return { value, paid, count, unpriced };
  }, [cards]);

  return (
    <div>
      <StatusBanner />

      <section className="panel mb-5 grid grid-cols-3 divide-x divide-border">
        <div className="p-4">
          <p className="label">Est. value</p>
          <p className="text-xl font-bold tabular-nums">{money(totals.value)}</p>
        </div>
        <div className="p-4">
          <p className="label">Cards</p>
          <p className="text-xl font-bold tabular-nums">{totals.count}</p>
          {totals.unpriced > 0 && <p className="text-xs text-muted">{totals.unpriced} unpriced</p>}
        </div>
        <div className="p-4">
          <p className="label">Paid</p>
          <p className="text-xl font-bold tabular-nums">{money(totals.paid)}</p>
        </div>
      </section>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {cards && cards.length > 0 && (
        <div className="mb-4 flex gap-2">
          <input className="input" placeholder="Search player, set, team…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
            <option value="newest">Newest</option>
            <option value="value">Value</option>
            <option value="player">Player</option>
          </select>
        </div>
      )}

      {cards === null && !error && <p className="text-muted">Loading…</p>}

      {cards?.length === 0 && (
        <div className="panel p-8 text-center">
          <p className="mb-1 text-lg font-semibold">No cards yet</p>
          <p className="mb-4 text-sm text-muted">Snap a photo of a card and it&apos;ll be identified and priced for you.</p>
          <Link href="/add" className="btn-primary">Add your first card</Link>
        </div>
      )}

      <ul className="space-y-2">
        {shown.map((c) => (
          <li key={c.id}>
            <Link href={`/cards/${c.id}`} className="panel flex items-center gap-3 p-2.5 hover:bg-surface-2">
              {c.has_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/cards/${c.id}/image`} alt="" className="h-20 w-14 shrink-0 rounded-md object-cover" loading="lazy" />
              ) : (
                <div className="h-20 w-14 shrink-0 rounded-md bg-surface-2" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.player}</p>
                <p className="truncate text-sm text-muted">{cardTitle({ ...c, player: "" })}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {cardTags(c).map((t) => (
                    <span key={t} className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium">{t}</span>
                  ))}
                  {c.quantity > 1 && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium">×{c.quantity}</span>}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold tabular-nums">{money(c.estimated_value)}</p>
                <p className="text-[11px] text-muted">{c.value_basis ?? "Not priced"}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
