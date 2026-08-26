/**
 * Rules-based stock-adjustment parser — "réception 20 sacs de maïs",
 * "perte de 5 kg de prémix". Pure, offline, deterministic.
 *
 * Timid by design. A stock movement is a real write against a real article, so:
 *  - the article is matched against the farm's OWN stock items (from the RTK Query cache), never
 *    invented — an unknown `stockItemId` fails on the server, after the farmer confirmed;
 *  - an ambiguous article name (two items match) is refused rather than picked;
 *  - the direction must be explicit. "20 sacs de maïs" alone says nothing about in or out, and
 *    guessing wrong moves the stock the opposite way.
 */
import type { ParseContext, StockAdjustIntent } from '../types';
import { normalize, parseTrailingFrenchNumber, parseFrenchNumber } from './util';

const IN_RE = /\b(reception|receptionne|recu|recus|entree|entrees|livraison|livre|ajoute|ajout|rentre)\b/;
const OUT_RE = /\b(perte|pertes|perdu|perdus|sortie|sorties|casse|gaspillage|retire|retrait|consomme)\b/;
const STOCK_RE = /\b(stock|sac|sacs|kg|kilos?|litres?|bidon|bidons|carton|cartons)\b/;

/** Words that never help identify an article. */
const NOISE =
  /\b(de|du|des|d|la|le|les|un|une|en|sacs?|kg|kilos?|kilogrammes?|litres?|l|bidons?|cartons?|stock|reception|receptionne|recu|recus|entree|entrees|livraison|livre|ajoute|ajout|rentre|perte|pertes|perdu|perdus|sortie|sorties|casse|gaspillage|retire|retrait|consomme)\b/g;

/**
 * The single stock item whose article key appears in the phrase. Returns null when none matches,
 * and null when several do — two candidates mean the farmer must disambiguate, not us.
 */
function matchItem(
  norm: string,
  items: NonNullable<ParseContext['stockItems']>,
): { id: number; articleKey: string; unit?: string } | null {
  const haystack = ` ${norm.replace(NOISE, ' ').replace(/\s+/g, ' ').trim()} `;
  const hits = items.filter((i) => {
    const needle = normalize(i.articleKey).replace(/_/g, ' ');
    return needle.length > 1 && haystack.includes(` ${needle} `);
  });
  if (hits.length !== 1) return null;
  const hit = hits[0]!;
  return { id: hit.id, articleKey: hit.articleKey, unit: hit.unit ?? undefined };
}

function quantityOf(norm: string): number | null {
  const m = norm.match(STOCK_RE);
  if (m?.index != null) {
    const value = parseTrailingFrenchNumber(norm.slice(0, m.index));
    if (value != null) return value;
  }
  return parseFrenchNumber(norm);
}

export const stockAdjustParser = {
  parse(text: string, ctx: ParseContext): StockAdjustIntent | null {
    const norm = normalize(text);

    // Direction must be explicit and unambiguous — never guess which way the stock moves.
    const isIn = IN_RE.test(norm);
    const isOut = OUT_RE.test(norm);
    if (isIn === isOut) return null;

    if (!ctx.stockItems || ctx.stockItems.length === 0) return null;
    const item = matchItem(norm, ctx.stockItems);
    if (item == null) return null;

    const quantity = quantityOf(norm);
    if (quantity == null || quantity < 1) return null;

    return {
      kind: 'ADJUST_STOCK',
      stockItemId: item.id,
      articleKey: item.articleKey,
      delta: isIn ? quantity : -quantity,
      unit: item.unit,
    };
  },
};
