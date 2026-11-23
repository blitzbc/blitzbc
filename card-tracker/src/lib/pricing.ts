// Pure pricing logic: sorting eBay listings into raw vs. graded buckets and
// summarizing them. No network access here, so it is easy to test.

import type { CardDetails, ListingSample, PriceBucket, PriceStats } from "./types";

export interface RawListing extends ListingSample {
  id: string;
}

const GRADER_ALIASES: Record<string, string> = {
  PSA: "PSA",
  BGS: "BGS",
  BECKETT: "BGS",
  SGC: "SGC",
  CGC: "CGC",
  CSG: "CGC", // CSG is CGC's former sports-card brand
  HGA: "HGA",
  TAG: "TAG",
};

const GRADER_ORDER = ["PSA", "BGS", "SGC", "CGC", "TAG", "HGA"];

const GRADER_RE = /\b(PSA|BGS|BECKETT|SGC|CGC|CSG|HGA|TAG)\b/i;
// Grader, optional qualifier words, then the numeric grade.
const GRADE_RE =
  /\b(PSA|BGS|BECKETT|SGC|CGC|CSG|HGA|TAG)\b[\s\-:#]*(?:(?:GEM\s*(?:MINT|MT)|MINT|MT|NM-MT|NM|PRISTINE|BLACK\s*LABEL)\s*)?(10|[1-9](?:\.5)?)(?![\d.\/])/i;
// Titles that mention a grader but are describing a raw card.
const RAW_HINT_RE =
  /\b(candidate|ready|worthy|potential|possible|ungraded|raw|could\s+grade|gradeable)\b/i;
// Listings that never make sense as a price comp.
const JUNK_RE =
  /\b(lot|lots|reprint|custom|you\s+pick|pick\s+your|choose|complete\s+set|team\s+set|digital|proxy|facsimile|break|rp)\b/i;
const AUTO_RE = /\b(auto|autograph|autographed|signed|signature)\b/i;
const SERIAL_RE = /(?:#\s?\/|\/)\s?\d{1,4}\b|\b\d{1,3}\s?\/\s?\d{1,4}\b|\b1\s?of\s?1\b/i;
const MEMORABILIA_RE = /\b(patch|jersey|relic|memorabilia|bat\s+knob|game[-\s]used|swatch)\b/i;

export type GradeInfo =
  | { kind: "raw" }
  | { kind: "graded"; grader: string; grade: string }
  | { kind: "unknown" }; // graded but we couldn't read the grade

export function classifyTitle(title: string): GradeInfo {
  const m = title.match(GRADE_RE);
  if (m && !RAW_HINT_RE.test(title)) {
    return {
      kind: "graded",
      grader: GRADER_ALIASES[m[1].toUpperCase()],
      grade: m[2],
    };
  }
  if (GRADER_RE.test(title) && !RAW_HINT_RE.test(title)) {
    return { kind: "unknown" };
  }
  return { kind: "raw" };
}

/**
 * Drops listings that are obviously a different card than the one we own:
 * lots, reprints, and autographed / numbered / memorabilia versions when our
 * card isn't one of those (they sell for much more and would skew the median).
 */
export function isRelevant(title: string, card: Partial<CardDetails>): boolean {
  if (JUNK_RE.test(title)) return false;
  if (!card.autograph && AUTO_RE.test(title)) return false;
  if (!card.serial_number && !card.parallel && SERIAL_RE.test(title)) return false;
  if (!card.memorabilia && MEMORABILIA_RE.test(title)) return false;
  return true;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Median and interquartile range, after dropping extreme outliers. */
export function summarize(prices: number[]): PriceStats | null {
  let sorted = prices.filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  if (sorted.length >= 5) {
    const q1 = percentile(sorted, 0.25);
    const q3 = percentile(sorted, 0.75);
    const iqr = q3 - q1;
    const kept = sorted.filter((p) => p >= q1 - 1.5 * iqr && p <= q3 + 1.5 * iqr);
    if (kept.length > 0) sorted = kept;
  }
  return {
    median: round2(percentile(sorted, 0.5)),
    low: round2(percentile(sorted, 0.25)),
    high: round2(percentile(sorted, 0.75)),
    count: sorted.length,
  };
}

function toBucket(label: string, listings: RawListing[]): PriceBucket | null {
  const stats = summarize(listings.map((l) => l.price));
  if (!stats) return null;
  // Show the listings closest to the median first.
  const samples = [...listings]
    .sort((a, b) => Math.abs(a.price - stats.median) - Math.abs(b.price - stats.median))
    .slice(0, 6)
    .map(({ title, price, currency, url, image }) => ({ title, price, currency, url, image }));
  return { label, stats, listings: samples };
}

export function bucketListings(
  listings: RawListing[],
  card: Partial<CardDetails>,
): { raw: PriceBucket | null; graded: PriceBucket[] } {
  const seen = new Set<string>();
  const raw: RawListing[] = [];
  const graded = new Map<string, RawListing[]>();

  for (const l of listings) {
    if (seen.has(l.id)) continue;
    seen.add(l.id);
    if (!isRelevant(l.title, card)) continue;
    const info = classifyTitle(l.title);
    if (info.kind === "raw") raw.push(l);
    else if (info.kind === "graded") {
      const key = `${info.grader} ${info.grade}`;
      if (!graded.has(key)) graded.set(key, []);
      graded.get(key)!.push(l);
    }
  }

  const gradedBuckets = [...graded.entries()]
    .map(([label, ls]) => toBucket(label, ls))
    .filter((b): b is PriceBucket => b !== null)
    .sort((a, b) => {
      const [ga, na] = a.label.split(" ");
      const [gb, nb] = b.label.split(" ");
      const oa = GRADER_ORDER.indexOf(ga);
      const ob = GRADER_ORDER.indexOf(gb);
      if (oa !== ob) return oa - ob;
      return parseFloat(nb) - parseFloat(na);
    });

  return { raw: toBucket("Raw", raw), graded: gradedBuckets };
}

/** Normalizes a grader name the user or the model typed ("Beckett" -> "BGS"). */
export function normalizeGrader(grader: string | null | undefined): string | null {
  if (!grader) return null;
  return GRADER_ALIASES[grader.trim().toUpperCase()] ?? grader.trim().toUpperCase();
}

/** Builds an eBay keyword query from card details. */
export function buildSearchQuery(card: Partial<CardDetails>): string {
  const parts = [
    card.year,
    card.brand,
    card.set_name && card.set_name !== card.brand ? card.set_name : null,
    card.player,
    card.subset,
    card.parallel,
    card.card_number ? `#${card.card_number.replace(/^#/, "")}` : null,
    card.autograph ? "auto" : null,
  ];
  // Drop duplicated words (e.g. brand repeated in set name).
  const words: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    for (const w of String(part).split(/\s+/)) {
      if (w && !words.some((x) => x.toLowerCase() === w.toLowerCase())) words.push(w);
    }
  }
  return words.join(" ");
}

export function soldSearchUrl(query: string): string {
  const params = new URLSearchParams({
    _nkw: query,
    LH_Sold: "1",
    LH_Complete: "1",
    _sacat: "261328",
  });
  return `https://www.ebay.com/sch/i.html?${params}`;
}

/**
 * The value to count toward the collection total: the manual value if set,
 * otherwise the bucket matching the card's own grade, otherwise raw.
 */
export function estimateValue(card: {
  is_graded: boolean;
  grader: string | null;
  grade: string | null;
  manual_value: number | null;
  latest_price: { raw: PriceBucket | null; graded: PriceBucket[] } | null;
}): { value: number | null; basis: string | null } {
  if (card.manual_value != null) return { value: card.manual_value, basis: "Manual" };
  const report = card.latest_price;
  if (!report) return { value: null, basis: null };
  if (card.is_graded) {
    const label = `${normalizeGrader(card.grader)} ${card.grade}`;
    const bucket = report.graded.find((b) => b.label === label);
    return bucket
      ? { value: bucket.stats.median, basis: label }
      : { value: null, basis: `No ${label} listings` };
  }
  return report.raw
    ? { value: report.raw.stats.median, basis: "Raw" }
    : { value: null, basis: "No raw listings" };
}
