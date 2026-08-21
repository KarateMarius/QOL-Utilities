// Prospekte fuer die grosse Anschaffung.
//
// GET -> { plz, stand, aus_dem_speicher, angebote }
//        ?plz=48155   Postleitzahl
//        ?refresh=1   Speicher uebergehen
//
// Zwei Quellen, und die zweite ist geschenkt:
//
//   1. Die Moebel-, Technik- und Baumaerkte. Eigener Durchgang durch
//      denselben Scraper, andere Zielgruppe. Gemessen 2,3 s - deutlich
//      weniger als die 13 s des Wocheneinkaufs, weil weniger Prospekte
//      zusammenkommen.
//
//   2. Was in den Supermarktprospekten steht, die ohnehin schon geholt
//      wurden. Dort liegen Kuehlschraenke, Fernseher und Waschmaschinen -
//      gemessen rund 40 Stueck je Woche, fuer null zusaetzliche Anfragen.
//      Deshalb wird hier nur der vorhandene Speicher gelesen und nie ein
//      Wocheneinkauf-Scan angestossen: der gehoert dem taeglichen Lauf.
import { requireUser } from "../_auth.js";
import { readDeals, readProfile, DEFAULT_PLZ } from "../angebote/_store.js";
import { cleanPlz } from "../angebote/_match.js";
import { scrape, ANSCHAFFUNGEN } from "../angebote/_scraper.js";
import { nurAnschaffungen } from "./_erkennen.js";
import { ANGEBOTE_TTL_SECONDS, liesAngebote, schreibAngebote } from "./_store.js";

function zusammenfuehren(listen) {
  const gesehen = new Set();
  const alle = [];
  for (const angebot of listen.flat()) {
    const schluessel = `${angebot.name.toLowerCase()}|${angebot.merchant.toLowerCase()}`;
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    alle.push(angebot);
  }
  alle.sort((a, b) => b.price - a.price);
  return alle;
}

export default async function handler(req, res) {
  const nutzer = await requireUser(req, res);
  if (!nutzer) return undefined;
  if (req.method !== "GET") return res.status(405).end();

  const profil = await readProfile(nutzer);
  const plz = cleanPlz(req.query.plz) || profil.plz || DEFAULT_PLZ;
  const frisch = req.query.refresh === "1";

  if (!frisch) {
    const gelegt = await liesAngebote(plz);
    if (gelegt?.angebote && Date.now() - (gelegt.timestamp || 0) < ANGEBOTE_TTL_SECONDS * 1000) {
      return res.status(200).json({
        plz,
        stand: gelegt.timestamp,
        aus_dem_speicher: true,
        angebote: gelegt.angebote,
      });
    }
  }

  // Der Wocheneinkauf wird gelesen, nicht geholt. Ist er nicht da, fehlen
  // eben die Grossgeraete aus dem Supermarkt - das ist kein Grund, hier einen
  // zweiten Scan von 13 Sekunden anzustossen.
  const [ausHaeusern, wocheneinkauf] = await Promise.all([
    scrape(plz, ANSCHAFFUNGEN).catch((err) => {
      console.error("[anschaffung] scrape:", err.message);
      return [];
    }),
    readDeals(plz),
  ]);

  const angebote = zusammenfuehren([
    nurAnschaffungen(ausHaeusern),
    nurAnschaffungen(wocheneinkauf?.deals || []),
  ]);

  // Ein misslungener Lauf darf keinen brauchbaren Speicher entwerten.
  if (!angebote.length) {
    const gelegt = await liesAngebote(plz);
    if (gelegt?.angebote?.length) {
      return res.status(200).json({
        plz,
        stand: gelegt.timestamp,
        aus_dem_speicher: true,
        angebote: gelegt.angebote,
      });
    }
  } else {
    await schreibAngebote(plz, angebote);
  }

  return res.status(200).json({ plz, stand: Date.now(), aus_dem_speicher: false, angebote });
}
