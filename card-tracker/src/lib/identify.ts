// Identifies a sports card from one or two photos using Claude's vision.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { buildSearchQuery, normalizeGrader } from "./pricing";
import type { Identification } from "./types";

const MODEL = "claude-opus-5-5";

const IdentificationSchema = z.object({
  player: z.string().describe("Player name as printed on the card. For multi-player cards, join names with ' / '."),
  year: z.string().nullable().describe("Release year or season of the product, e.g. '2018' or '2023-24'. Use the product year, not the copyright year if they differ."),
  brand: z.string().nullable().describe("Manufacturer, e.g. 'Topps', 'Panini', 'Upper Deck', 'Bowman', 'Fleer'."),
  set_name: z.string().nullable().describe("Product / set, e.g. 'Chrome', 'Prizm', 'Update Series', 'Select', 'Base'."),
  subset: z.string().nullable().describe("Insert or subset name if this is not a base card, e.g. 'Rookie Debut', 'Future Stars'."),
  card_number: z.string().nullable().describe("Card number as printed, without '#', e.g. '150', 'US250', 'BCP-1'."),
  parallel: z.string().nullable().describe("Parallel / variation if visibly identifiable (refractor finish, colored border, 'Silver Prizm', 'Gold /50'). Null for base."),
  team: z.string().nullable(),
  sport: z.string().nullable().describe("Baseball, Basketball, Football, Hockey, Soccer, etc."),
  rookie: z.boolean().describe("True if the card shows an RC logo or is otherwise a recognized rookie card."),
  autograph: z.boolean().describe("True if the card is signed (on-card or sticker auto)."),
  memorabilia: z.boolean().describe("True if the card contains a jersey/patch/bat relic."),
  serial_number: z.string().nullable().describe("Serial numbering stamped on the card, e.g. '23/99'. Null if not numbered."),
  is_graded: z.boolean().describe("True if the card is in a grading company slab."),
  grader: z.string().nullable().describe("Grading company from the slab label: PSA, BGS, SGC, CGC, TAG, HGA. Null if raw."),
  grade: z.string().nullable().describe("Numeric grade from the slab label, e.g. '10', '9.5'. Null if raw."),
  cert_number: z.string().nullable().describe("Certification number from the slab label. Null if raw or unreadable."),
  confidence: z.enum(["high", "medium", "low"]).describe("How sure you are of the exact card (year, set, number, parallel)."),
  notes: z.string().describe("One or two short sentences: anything uncertain, alternatives you considered, or what a back photo would confirm. Empty string if nothing to add."),
  search_query: z.string().describe("A concise eBay search query for this exact card: year, brand, set, player, parallel, card number. No grade terms."),
});

const SYSTEM_PROMPT = `You are an expert sports card identifier with deep knowledge of releases from Topps, Bowman, Panini, Upper Deck, Fleer, Donruss, Leaf and others across baseball, basketball, football, hockey and soccer.

You will receive a photo of the front of a card, and sometimes the back. Identify the exact card so it can be priced: player, year, manufacturer, set, insert/subset, card number, and parallel.

Guidance:
- Read printed text carefully (name, card number, copyright line, set logos). The back usually shows the card number and copyright year.
- Use design cues (borders, fonts, logos, foil patterns, refractor finishes) to pin down set and year when text is not visible.
- Only name a parallel when its visual signature is clear; otherwise leave it null and mention the possibility in notes.
- If the card is in a slab, read the grading company, grade, and cert number from the label.
- Use null for anything you cannot determine rather than guessing, and lower your confidence accordingly.`;

export class IdentificationError extends Error {}

export interface CardImage {
  data: string; // base64, no data: prefix
  media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export async function identifyCard(front: CardImage, back?: CardImage): Promise<Identification> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    { type: "text", text: "Front of the card:" },
    { type: "image", source: { type: "base64", media_type: front.media_type, data: front.data } },
  ];
  if (back) {
    content.push(
      { type: "text", text: "Back of the card:" },
      { type: "image", source: { type: "base64", media_type: back.media_type, data: back.data } },
    );
  }
  content.push({ type: "text", text: "Identify this card." });

  let response;
  try {
    response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
      output_config: { effort: "medium", format: zodOutputFormat(IdentificationSchema) },
      // If the request is ever declined by a safety classifier, retry it on a
      // fallback model inside the same call instead of failing outright.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new IdentificationError("Claude API key is missing or invalid. Set ANTHROPIC_API_KEY in .env.local.");
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new IdentificationError("Claude API rate limit reached. Wait a moment and try again.");
    }
    if (err instanceof Anthropic.BadRequestError) {
      throw new IdentificationError(`Claude rejected the request: ${err.message}`);
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new IdentificationError("Could not reach the Claude API. Check your internet connection.");
    }
    throw err;
  }

  if (response.stop_reason === "refusal") {
    throw new IdentificationError("The photo could not be processed. Try a different photo.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new IdentificationError("Could not read an identification from the response. Try again.");
  }

  const id = response.parsed_output;
  const result: Identification = {
    ...id,
    grader: id.is_graded ? normalizeGrader(id.grader) : null,
    grade: id.is_graded ? id.grade : null,
    cert_number: id.is_graded ? id.cert_number : null,
  };
  result.search_query = result.search_query?.trim() || buildSearchQuery(result);
  return result;
}
