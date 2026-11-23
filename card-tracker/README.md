# Card Tracker

A phone-friendly web app for tracking a sports card collection.

- **Identify cards from a photo.** Snap the front (and optionally the back), and Claude reads the player, year, brand, set, card number, parallel, rookie/auto/relic flags, and, for slabs, the grader, grade and cert number. You can correct anything before saving.
- **Raw and graded values.** Prices come from current eBay listings, sorted into **Raw**, **PSA 10**, **PSA 9**, **BGS 9.5**, **SGC 10** and other grades. Each shows the median, a typical range, and links to the listings.
- **Collection view.** Shows total estimated value, what you paid, gain/loss per card, search and sort, and a price history each time you refresh.

## Setup

Requires Node.js 20+.

```bash
cd card-tracker
npm install
cp .env.example .env.local   # then fill in the keys below
npm run dev                  # http://localhost:3000
```

### API keys

| Key | What it's for | Where to get it |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Identifying cards from photos | [console.anthropic.com](https://console.anthropic.com/) → API keys |
| `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` | Price lookups | [developer.ebay.com](https://developer.ebay.com/my/keys): create an app and use the **Production** keyset (App ID = client ID, Cert ID = client secret) |

The app runs without the keys, but identification and pricing stay off until you add them. A banner says which keys are missing. You can always enter card details and your own value by hand.

### Using it on your phone

Run the server on your computer and open it from your phone on the same Wi-Fi:

```bash
npm run build && npm start -- -H 0.0.0.0
```

Then visit `http://<your-computer's-IP>:3000` on the phone. "Add card" opens the camera directly. To put it on your home screen, use Safari → Share → *Add to Home Screen* (iOS) or Chrome → *Install app* (Android).

To use it away from home, deploy it to a host that keeps a disk, such as a small VPS, Railway or Fly.io with a volume. The collection is a SQLite file. Serverless hosts like Vercel won't keep it.

## How pricing works

For each card the app runs two eBay Browse API searches in *Sports Trading Card Singles*: the card's search query, and the same query biased toward slabbed copies. Then it:

1. Drops lots, reprints and "you pick" listings. It also drops autographed, numbered and relic versions unless your card is one of those, so a base card isn't priced against its rare parallels.
2. Reads the grader and grade from each title ("PSA 10 GEM MINT", "Beckett 9.5", etc.). Titles like "PSA 10 candidate" or "PSA ready" count as raw.
3. Groups listings into Raw and per-grade buckets, removes outliers, and reports the median and the middle-50% range.

**Your card's value** is the bucket that matches it: Raw for a raw card, or for example PSA 9 if you own a PSA 9. Set **Own value** on a card to override it.

**Caveat:** these are *asking* prices on active listings, not completed sales, and asking prices usually run higher. eBay's sold-price API is limited to approved partners. Each price panel therefore links to eBay's sold-listings search for that card, so you can check real sales. The **eBay search used for prices** field on each card controls the query. If prices look off (for example, the base card mixed with a parallel), tighten or simplify it and tap *Refresh prices*.

## Project layout

```
src/
  app/
    page.tsx               collection list + totals
    add/page.tsx           photo → identify → review → price → save
    cards/[id]/page.tsx    card detail, prices, history, edit
    api/
      identify/            POST photo(s) → card details (Claude)
      prices/              POST card details → price report (eBay), used before saving
      cards/               list / create
      cards/[id]/          get / update / delete
      cards/[id]/prices    refresh prices and record history
      cards/[id]/image     stored card photo
  lib/
    identify.ts            Claude vision call with a structured-output schema
    ebay.ts                eBay OAuth + Browse API search
    pricing.ts             title parsing, raw/graded buckets, stats (unit-tested)
    db.ts                  SQLite schema and queries (data/cards.db)
```

Data (the database and card photos) lives in `./data/`, or in `DATA_DIR` if set. It's git-ignored, so back it up yourself.

## Scripts

- `npm run dev`: development server
- `npm run build && npm start`: production
- `npm test`: unit tests for the pricing logic
- `npm run lint`: lint
