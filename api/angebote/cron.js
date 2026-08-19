// Taeglicher Prospekt-Scan.
//
// Vercel ruft diesen Endpunkt laut vercel.json einmal am Tag auf und schickt
// dabei "Authorization: Bearer $CRON_SECRET". Der Job laedt die Prospekte je
// benutzter PLZ neu, gleicht sie gegen die Watchlists ab und meldet nur
// Treffer, die beim letzten Lauf noch nicht gemeldet waren.
import { DEALS_TTL_SECONDS, listUsers, readDeals, readProfile, writeDeals, writeProfile } from "./_store.js";
import { findMatches } from "./_match.js";
import { scrape } from "./_scraper.js";
import { sendToAll } from "./_push.js";

const MAX_PREVIEW = 4;

function preview(hits) {
  const names = hits
    .slice(0, MAX_PREVIEW)
    .map((hit) => `${hit.title} ${hit.price.toFixed(2).replace(".", ",")} €`)
    .join(", ");
  return hits.length > MAX_PREVIEW ? `${names} +${hits.length - MAX_PREVIEW} weitere` : names;
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Nicht berechtigt" });
  }

  const users = await listUsers();
  const profiles = await Promise.all(
    users.map(async (userId) => ({ userId, profile: await readProfile(userId) }))
  );

  const active = profiles.filter(({ profile }) => profile.entries.length);
  if (!active.length) return res.status(200).json({ users: users.length, scanned: 0 });

  // Mehrere Nutzer teilen sich oft dieselbe PLZ - dann reicht ein Scan.
  const dealsByPlz = new Map();
  for (const { profile } of active) {
    if (dealsByPlz.has(profile.plz)) continue;

    const cached = await readDeals(profile.plz);
    const fresh = Date.now() - (cached?.timestamp || 0) < DEALS_TTL_SECONDS * 1000;
    if (cached?.deals?.length && fresh) {
      dealsByPlz.set(profile.plz, cached.deals);
      continue;
    }

    const deals = await scrape(profile.plz);
    if (deals.length) await writeDeals(profile.plz, deals);
    dealsByPlz.set(profile.plz, deals.length ? deals : cached?.deals || []);
  }

  const report = [];
  for (const { userId, profile } of active) {
    const deals = dealsByPlz.get(profile.plz) || [];
    const hits = findMatches(deals, profile.entries);
    const alreadyPushed = new Set(profile.pushed || []);
    const newHits = hits.filter((hit) => !alreadyPushed.has(hit.id));

    const entry = { user: userId, plz: profile.plz, deals: deals.length, hits: hits.length, new_hits: newHits.length };

    let subscriptions = profile.subscriptions;
    if (newHits.length && subscriptions.length) {
      const result = await sendToAll(subscriptions, {
        title: `${newHits.length} neue Treffer auf deiner Watchlist`,
        body: preview(newHits),
        tag: "watchlist",
      });
      subscriptions = result.subscriptions;
      entry.sent = result.sent;
    }

    // Nur die Treffer dieses Laufs merken: ein Angebot, das naechste Woche
    // wiederkommt, soll erneut melden.
    await writeProfile(userId, { ...profile, subscriptions, pushed: hits.map((hit) => hit.id) });
    report.push(entry);
  }

  return res.status(200).json({ users: users.length, scanned: dealsByPlz.size, report });
}
