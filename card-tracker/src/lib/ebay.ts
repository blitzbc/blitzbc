// eBay Browse API client: searches active "Buy It Now" listings in the
// Sports Trading Card Singles category and turns them into a price report.
//
// Note: these are asking prices on current listings, not completed sales.
// eBay's sold-price API (Marketplace Insights) is restricted to approved
// partners, so the report also includes a link to eBay's sold-listings search.

import { bucketListings, buildSearchQuery, soldSearchUrl, type RawListing } from "./pricing";
import type { CardDetails, PriceReport } from "./types";

// Override with https://api.sandbox.ebay.com to use sandbox keys.
const API_BASE = process.env.EBAY_API_BASE || "https://api.ebay.com";
const SPORTS_CARD_SINGLES = "261328";

export class EbayNotConfiguredError extends Error {
  constructor() {
    super("eBay API keys are not set. Add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET to .env.local.");
  }
}

export function ebayConfigured(): boolean {
  return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAppToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) throw new EbayNotConfiguredError();

  const res = await fetch(`${API_BASE}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  });
  if (!res.ok) {
    throw new Error(`eBay authentication failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

interface ItemSummary {
  itemId: string;
  title: string;
  price?: { value: string; currency: string };
  itemWebUrl: string;
  image?: { imageUrl: string };
  thumbnailImages?: { imageUrl: string }[];
}

async function search(q: string, limit = 200): Promise<RawListing[]> {
  const token = await getAppToken();
  const params = new URLSearchParams({
    q,
    category_ids: SPORTS_CARD_SINGLES,
    filter: "buyingOptions:{FIXED_PRICE}",
    limit: String(limit),
  });
  const res = await fetch(`${API_BASE}/buy/browse/v1/item_summary/search?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": process.env.EBAY_MARKETPLACE_ID || "EBAY_US",
    },
  });
  if (!res.ok) {
    throw new Error(`eBay search failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { itemSummaries?: ItemSummary[] };
  return (json.itemSummaries ?? [])
    .filter((i) => i.price)
    .map((i) => ({
      id: i.itemId,
      title: i.title,
      price: parseFloat(i.price!.value),
      currency: i.price!.currency,
      url: i.itemWebUrl,
      image: i.thumbnailImages?.[0]?.imageUrl ?? i.image?.imageUrl ?? null,
    }));
}

/**
 * Looks up raw and graded prices for a card. Runs two searches: the plain
 * query (mostly raw copies) and one biased toward slabs, so graded buckets
 * have enough listings to be useful.
 */
export async function lookupPrices(
  card: Partial<CardDetails>,
  queryOverride?: string,
): Promise<PriceReport> {
  const query = (queryOverride || buildSearchQuery(card)).trim();
  if (!query) throw new Error("Not enough card details to search for prices.");

  const [plain, graded] = await Promise.all([
    search(query),
    search(`${query} (PSA, BGS, SGC, CGC)`),
  ]);
  const all = [...plain, ...graded];
  const { raw, graded: gradedBuckets } = bucketListings(all, card);

  return {
    source: "ebay_active_listings",
    query,
    fetched_at: new Date().toISOString(),
    currency: all[0]?.currency ?? "USD",
    raw,
    graded: gradedBuckets,
    total_listings_seen: new Set(all.map((l) => l.id)).size,
    sold_search_url: soldSearchUrl(query),
  };
}
