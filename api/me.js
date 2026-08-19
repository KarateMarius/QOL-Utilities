// Wer ist angemeldet?
//
// GET -> { user: { id } }  oder 401
//
// Frueher hat die Grundriss-App ihren Anmeldestatus aus GET /api/plans
// abgeleitet, um sich einen zweiten Endpunkt zu sparen. Mit mehreren Apps
// unter einer Oberflaeche traegt das nicht mehr: der Desktop braucht den
// Status, bevor irgendeine App geladen ist.
import { getUserId } from "./_auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const userId = await getUserId(req.headers.cookie || "");
  if (!userId) return res.status(401).json({ error: "Nicht angemeldet" });

  return res.status(200).json({ user: { id: userId } });
}
