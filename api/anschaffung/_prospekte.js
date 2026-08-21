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
// Drei Beruehrungen mit dem Nachbarn, alle drei mit Absicht:
//   scrape      - das Fahrzeug. Welche Haeuser es anfaehrt, steht in
//                 _haeuser.js; der Scraper selbst kennt keine Sofas.
//   readProfile - dort liegt die Postleitzahl des Kontos. Kein Angebot,
//                 sondern der Ort des Nutzers; sie steht dort, weil es noch
//                 keinen gemeinsamen Ort gibt (siehe IDEEN.md, "Ein Ort statt
//                 drei").
//   readDeals   - der Wocheneinkauf-Speicher, gelesen und nie geholt, und nur
//                 durch den Klassifizierer hindurch. Siehe unten.
import { readDeals, readProfile, DEFAULT_PLZ } from "../angebote/_store.js";
import { scrape } from "../angebote/_scraper.js";
import { ANSCHAFFUNGEN } from "./_haeuser.js";
import { nurAnschaffungen } from "./_erkennen.js";
import { ANGEBOTE_TTL_SECONDS, liesAngebote, schreibAngebote } from "./_store.js";

/** Die einzige Beruehrung zwischen den beiden Toepfen, und deshalb eine
    eigene Funktion mit Namen.
    
    Gelesen wird der Wocheneinkauf-Speicher, geholt wird er nie - das gehoert
    dem taeglichen Lauf. Und was herauskommt, geht durch denselben
    Klassifizierer wie alles andere: er ist eine Positivliste, in der kein
    Lebensmittel steht. Gemessen an einem echten Prospektsatz kamen 39 Stueck
    durch - Kuehlschrank, Fernseher, Staubsauger, Mikrowelle, Matratze - und
    kein einziges Essen. */
async function geraeteAusDemWocheneinkauf(plz) {
  const gelegt = await readDeals(plz);
  return nurAnschaffungen(gelegt?.deals || []);
}

/** Fuenf Ziffern oder gar nichts. */
function cleanPlz(plz) {
  const wert = String(plz || "");
  return /^\d{5}$/.test(wert) ? wert : "";
}

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
  const [ausHaeusern, ausDemWocheneinkauf] = await Promise.all([
    scrape(plz, ANSCHAFFUNGEN).catch((err) => {
      console.error("[anschaffung] scrape:", err.message);
      return [];
    }),
    geraeteAusDemWocheneinkauf(plz),
  ]);

  const angebote = zusammenfuehren([nurAnschaffungen(ausHaeusern), ausDemWocheneinkauf]);

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
