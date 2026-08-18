// Gespeicherte Grundrisse eines Nutzers.
//
// GET    -> { user, plans: [{id, name, updatedAt, floorPlan}] }
// PUT    -> speichert einen Grundriss (body: {id?, name, floorPlan})
// DELETE -> ?id=... loescht einen Grundriss
//
// Ablage in derselben Upstash-DB wie der Trainer, unter dem dort etablierten
// Schema user:{userId}:{app} - hier mit app = "grundriss". Der Trainer kennt
// diesen Namensraum nicht (seine VALID_APPS-Whitelist listet ihn nicht), die
// beiden Apps kommen sich also nicht ins Gehege.
import { requireUser, getRedis, kvObject } from "./_auth.js";

const MAX_PLANS = 50;
const MAX_PLAN_BYTES = 400 * 1024; // ein Grundriss sind normal wenige KB

function planKey(userId) {
  return `user:${userId}:grundriss`;
}

function newId() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export default async function handler(req, res) {
  const userId = await requireUser(req, res);
  if (!userId) return undefined;

  const redis = getRedis();
  const key = planKey(userId);
  const stored = kvObject(await redis.get(key)) || {};

  if (req.method === "GET") {
    const plans = Object.values(stored).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return res.status(200).json({ user: { id: userId }, plans });
  }

  if (req.method === "PUT") {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: "Ungültiges JSON" });
      }
    }
    const { id, name, floorPlan } = body || {};
    if (!floorPlan || typeof floorPlan !== "object" || !Array.isArray(floorPlan.walls)) {
      return res.status(400).json({ error: "Kein gültiger Grundriss" });
    }
    if (JSON.stringify(floorPlan).length > MAX_PLAN_BYTES) {
      return res.status(413).json({ error: "Grundriss zu groß" });
    }

    const planId = typeof id === "string" && stored[id] ? id : newId();
    if (!stored[planId] && Object.keys(stored).length >= MAX_PLANS) {
      return res.status(409).json({ error: `Maximal ${MAX_PLANS} Grundrisse gespeichert.` });
    }

    stored[planId] = {
      id: planId,
      name: String(name || "Unbenannt").slice(0, 80),
      updatedAt: Date.now(),
      floorPlan,
    };
    await redis.set(key, stored);
    return res.status(200).json({ plan: { ...stored[planId], floorPlan: undefined }, id: planId });
  }

  if (req.method === "DELETE") {
    const id = req.query?.id;
    if (!id || !stored[id]) return res.status(404).json({ error: "Nicht gefunden" });
    delete stored[id];
    await redis.set(key, stored);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
