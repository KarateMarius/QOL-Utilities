// Anmeldung und Auskunft darueber, wer angemeldet ist.
//
// GET    -> { user: { id } }  oder 401
// POST   { username, password } -> anmelden
// DELETE -> abmelden
//
// Frueher zwei Endpunkte, /api/me und /api/login. Zusammengelegt nicht aus
// Schoenheitsgruenden, sondern weil der Hobby-Tarif zwoelf Serverless
// Functions je Auslieferung erlaubt und wir bei fuenfzehn standen - siehe den
// Verteiler-Kommentar in angebote/index.js.
//
// Die drei Methoden schliessen sich ohnehin aus, deshalb braucht es hier
// keinen Verteiler ueber einen Parameter: die Methode ist der Verteiler.
import wer from "./_wer.js";
import anmelden from "./_anmelden.js";

export default async function handler(req, res) {
  if (req.method === "GET") return wer(req, res);
  if (req.method === "POST" || req.method === "DELETE") return anmelden(req, res);
  return res.status(405).end();
}
