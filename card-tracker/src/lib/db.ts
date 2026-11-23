// SQLite storage for the collection and price history.

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { estimateValue } from "./pricing";
import type { Card, CardDetails, CardWithValue, PriceReport } from "./types";

export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
export const IMAGE_DIR = path.join(DATA_DIR, "images");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
  db = new Database(path.join(DATA_DIR, "cards.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      player TEXT NOT NULL,
      year TEXT, brand TEXT, set_name TEXT, subset TEXT, card_number TEXT,
      parallel TEXT, team TEXT, sport TEXT,
      rookie INTEGER NOT NULL DEFAULT 0,
      autograph INTEGER NOT NULL DEFAULT 0,
      memorabilia INTEGER NOT NULL DEFAULT 0,
      serial_number TEXT,
      is_graded INTEGER NOT NULL DEFAULT 0,
      grader TEXT, grade TEXT, cert_number TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      purchase_price REAL,
      manual_value REAL,
      notes TEXT,
      search_query TEXT NOT NULL DEFAULT '',
      image_file TEXT,
      identification_json TEXT
    );
    CREATE TABLE IF NOT EXISTS price_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      fetched_at TEXT NOT NULL,
      report_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS price_reports_card ON price_reports(card_id, fetched_at);
  `);
  return db;
}

const BOOL_FIELDS = ["rookie", "autograph", "memorabilia", "is_graded"] as const;
const TEXT_FIELDS = [
  "player", "year", "brand", "set_name", "subset", "card_number", "parallel", "team",
  "sport", "serial_number", "grader", "grade", "cert_number", "notes", "search_query",
] as const;
const NUMBER_FIELDS = ["quantity", "purchase_price", "manual_value"] as const;

export type CardInput = Partial<CardDetails> & {
  quantity?: number;
  purchase_price?: number | null;
  manual_value?: number | null;
  notes?: string | null;
  search_query?: string;
};

type Row = Record<string, unknown>;

function rowToCard(row: Row, report: PriceReport | null): CardWithValue {
  const card = {
    ...row,
    rookie: !!row.rookie,
    autograph: !!row.autograph,
    memorabilia: !!row.memorabilia,
    is_graded: !!row.is_graded,
    has_image: !!row.image_file,
    latest_price: report,
  } as unknown as Card;
  delete (card as unknown as Row).image_file;
  delete (card as unknown as Row).identification_json;
  const { value, basis } = estimateValue(card);
  return { ...card, estimated_value: value, value_basis: basis };
}

function latestReport(cardId: number): PriceReport | null {
  const r = getDb()
    .prepare("SELECT report_json FROM price_reports WHERE card_id = ? ORDER BY fetched_at DESC, id DESC LIMIT 1")
    .get(cardId) as { report_json: string } | undefined;
  return r ? (JSON.parse(r.report_json) as PriceReport) : null;
}

export function listCards(): CardWithValue[] {
  const rows = getDb()
    .prepare(`
      SELECT c.*, (
        SELECT report_json FROM price_reports p
        WHERE p.card_id = c.id ORDER BY fetched_at DESC, p.id DESC LIMIT 1
      ) AS latest_report
      FROM cards c ORDER BY c.created_at DESC, c.id DESC
    `)
    .all() as Row[];
  return rows.map(({ latest_report, ...row }) =>
    rowToCard(row, latest_report ? (JSON.parse(latest_report as string) as PriceReport) : null),
  );
}

export function getCard(id: number): CardWithValue | null {
  const row = getDb().prepare("SELECT * FROM cards WHERE id = ?").get(id) as Row | undefined;
  return row ? rowToCard(row, latestReport(id)) : null;
}

export function getImageFile(id: number): string | null {
  const row = getDb().prepare("SELECT image_file FROM cards WHERE id = ?").get(id) as
    | { image_file: string | null }
    | undefined;
  return row?.image_file ? path.join(IMAGE_DIR, row.image_file) : null;
}

/** Converts user/JSON input into column values, ignoring unknown keys. */
function toColumns(input: CardInput): Record<string, string | number | null> {
  const cols: Record<string, string | number | null> = {};
  const src = input as Record<string, unknown>;
  for (const f of BOOL_FIELDS) if (f in src) cols[f] = src[f] ? 1 : 0;
  for (const f of TEXT_FIELDS) {
    if (!(f in src)) continue;
    const v = src[f];
    cols[f] = v == null || String(v).trim() === "" ? null : String(v).trim();
  }
  for (const f of NUMBER_FIELDS) {
    if (!(f in src)) continue;
    const v = src[f];
    const n = v == null || v === "" ? null : Number(v);
    cols[f] = n == null || Number.isNaN(n) ? null : n;
  }
  if ("search_query" in cols && cols.search_query == null) cols.search_query = "";
  if ("quantity" in cols && (cols.quantity == null || (cols.quantity as number) < 1)) cols.quantity = 1;
  return cols;
}

export function createCard(
  input: CardInput,
  extras: { imageJpeg?: Buffer; identification?: unknown; priceReport?: PriceReport } = {},
): CardWithValue {
  const cols = toColumns(input);
  if (!cols.player) throw new Error("Player name is required.");
  const d = getDb();
  const names = Object.keys(cols);
  const info = d
    .prepare(`INSERT INTO cards (${names.join(", ")}, identification_json) VALUES (${names.map((n) => "@" + n).join(", ")}, @identification_json)`)
    .run({ ...cols, identification_json: extras.identification ? JSON.stringify(extras.identification) : null });
  const id = Number(info.lastInsertRowid);

  if (extras.imageJpeg) {
    const file = `${id}.jpg`;
    fs.writeFileSync(path.join(IMAGE_DIR, file), extras.imageJpeg);
    d.prepare("UPDATE cards SET image_file = ? WHERE id = ?").run(file, id);
  }
  if (extras.priceReport) savePriceReport(id, extras.priceReport);
  return getCard(id)!;
}

export function updateCard(id: number, input: CardInput): CardWithValue | null {
  const cols = toColumns(input);
  if ("player" in cols && !cols.player) throw new Error("Player name is required.");
  const names = Object.keys(cols);
  if (names.length > 0) {
    getDb()
      .prepare(`UPDATE cards SET ${names.map((n) => `${n} = @${n}`).join(", ")}, updated_at = datetime('now') WHERE id = @id`)
      .run({ ...cols, id });
  }
  return getCard(id);
}

export function deleteCard(id: number): boolean {
  const file = getImageFile(id);
  const info = getDb().prepare("DELETE FROM cards WHERE id = ?").run(id);
  if (file) fs.rmSync(file, { force: true });
  return info.changes > 0;
}

export function savePriceReport(cardId: number, report: PriceReport): void {
  getDb()
    .prepare("INSERT INTO price_reports (card_id, fetched_at, report_json) VALUES (?, ?, ?)")
    .run(cardId, report.fetched_at, JSON.stringify(report));
}

export function priceHistory(cardId: number): { fetched_at: string; raw: number | null; value: number | null }[] {
  const card = getCard(cardId);
  if (!card) return [];
  const rows = getDb()
    .prepare("SELECT report_json FROM price_reports WHERE card_id = ? ORDER BY fetched_at ASC")
    .all(cardId) as { report_json: string }[];
  return rows.map(({ report_json }) => {
    const report = JSON.parse(report_json) as PriceReport;
    const { value } = estimateValue({ ...card, manual_value: null, latest_price: report });
    return { fetched_at: report.fetched_at, raw: report.raw?.stats.median ?? null, value };
  });
}
