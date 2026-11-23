import { describe, expect, it } from "vitest";
import { bucketListings, buildSearchQuery, classifyTitle, estimateValue, isRelevant, summarize, type RawListing } from "../pricing";

describe("classifyTitle", () => {
  it.each([
    ["2018 Topps Update Shohei Ohtani #US1 RC PSA 10 GEM MINT", "PSA", "10"],
    ["2020 Prizm Justin Herbert Silver BGS 9.5 Gem Mint", "BGS", "9.5"],
    ["Luka Doncic 2018 Prizm Beckett 9", "BGS", "9"],
    ["Mike Trout 2011 Update SGC 9.5 Mint+", "SGC", "9.5"],
    ["PSA GEM MT 10 2019 Bowman Chrome Wander Franco", "PSA", "10"],
    ["2023 Topps Chrome Elly De La Cruz CGC 9.5", "CGC", "9.5"],
  ])("reads the grade from %s", (title, grader, grade) => {
    expect(classifyTitle(title)).toEqual({ kind: "graded", grader, grade });
  });

  it("treats grading candidates as raw", () => {
    expect(classifyTitle("2018 Topps Update Ohtani RC PSA 10 Candidate!")).toEqual({ kind: "raw" });
    expect(classifyTitle("Ohtani RC sharp corners PSA ready")).toEqual({ kind: "raw" });
  });

  it("marks slabs without a readable grade as unknown", () => {
    expect(classifyTitle("Ohtani RC PSA Authentic")).toEqual({ kind: "unknown" });
  });

  it("returns raw when no grader is mentioned", () => {
    expect(classifyTitle("2018 Topps Update #US1 Shohei Ohtani RC")).toEqual({ kind: "raw" });
  });

  it("does not read a serial number as a grade", () => {
    expect(classifyTitle("Herbert Prizm Gold /10 PSA 9")).toEqual({ kind: "graded", grader: "PSA", grade: "9" });
    // Ambiguous (grade 10 or numbered /10?): left out of every bucket.
    expect(classifyTitle("Herbert Prizm Gold PSA 10/10").kind).toBe("unknown");
  });
});

describe("isRelevant", () => {
  const base = { autograph: false, memorabilia: false, serial_number: null, parallel: null };
  it("drops lots, reprints and higher-end versions of a base card", () => {
    expect(isRelevant("Ohtani RC lot of 5", base)).toBe(false);
    expect(isRelevant("Ohtani RC reprint", base)).toBe(false);
    expect(isRelevant("Ohtani RC Auto", base)).toBe(false);
    expect(isRelevant("Ohtani RC Gold /2018", base)).toBe(false);
    expect(isRelevant("Ohtani RC Jersey Patch", base)).toBe(false);
    expect(isRelevant("2018 Topps Update Ohtani RC #US1", base)).toBe(true);
  });
  it("keeps autographs when the card is an autograph", () => {
    expect(isRelevant("Ohtani RC Auto", { ...base, autograph: true })).toBe(true);
  });
});

describe("summarize", () => {
  it("returns null for no prices", () => {
    expect(summarize([])).toBeNull();
  });
  it("computes median and quartiles, dropping outliers", () => {
    const s = summarize([10, 11, 12, 13, 14, 500])!;
    expect(s.count).toBe(5);
    expect(s.median).toBe(12);
    expect(s.low).toBe(11);
    expect(s.high).toBe(13);
  });
});

describe("bucketListings", () => {
  const L = (id: string, title: string, price: number): RawListing => ({ id, title, price, currency: "USD", url: `https://ebay.com/${id}`, image: null });
  it("splits raw and graded and sorts graded buckets", () => {
    const { raw, graded } = bucketListings(
      [
        L("1", "Ohtani RC", 20),
        L("2", "Ohtani RC", 22),
        L("2", "Ohtani RC (duplicate)", 22),
        L("3", "Ohtani RC PSA 9", 60),
        L("4", "Ohtani RC PSA 10", 150),
        L("5", "Ohtani RC BGS 9.5", 120),
        L("6", "Ohtani RC lot", 5),
      ],
      {},
    );
    expect(raw?.stats).toMatchObject({ median: 21, count: 2 });
    expect(graded.map((b) => b.label)).toEqual(["PSA 10", "PSA 9", "BGS 9.5"]);
  });
});

describe("buildSearchQuery", () => {
  it("joins details and removes repeated words", () => {
    expect(
      buildSearchQuery({ year: "2018", brand: "Topps", set_name: "Topps Update", player: "Shohei Ohtani", card_number: "US1" }),
    ).toBe("2018 Topps Update Shohei Ohtani #US1");
  });
});

describe("estimateValue", () => {
  const report = {
    raw: { label: "Raw", stats: { median: 20, low: 18, high: 25, count: 10 }, listings: [] },
    graded: [{ label: "PSA 10", stats: { median: 150, low: 140, high: 170, count: 4 }, listings: [] }],
  };
  it("uses raw for raw cards", () => {
    expect(estimateValue({ is_graded: false, grader: null, grade: null, manual_value: null, latest_price: report })).toEqual({ value: 20, basis: "Raw" });
  });
  it("uses the matching grade for graded cards", () => {
    expect(estimateValue({ is_graded: true, grader: "psa", grade: "10", manual_value: null, latest_price: report })).toEqual({ value: 150, basis: "PSA 10" });
  });
  it("prefers a manual value", () => {
    expect(estimateValue({ is_graded: false, grader: null, grade: null, manual_value: 99, latest_price: report })).toEqual({ value: 99, basis: "Manual" });
  });
});
