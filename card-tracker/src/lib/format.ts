import type { CardDetails } from "./types";

export function money(n: number | null | undefined, currency = "USD"): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

/** "2018 Topps Update #US250 Shohei Ohtani" */
export function cardTitle(c: Partial<CardDetails>): string {
  return [c.year, c.brand, c.set_name !== c.brand ? c.set_name : null, c.card_number ? `#${c.card_number}` : null, c.player]
    .filter(Boolean)
    .join(" ");
}

export function cardTags(c: Partial<CardDetails>): string[] {
  const tags: string[] = [];
  if (c.is_graded && c.grader) tags.push(`${c.grader} ${c.grade ?? ""}`.trim());
  if (c.rookie) tags.push("RC");
  if (c.autograph) tags.push("Auto");
  if (c.memorabilia) tags.push("Relic");
  if (c.parallel) tags.push(c.parallel);
  if (c.serial_number) tags.push(c.serial_number);
  if (c.subset) tags.push(c.subset);
  return tags;
}
