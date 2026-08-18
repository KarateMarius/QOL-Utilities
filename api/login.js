// POST   -> anmelden (gleiche Zugangsdaten wie im Trainer)
// DELETE -> abmelden
import {
  getRedis,
  getAllUsers,
  verifyPassword,
  makeCookieValue,
  sessionCookie,
  clearedCookie,
} from "./_auth.js";

const MAX_FAILS = 5;
const LOCK_SECS = 10 * 60;

export default async function handler(req, res) {
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", clearedCookie());
    return res.status(200).json({ ok: true });
  }
  if (req.method !== "POST") return res.status(405).end();

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Ungültige Anfrage" });
    }
  }
  const { username, password } = body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Nutzername und Passwort erforderlich" });
  }

  const id = String(username).toLowerCase().trim();

  // Absichtlich dieselben Sperr-Schluessel wie im Trainer: sonst waere diese
  // App ein Schlupfloch, um dieselben Accounts ohne Rate-Limit durchzuprobieren.
  // So gilt eine Sperre fuer beide Apps gemeinsam.
  const lockKey = `lock:${id}`;
  const failKey = `fails:${id}`;
  const blockKey = `blocked:${id}`;

  let redis = null;
  try {
    redis = getRedis();
  } catch {
    redis = null;
  }

  if (redis) {
    try {
      if (await redis.get(blockKey)) {
        return res.status(403).json({ error: "Dieser Account wurde gesperrt." });
      }
      if (await redis.get(lockKey)) {
        const ttl = await redis.ttl(lockKey);
        const mins = Math.max(1, Math.ceil((ttl > 0 ? ttl : LOCK_SECS) / 60));
        return res.status(423).json({ error: `Account gesperrt. Versuche es in ${mins} Min. erneut.` });
      }
    } catch {
      /* KV nicht erreichbar -> ohne Sperre fortfahren */
    }
  }

  await new Promise((r) => setTimeout(r, 300)); // konstante Verzoegerung gegen Timing-Angriffe

  const users = await getAllUsers();
  const user = users.find((u) => u.id === id);
  const ok = user && (await verifyPassword(password, user.pw));

  if (!ok) {
    let left = MAX_FAILS;
    if (redis) {
      try {
        const fails = await redis.incr(failKey);
        if (fails === 1) await redis.expire(failKey, LOCK_SECS);
        if (fails >= MAX_FAILS) {
          await redis.set(lockKey, "1", { ex: LOCK_SECS });
          await redis.del(failKey);
          return res.status(423).json({ error: "Zu viele Fehlversuche. Account für 10 Minuten gesperrt." });
        }
        left = MAX_FAILS - fails;
      } catch {
        /* kein Zaehler ohne KV */
      }
    }
    const hint = redis ? ` Noch ${left} Versuch${left === 1 ? "" : "e"}.` : "";
    return res.status(401).json({ error: `Nutzername oder Passwort falsch.${hint}` });
  }

  if (redis) {
    try {
      await redis.del(failKey, lockKey);
    } catch {
      /* egal */
    }
  }

  // Anders als der Trainer migriert diese App KEINE Klartext-Passwoerter zu
  // bcrypt - das Schreiben auf auth:users bleibt bewusst allein beim Trainer,
  // damit hier kein zweiter Schreibpfad auf die Nutzerliste entsteht.
  res.setHeader("Set-Cookie", sessionCookie(await makeCookieValue(user.id)));
  return res.status(200).json({ userId: user.id, name: user.name || user.id });
}
