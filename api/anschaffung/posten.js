// Was fehlt noch, und was kostet es?
//
// GET    -> { posten }
// POST   { name, raum?, budget? }        -> neuer Posten
// PUT    { id, ...felder }               -> aendern; { preis } haengt einen
//                                           gesehenen Preis an
// DELETE ?id=...                         -> loeschen
//
// Ein Posten ist kein Angebot. Er lebt von der ersten Idee bis zum Kauf und
// sammelt unterwegs Preise ein - den vom Prospekt genauso wie den, den man
// selbst im Laden gesehen hat. Der von Hand eingetragene ist der wichtigere:
// bei grossen Anschaffungen steht der Preis am Regal und auf der
// Produktseite, nicht im Prospekt.
import { requireUser } from "../_auth.js";
import { liesPosten, schreibPosten } from "./_store.js";

const ZUSTAENDE = new Set(["gesucht", "gekauft"]);
const MAX_NAME = 120;

function zahl(wert) {
  const n = Number(wert);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

export default async function handler(req, res) {
  const nutzer = await requireUser(req, res);
  if (!nutzer) return undefined;

  const koerper = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

  if (req.method === "GET") {
    return res.status(200).json({ posten: await liesPosten(nutzer) });
  }

  if (req.method === "POST") {
    const name = String(koerper.name || "").trim();
    if (!name) return res.status(400).json({ error: "Ohne Namen kein Posten." });
    if (name.length > MAX_NAME) return res.status(400).json({ error: "Der Name ist zu lang." });

    const posten = await liesPosten(nutzer);
    posten.push({
      id: `an-${Date.now()}`,
      name,
      raum: String(koerper.raum || "").trim(),
      budget: zahl(koerper.budget),
      zustand: "gesucht",
      preise: [],
      angelegt: new Date().toISOString(),
    });
    await schreibPosten(nutzer, posten);
    return res.status(200).json({ posten });
  }

  if (req.method === "PUT") {
    const posten = await liesPosten(nutzer);
    const stelle = posten.findIndex((p) => p.id === koerper.id);
    if (stelle === -1) return res.status(404).json({ error: "Posten nicht gefunden." });

    const alt = posten[stelle];
    const neu = { ...alt };

    if (koerper.name !== undefined) {
      const name = String(koerper.name).trim();
      if (!name) return res.status(400).json({ error: "Ohne Namen kein Posten." });
      neu.name = name.slice(0, MAX_NAME);
    }
    if (koerper.raum !== undefined) neu.raum = String(koerper.raum).trim();
    if (koerper.budget !== undefined) neu.budget = zahl(koerper.budget);

    if (koerper.zustand !== undefined) {
      if (!ZUSTAENDE.has(koerper.zustand)) {
        return res.status(400).json({ error: "Unbekannter Zustand." });
      }
      neu.zustand = koerper.zustand;
      // Gekauft heisst: zu welchem Preis. Ohne Betrag zaehlt der guenstigste
      // gesehene - sonst stuende in der Summe eine Luecke.
      if (koerper.zustand === "gekauft") {
        const betrag = zahl(koerper.gekauftFuer);
        const gesehen = (neu.preise || []).map((p) => p.betrag);
        neu.gekauftFuer = betrag ?? (gesehen.length ? Math.min(...gesehen) : null);
        neu.gekauftAm = new Date().toISOString();
      } else {
        neu.gekauftFuer = null;
        neu.gekauftAm = null;
      }
    }

    if (koerper.preis) {
      const betrag = zahl(koerper.preis.betrag);
      if (betrag === null || betrag === 0) {
        return res.status(400).json({ error: "Der Preis fehlt." });
      }
      neu.preise = [
        ...(neu.preise || []),
        {
          betrag,
          laden: String(koerper.preis.laden || "").trim(),
          zeit: new Date().toISOString(),
        },
      ];
    }

    posten[stelle] = neu;
    await schreibPosten(nutzer, posten);
    return res.status(200).json({ posten });
  }

  if (req.method === "DELETE") {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "Kein Posten angegeben." });
    const posten = await liesPosten(nutzer);
    const rest = posten.filter((p) => p.id !== id);
    if (rest.length === posten.length) {
      return res.status(404).json({ error: "Posten nicht gefunden." });
    }
    await schreibPosten(nutzer, rest);
    return res.status(200).json({ posten: rest });
  }

  return res.status(405).end();
}
