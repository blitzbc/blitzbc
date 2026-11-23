"use client";

import type { CardInput } from "@/lib/db";

export type FormState = CardInput;

const TEXT: { key: keyof FormState; label: string; wide?: boolean }[] = [
  { key: "player", label: "Player", wide: true },
  { key: "year", label: "Year" },
  { key: "brand", label: "Brand" },
  { key: "set_name", label: "Set" },
  { key: "card_number", label: "Card #" },
  { key: "subset", label: "Insert / subset" },
  { key: "parallel", label: "Parallel" },
  { key: "serial_number", label: "Serial #" },
  { key: "team", label: "Team" },
  { key: "sport", label: "Sport" },
];

const FLAGS: { key: "rookie" | "autograph" | "memorabilia" | "is_graded"; label: string }[] = [
  { key: "rookie", label: "Rookie" },
  { key: "autograph", label: "Auto" },
  { key: "memorabilia", label: "Relic" },
  { key: "is_graded", label: "Graded" },
];

export function CardForm({
  value,
  onChange,
  showOwnership = true,
}: {
  value: FormState;
  onChange: (v: FormState) => void;
  showOwnership?: boolean;
}) {
  const set = (key: keyof FormState, v: unknown) => onChange({ ...value, [key]: v });
  const str = (k: keyof FormState) => (value[k] as string | number | null | undefined) ?? "";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {TEXT.map((f) => (
          <div key={f.key} className={f.wide ? "col-span-2" : undefined}>
            <label className="label" htmlFor={`f-${f.key}`}>{f.label}</label>
            <input id={`f-${f.key}`} className="input" value={str(f.key)} onChange={(e) => set(f.key, e.target.value)} />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {FLAGS.map((f) => (
          <label
            key={f.key}
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${
              value[f.key] ? "border-accent bg-accent text-accent-text" : "border-border bg-surface"
            }`}
          >
            <input type="checkbox" className="sr-only" checked={!!value[f.key]} onChange={(e) => set(f.key, e.target.checked)} />
            {f.label}
          </label>
        ))}
      </div>

      {value.is_graded && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label" htmlFor="f-grader">Grader</label>
            <select id="f-grader" className="input" value={str("grader")} onChange={(e) => set("grader", e.target.value)}>
              <option value="">—</option>
              {["PSA", "BGS", "SGC", "CGC", "TAG", "HGA"].map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="f-grade">Grade</label>
            <input id="f-grade" className="input" inputMode="decimal" value={str("grade")} onChange={(e) => set("grade", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="f-cert">Cert #</label>
            <input id="f-cert" className="input" value={str("cert_number")} onChange={(e) => set("cert_number", e.target.value)} />
          </div>
        </div>
      )}

      <div>
        <label className="label" htmlFor="f-query">eBay search used for prices</label>
        <input id="f-query" className="input" value={str("search_query")} onChange={(e) => set("search_query", e.target.value)} />
      </div>

      {showOwnership && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label" htmlFor="f-qty">Qty</label>
              <input id="f-qty" className="input" type="number" min={1} value={str("quantity") || 1} onChange={(e) => set("quantity", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="f-paid">Paid ($)</label>
              <input id="f-paid" className="input" inputMode="decimal" value={str("purchase_price")} onChange={(e) => set("purchase_price", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="f-manual">Own value ($)</label>
              <input id="f-manual" className="input" inputMode="decimal" placeholder="optional" value={str("manual_value")} onChange={(e) => set("manual_value", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="f-notes">Notes</label>
            <textarea id="f-notes" className="input" rows={2} value={str("notes")} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </>
      )}
    </div>
  );
}
