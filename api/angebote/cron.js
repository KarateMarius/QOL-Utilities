// Der taegliche Lauf.
//
// Vercel ruft diesen Endpunkt laut vercel.json einmal am Tag auf und schickt
// dabei "Authorization: Bearer $CRON_SECRET". Der Job laedt die Prospekte je
// benutzter PLZ neu, gleicht sie gegen die Watchlists ab und meldet nur
// Treffer, die beim letzten Lauf noch nicht gemeldet waren.
//
// Er prueft ausserdem die Spritpreis-Alarme und stellt die faelligen
// Gedanken zu. Beides gehoert der Sache nach nicht zu den Angeboten, liegt
// aber trotzdem hier: der Hobby-Tarif erlaubt genau einen Cron-Lauf pro Tag,
// und alle drei brauchen dieselben Geraete. Ein zweiter Endpunkt wuerde nie
// aufgerufen.
import { DEALS_TTL_SECONDS, listUsers, readDeals, readProfile, writeDeals, writeProfile } from "./_store.js";
import { findMatches } from "./_match.js";
import { scrape } from "./_scraper.js";
import { scrapeShops } from "./_shops.js";
import { sendToAll } from "./_push.js";
import { keyFor, recordAll } from "./_history.js";
import { pruefeTankalarm } from "../tanken/_alarm.js";
import { tschechienSchnitt } from "../tanken/_ausland.js";
import { listeNutzer as listeGedankenNutzer, meldeFaellige } from "../_gedanken.js";

const MAX_PREVIEW = 4;

// Guenstigster Tagespreis je Produkt - dieselbe Ware liegt oft in mehreren
// Prospekten.
function cheapestByKey(deals) {
  const map = new Map();
  for (const deal of deals) {
    const key = deal.key || keyFor(deal);
    if (!key || !(deal.price > 0)) continue;
    const current = map.get(key);
    if (!current || deal.price < current.price) {
      map.set(key, { key, price: deal.price, label: deal.title || deal.name });
    }
  }
  return map;
}

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

  // Shop-Rabatte haengen an keiner PLZ und werden immer mitgeschrieben: sie
  // sind wenige, stabil identifizierbar und genau die, deren Preisverlauf
  // interessiert.
  const shopDeals = await scrapeShops().catch(() => []);
  await recordAll([...cheapestByKey(shopDeals).values()]);

  const report = [];
  for (const { userId, profile } of active) {
    const deals = [...(dealsByPlz.get(profile.plz) || []), ...shopDeals];
    const hits = findMatches(deals, profile.entries);

    // Mitgeschrieben wird, was den Nutzer angeht: Watchlist-Treffer und was er
    // schon einmal in den Korb gelegt hat.
    const prices = cheapestByKey(deals);
    const watched = new Set([
      ...hits.map((hit) => hit.key || keyFor(hit)),
      ...Object.keys(profile.tracked || {}),
    ]);
    await recordAll([...watched].map((key) => prices.get(key)).filter(Boolean));
    const alreadyPushed = new Set(profile.pushed || []);
    const newHits = hits.filter((hit) => !alreadyPushed.has(hit.id));

    const entry = {
      user: userId,
      plz: profile.plz,
      deals: deals.length,
      hits: hits.length,
      new_hits: newHits.length,
      watched: watched.size,
    };

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

  // Spritpreis-Alarme. Bewusst ueber alle Profile, nicht nur ueber die mit
  // Watchlist: einen Alarm kann jemand haben, ohne je ein Suchwort angelegt
  // zu haben.
  const tankBericht = [];
  for (const { userId, profile } of profiles) {
    if (!profile.tankalarm?.schwelle) continue;
    try {
      // Das Profil kann in der Schleife oben neu geschrieben worden sein -
      // deshalb frisch lesen, sonst ueberschreibt der Alarm die gemerkten
      // Treffer wieder.
      const aktuell = await readProfile(userId);
      const { geaendert, profile: naechstes, bericht } = await pruefeTankalarm(aktuell);
      if (geaendert) await writeProfile(userId, naechstes);
      if (bericht) tankBericht.push({ user: userId, ...bericht });
    } catch (err) {
      console.error("[cron] tankalarm:", userId, err.message);
    }
  }

  // Faellige Gedanken. Eigene Nutzerliste, nicht die der Angebote: wer nur
  // aufschreibt und nie eine Watchlist angelegt hat, stuende dort nicht drin
  // und bekaeme nie eine Erinnerung.
  const gedankenBericht = [];
  for (const userId of await listeGedankenNutzer()) {
    try {
      const bericht = await meldeFaellige(userId);
      if (bericht) gedankenBericht.push({ user: userId, ...bericht });
    } catch (err) {
      console.error("[cron] gedanken:", userId, err.message);
    }
  }

  // Den Auslandsdurchschnitt gleich mit auffrischen. Er haelt 24 Stunden;
  // waermt ihn niemand vor, zahlt der erste Abruf des Tages die Wartezeit
  // fuer das Herunterladen der Woechentlichen CSV.
  const ausland = await tschechienSchnitt("diesel");

  return res.status(200).json({
    ausland: ausland ? { woche: ausland.woche, euro: ausland.euro } : null,
    users: users.length,
    scanned: dealsByPlz.size,
    report,
    tankalarme: tankBericht,
    gedanken: gedankenBericht,
  });
}
