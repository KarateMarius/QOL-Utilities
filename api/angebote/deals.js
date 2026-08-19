// Prospekt-Angebote einer PLZ.
//
// GET    -> { plz, fetched_at, from_cache, count, deals, hits }
//           ?plz=48155   Postleitzahl
//           ?refresh=1   Cache uebergehen und frisch scrapen
// DELETE -> Cache dieser PLZ verwerfen
//
// Bewusst ohne Anmeldezwang: Prospekte sind oeffentliche Daten und der Cache
// ist fuer alle Nutzer derselbe. Nur die Watchlist-Treffer kommen dazu, wenn
// eine Session vorliegt.
import { getUserId } from "../_auth.js";
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
  const plz = cleanPlz(req.query?.plz, DEFAULT_PLZ);

  if (req.method === "DELETE") {
    await dropDeals(plz);
    return res.status(200).json({ status: "cleared", plz });
  }

  if (req.method !== "GET") return res.status(405).end();

  const refresh = req.query?.refresh === "1" || req.query?.refresh === "true";
  const [market, shops] = await Promise.all([loadDeals(plz, refresh), loadShops(refresh)]);
  const { fetchedAt, fromCache } = market;
  // Der Schluessel kommt vom Server, damit Oberflaeche und Preisverlauf
  // garantiert dieselbe Normalisierung benutzen.
  const deals = [...market.deals, ...shops].map((deal) => ({ ...deal, key: keyFor(deal) }));

  let hits = [];
  const userId = await getUserId(req.headers.cookie || "");
  if (userId) {
    const profile = await readProfile(userId);
    hits = findMatches(deals, profile.entries);
  }

  return res.status(200).json({
    plz,
    fetched_at: fetchedAt,
    from_cache: fromCache,
    count: deals.length,
    deals,
    hits,
  });
}
