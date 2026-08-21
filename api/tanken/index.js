// Ein Endpunkt fuers Tanken, ein Verteiler davor.
//
//   /api/tanken?was=stationen  Spritpreise einer PLZ
//   /api/tanken?was=alarm      Preisalarm setzen und lesen
//
// Zum Warum siehe angebote/index.js: der Hobby-Tarif zaehlt Dateien, nicht
// Aufgaben.
import stationen from "./_stationen.js";
import alarm from "./_preisalarm.js";

const WEGE = { stationen, alarm };

export default async function handler(req, res) {
  const weiter = WEGE[req.query.was];
  if (!weiter) {
    return res.status(404).json({ error: `Unbekannter Weg: ${req.query.was || "(keiner)"}` });
  }
  return weiter(req, res);
}
