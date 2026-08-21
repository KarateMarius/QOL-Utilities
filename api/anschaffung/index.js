// Ein Endpunkt fuer die Anschaffungen, ein Verteiler davor.
//
//   /api/anschaffung?was=posten     die Liste: was fehlt, was es kosten darf
//   /api/anschaffung?was=prospekte  Angebote der Moebel- und Technikhaeuser
//
// Zum Warum siehe angebote/index.js.
import posten from "./_posten.js";
import prospekte from "./_prospekte.js";

const WEGE = { posten, prospekte };

export default async function handler(req, res) {
  const weiter = WEGE[req.query.was];
  if (!weiter) {
    return res.status(404).json({ error: `Unbekannter Weg: ${req.query.was || "(keiner)"}` });
  }
  return weiter(req, res);
}
