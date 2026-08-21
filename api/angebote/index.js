// Ein Endpunkt fuer den Angebotstracker, ein Verteiler davor.
//
//   /api/angebote?was=prospekte     Prospekt-Angebote einer PLZ
//   /api/angebote?was=preisverlauf  Preisverlauf beobachteter Produkte
//   /api/angebote?was=geraete       Geraete anmelden, Korb verschicken
//   /api/angebote?was=rezepte       Rezepte
//   /api/angebote?was=watchlist     Suchwoerter und PLZ
//
// Warum: der Hobby-Tarif erlaubt zwoelf Serverless Functions je Auslieferung,
// und mit den Gedanken und den Anschaffungen standen wir bei fuenfzehn. Die
// Auslieferung schlug fehl - deshalb sind hier fuenf Dateien zu einer Route
// geworden.
//
// Die Handler selbst sind unangetastet geblieben und liegen weiterhin je
// Aufgabe in einer eigenen Datei; sie tragen jetzt nur einen Unterstrich im
// Namen, damit Vercel sie nicht mehr einzeln routet. Verschoben wurde die
// Tuer, nicht das Zimmer.
import prospekte from "./_prospekte.js";
import preisverlauf from "./_preisverlauf.js";
import geraete from "./_geraete.js";
import rezepte from "./_rezepte.js";
import watchlist from "./_watchlist.js";

const WEGE = { prospekte, preisverlauf, geraete, rezepte, watchlist };

export default async function handler(req, res) {
  const weiter = WEGE[req.query.was];
  if (!weiter) {
    return res.status(404).json({ error: `Unbekannter Weg: ${req.query.was || "(keiner)"}` });
  }
  return weiter(req, res);
}
