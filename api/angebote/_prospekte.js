// Prospekt-Angebote einer PLZ.
//
// GET    -> { plz, fetched_at, from_cache, count, deals, hits }
//           ?plz=48155   Postleitzahl
//           ?refresh=1   Cache uebergehen und frisch scrapen
// DELETE -> Cache dieser PLZ verwerfen
//
// Nur mit Anmeldung. Die Prospektdaten selbst sind zwar oeffentlich, der
// Dienst als Ganzes soll es aber nicht sein - und jeder Aufruf ohne Cache
// stoesst einen Scan bei fremden Servern an. Das gehoert nicht jedem offen.
import { requireUser } from "../_auth.js";
import {
  DEALS_TTL_SECONDS,
  DEFAULT_PLZ,
  SHOPS_TTL_SECONDS,
  dropDeals,
  readDeals,
  readProfile,
  readShops,
  writeDeals,
  writeShops,
} from "./_store.js";
import { cleanPlz, findMatches } from "./_match.js";
import { scrape } from "./_scraper.js";
import { scrapeShops } from "./_shops.js";
import { keyFor } from "./_history.js";

async function loadDeals(plz, force) {
  if (!force) {
    const cached = await readDeals(plz);
    if (cached?.deals?.length && Date.now() - (cached.timestamp || 0) < DEALS_TTL_SECONDS * 1000) {
      return { deals: cached.deals, fetchedAt: cached.timestamp, fromCache: true };
    }
  }

  const fresh = await scrape(plz);
  if (!fresh.length) {
    // Ein misslungener Lauf darf keinen brauchbaren Cache entwerten.
    const cached = await readDeals(plz);
    if (cached?.deals?.length) {
      return { deals: cached.deals, fetchedAt: cached.timestamp, fromCache: true };
    }
    return { deals: [], fetchedAt: 0, fromCache: false };
  }

  await writeDeals(plz, fresh);
  return { deals: fresh, fetchedAt: Date.now(), fromCache: false };
}

// Online-Shops haengen an keiner PLZ, also eigener Cache und eigener Takt.
// Was tatsaechlich an den Browser geht.
//
// Weggelassen: `name` (ist Titel + Untertitel), `unit` (wortgleich mit
// `subtitle`), `valid_from` (wird nirgends angezeigt) und `available` (dient
// nur dem Aussortieren). Zusammen ein gutes Drittel der Antwort - bei 2100
// Angeboten waren das rund 340 KB, die niemand gebraucht hat.
//
// `key` kommt dagegen dazu: den Verlaufsschluessel bildet der Server, damit
// die Oberflaeche die Normalisierung nicht nachbauen muss.
function forClient(deal) {
  return {
    id: deal.id,
    key: keyFor(deal),
    title: deal.title,
    subtitle: deal.subtitle,
    note: deal.note,
    merchant: deal.merchant,
    price: deal.price,
    old_price: deal.old_price,
    discount_pct: deal.discount_pct,
    price_range: deal.price_range,
    base_price: deal.base_price,
    base_unit: deal.base_unit,
    category: deal.category,
    valid_until: deal.valid_until,
    image_url: deal.image_url,
    ...(deal.url ? { url: deal.url } : {}),
    ...(deal.matched_keyword ? { matched_keyword: deal.matched_keyword } : {}),
  };
}

async function loadShops(force) {
  if (!force) {
    const cached = await readShops();
    if (cached && Date.now() - (cached.timestamp || 0) < SHOPS_TTL_SECONDS * 1000) {
      return cached.deals || [];
    }
  }

  const fresh = await scrapeShops();
  if (fresh.length) {
    await writeShops(fresh);
    return fresh;
  }

  const cached = await readShops();
  return cached?.deals || [];
}

export default async function handler(req, res) {
  const userId = await requireUser(req, res);
  if (!userId) return undefined;

  const plz = cleanPlz(req.query?.plz, DEFAULT_PLZ);

  if (req.method === "DELETE") {
    await dropDeals(plz);
    return res.status(200).json({ status: "cleared", plz });
  }

  if (req.method !== "GET") return res.status(405).end();

  const refresh = req.query?.refresh === "1" || req.query?.refresh === "true";
  const [market, shops] = await Promise.all([loadDeals(plz, refresh), loadShops(refresh)]);
  const { fetchedAt, fromCache } = market;
  const deals = [...market.deals, ...shops];

  const profile = await readProfile(userId);
  const hits = findMatches(deals, profile.entries);

  return res.status(200).json({
    plz,
    fetched_at: fetchedAt,
    from_cache: fromCache,
    count: deals.length,
    deals: deals.map(forClient),
    hits: hits.map(forClient),
  });
}
