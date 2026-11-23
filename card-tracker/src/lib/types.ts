// Shared types used by both the server and the browser.

export interface CardDetails {
  player: string;
  year: string | null;
  brand: string | null; // manufacturer, e.g. "Topps", "Panini"
  set_name: string | null; // e.g. "Chrome", "Prizm", "Update Series"
  subset: string | null; // insert / subset name, e.g. "Rookie Debut"
  card_number: string | null;
  parallel: string | null; // e.g. "Silver Prizm", "Refractor", "Gold /50"
  team: string | null;
  sport: string | null;
  rookie: boolean;
  autograph: boolean;
  memorabilia: boolean;
  serial_number: string | null; // e.g. "23/99"
  is_graded: boolean;
  grader: string | null; // PSA, BGS, SGC, CGC...
  grade: string | null; // "10", "9.5"...
  cert_number: string | null;
}

export interface Identification extends CardDetails {
  confidence: "high" | "medium" | "low";
  notes: string;
  search_query: string;
}

export interface PriceStats {
  median: number;
  low: number; // 25th percentile
  high: number; // 75th percentile
  count: number;
}

export interface ListingSample {
  title: string;
  price: number;
  currency: string;
  url: string;
  image: string | null;
}

export interface PriceBucket {
  label: string; // "Raw" or e.g. "PSA 10"
  stats: PriceStats;
  listings: ListingSample[];
}

export interface PriceReport {
  source: "ebay_active_listings";
  query: string;
  fetched_at: string;
  currency: string;
  raw: PriceBucket | null;
  graded: PriceBucket[]; // sorted: grader, then grade high to low
  total_listings_seen: number;
  sold_search_url: string; // eBay sold-listings search, for checking real sales
}

export interface Card extends CardDetails {
  id: number;
  created_at: string;
  updated_at: string;
  quantity: number;
  purchase_price: number | null;
  manual_value: number | null;
  notes: string | null;
  search_query: string;
  has_image: boolean;
  latest_price: PriceReport | null;
}

export interface CardWithValue extends Card {
  estimated_value: number | null;
  value_basis: string | null;
}
