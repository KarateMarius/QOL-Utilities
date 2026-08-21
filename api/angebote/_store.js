// Ablage fuer den Angebotstracker in derselben Upstash-DB wie Grundriss und
// Trainer.
//
// Schluessel:
//   angebote:deals:{plz}   - Prospekt-Cache, oeffentlich und fuer alle Nutzer
//                            gemeinsam (es sind ja dieselben Prospekte)
//   user:{userId}:angebote - Watchlist, PLZ und Push-Geraete eines Nutzers,
//                            nach dem Schema aus plans.js
//   angebote:users         - Index der Nutzer mit Watchlist, damit der
//                            Cron-Job nicht die ganze DB durchsuchen muss
//   angebote:hist:{key}    - Preisverlauf eines beobachteten Produkts
//   angebote:shops         - Rabatte der Online-Shops, bundesweit
import { getRedis } from "../_auth.js";
// Lesen und Schreiben liegen jetzt in api/_kv.js: die Anschaffungen legen
// ebenfalls grosse Werte ab und sollen dafuer nicht in diesen Ordner greifen
// muessen. Hier weiterhin ausgereicht, damit die bisherigen Nutzer dieses
// Moduls nichts davon merken.
export { readKey, writeKey } from "../_kv.js";
import { readKey, writeKey } from "../_kv.js";

export const DEALS_TTL_SECONDS = 6 * 3600;

// Shop-Rabatte gelten bundesweit und aendern sich haeufiger als Wochenprospekte.
export const SHOPS_TTL_SECONDS = 3 * 3600;

// ── Prospekt-Cache ──────────────────────────────────────────────────────────

const dealsKey = (plz) => `angebote:deals:${plz}`;

export const readDeals = (plz) => readKey(dealsKey(plz));

export const writeDeals = (plz, deals) =>
  writeKey(dealsKey(plz), { timestamp: Date.now(), plz, deals }, DEALS_TTL_SECONDS);

export async function dropDeals(plz) {
  try {
    await getRedis().del(dealsKey(plz));
    return true;
  } catch (err) {
    console.error("[store] cache loeschen:", err.message);
    return false;
  }
}

// ── Shop-Rabatte ────────────────────────────────────────────────────────────

const SHOPS_KEY = "angebote:shops";

export const readShops = () => readKey(SHOPS_KEY);

export const writeShops = (deals) =>
  writeKey(SHOPS_KEY, { timestamp: Date.now(), deals }, SHOPS_TTL_SECONDS);

// ── Nutzerdaten ─────────────────────────────────────────────────────────────

export const DEFAULT_PLZ = process.env.DEFAULT_PLZ || "48155";

const userKey = (userId) => `user:${userId}:angebote`;

// tankalarm gehoert ins selbe Profil wie die Watchlist: es sind dieselben
// Geraete, derselbe Nutzer, und der taegliche Lauf liest das Profil ohnehin.
// Ein zweiter Schluessel waere ein zweiter Ort zum Pflegen ohne Gegenwert.
function emptyProfile() {
  return {
    plz: DEFAULT_PLZ,
    entries: [],
    subscriptions: [],
    pushed: [],
    tracked: {},
    tankalarm: null,
    rezepte: [],
  };
}

export async function readProfile(userId) {
  const stored = await readKey(userKey(userId));
  return { ...emptyProfile(), ...(stored || {}) };
}

export async function writeProfile(userId, profile) {
  const ok = await writeKey(userKey(userId), profile);
  if (ok) await rememberUser(userId);
  return ok;
}

async function rememberUser(userId) {
  try {
    await getRedis().sadd("angebote:users", userId);
  } catch (err) {
    console.error("[store] nutzerindex:", err.message);
  }
}

/** Alle Nutzer, die den Angebotstracker benutzen - Grundlage fuer den Cron. */
export async function listUsers() {
  try {
    const users = await getRedis().smembers("angebote:users");
    return Array.isArray(users) ? users : [];
  } catch (err) {
    console.error("[store] nutzerliste:", err.message);
    return [];
  }
}
