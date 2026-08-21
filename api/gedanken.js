// Gedanken: ein einseitiger Chat mit sich selbst.
//
// GET    -> { nutzer, gedanken }
// POST   { text, faellig? } -> haengt an. Ohne faellig geht die Meldung
//                              sofort raus, mit faellig erst im taeglichen
//                              Lauf des Tages.
// DELETE ?id=... -> loescht einen Gedanken
//
// Warum ueberhaupt eine Meldung fuer etwas, das man gerade selbst
// geschrieben hat: damit der Zettel auf dem Sperrbildschirm liegt und nicht
// in einer App, die man aufmachen muesste. Aufschreiben ist das eine,
// wiederfinden das andere.
import { requireUser } from "./_auth.js";
import { berlinDatum } from "./_zeit.js";
import { lies, melde, schreib } from "./_gedanken.js";

const MAX_ZEICHEN = 1000;

function istTag(wert) {
  return typeof wert === "string" && /^\d{4}-\d{2}-\d{2}$/.test(wert);
}

export default async function handler(req, res) {
  const nutzer = await requireUser(req, res);
  if (!nutzer) return undefined;

  const jetzt = new Date();

  if (req.method === "GET") {
    return res.status(200).json({ nutzer, gedanken: await lies(nutzer) });
  }

  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return res.status(400).json({ error: "Ohne Text kein Gedanke." });
    if (text.length > MAX_ZEICHEN) {
      return res.status(400).json({ error: `Hoechstens ${MAX_ZEICHEN} Zeichen.` });
    }

    // Ein Tag in der Vergangenheit oder heute waere eine Zusage, die nicht
    // eingehalten werden kann: der Lauf des heutigen Tages ist durch. Lieber
    // sagen als stillschweigend verschieben.
    let faellig = null;
    if (body.faellig) {
      if (!istTag(body.faellig)) return res.status(400).json({ error: "Kein gueltiger Tag." });
      if (body.faellig <= berlinDatum(jetzt)) {
        return res.status(400).json({ error: "Der Tag muss in der Zukunft liegen." });
      }
      faellig = body.faellig;
    }

    const gedanke = {
      id: `gd-${jetzt.getTime()}`,
      text,
      zeit: jetzt.toISOString(),
      faellig,
      gemeldet: null,
    };

    // Erst melden, dann ablegen: geht die Meldung schief, soll trotzdem
    // nichts verlorengehen - der Gedanke steht dann eben nur in der Liste.
    // Warum sie schiefging, geht als zustellung mit zurueck; die Oberflaeche
    // sagt es dann, statt eine Meldung vorzutaeuschen.
    let zustellung = "vorgemerkt";
    if (!faellig) {
      const ergebnis = await melde(nutzer, gedanke, "Notiz an dich").catch(() => ({
        gesendet: 0,
        grund: "fehlgeschlagen",
      }));
      zustellung = ergebnis.grund;
      if (ergebnis.gesendet) gedanke.gemeldet = jetzt.toISOString();
    }

    const gedanken = await lies(nutzer);
    gedanken.push(gedanke);
    await schreib(nutzer, gedanken);
    return res.status(200).json({ nutzer, gedanken, neu: gedanke.id, zustellung });
  }

  if (req.method === "DELETE") {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "Kein Gedanke angegeben." });
    const gedanken = await lies(nutzer);
    const rest = gedanken.filter((g) => g.id !== id);
    if (rest.length === gedanken.length) {
      return res.status(404).json({ error: "Gedanke nicht gefunden." });
    }
    await schreib(nutzer, rest);
    return res.status(200).json({ nutzer, gedanken: rest });
  }

  return res.status(405).end();
}
