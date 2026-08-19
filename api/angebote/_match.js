// Abgleich der Angebote gegen die Watchlist. Wird sowohl beim Laden der Seite
// als auch vom naechtlichen Cron-Job benutzt - deshalb hier und nicht in einer
// der beiden Routen.

export function matches(deal, entry) {
  const keyword = String(entry?.keyword || "").trim().toLowerCase();
  if (!keyword || !String(deal.name || "").toLowerCase().includes(keyword)) return false;

  if (entry.max_price != null) {
    if (!deal.price || deal.price > entry.max_price) return false;
  }

  if (entry.category && deal.category !== entry.category) return false;

  return true;
}

/** Treffer, je Angebot nur einmal, guenstigste zuerst. */
export function findMatches(deals, entries) {
  if (!entries?.length) return [];

  const seen = new Set();
  const hits = [];
  for (const entry of entries) {
    for (const deal of deals) {
      if (seen.has(deal.id) || !matches(deal, entry)) continue;
      seen.add(deal.id);
      hits.push({ ...deal, matched_keyword: entry.keyword });
    }
  }
  return hits.sort((a, b) => (a.price || 0) - (b.price || 0));
}

export function cleanPlz(plz, fallback) {
  const value = String(plz || "");
  return /^\d{5}$/.test(value) ? value : fallback;
}
