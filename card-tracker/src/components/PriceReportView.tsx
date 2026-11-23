import { money } from "@/lib/format";
import type { PriceBucket, PriceReport } from "@/lib/types";

function BucketRow({ bucket, currency, highlight }: { bucket: PriceBucket; currency: string; highlight: boolean }) {
  return (
    <details className={`group border-t border-border first:border-t-0 ${highlight ? "bg-surface-2" : ""}`}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
        <span className="w-20 shrink-0 font-semibold">
          {bucket.label}
          {highlight && <span className="ml-1 text-xs font-normal text-accent">• yours</span>}
        </span>
        <span className="flex-1 text-right text-lg font-bold tabular-nums">{money(bucket.stats.median, currency)}</span>
        <span className="w-32 shrink-0 text-right text-xs text-muted tabular-nums">
          {money(bucket.stats.low, currency)}–{money(bucket.stats.high, currency)}
          <br />
          {bucket.stats.count} listing{bucket.stats.count === 1 ? "" : "s"}
        </span>
        <span className="text-muted transition group-open:rotate-90">›</span>
      </summary>
      <ul className="space-y-2 px-4 pb-3">
        {bucket.listings.map((l) => (
          <li key={l.url}>
            <a href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg p-1 hover:bg-surface-2">
              {l.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.image} alt="" className="h-12 w-9 shrink-0 rounded object-cover" loading="lazy" />
              ) : (
                <span className="h-12 w-9 shrink-0 rounded bg-surface-2" />
              )}
              <span className="line-clamp-2 flex-1 text-xs">{l.title}</span>
              <span className="text-sm font-semibold tabular-nums">{money(l.price, l.currency)}</span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function PriceReportView({ report, yourLabel }: { report: PriceReport; yourLabel?: string | null }) {
  const nothing = !report.raw && report.graded.length === 0;
  return (
    <div className="space-y-2">
      <div className="panel overflow-hidden">
        {nothing ? (
          <p className="p-4 text-sm text-muted">
            No usable listings found for “{report.query}”. Try simplifying the search (e.g. drop the set or parallel).
          </p>
        ) : (
          <>
            {report.raw && <BucketRow bucket={report.raw} currency={report.currency} highlight={yourLabel === "Raw"} />}
            {report.graded.map((b) => (
              <BucketRow key={b.label} bucket={b} currency={report.currency} highlight={yourLabel === b.label} />
            ))}
          </>
        )}
      </div>
      <p className="text-xs text-muted">
        Median asking price of current eBay Buy It Now listings (range is middle 50%), from {report.total_listings_seen} listings
        for “{report.query}”, checked {new Date(report.fetched_at).toLocaleString()}. Asking prices usually run above what cards actually sell for.{" "}
        <a href={report.sold_search_url} target="_blank" rel="noreferrer" className="text-accent underline">
          See sold listings on eBay
        </a>
      </p>
    </div>
  );
}
