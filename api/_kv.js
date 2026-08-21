// Lesen und Schreiben in Upstash, mit Kompression fuer grosse Werte.
//
// Stand frueher in angebote/_store.js. Dort war es richtig, solange nur die
// Angebote grosse Werte ablegten - inzwischen tun es die Anschaffungen auch,
// und eine App sollte fuer den Zugang zur Datenbank nicht in den Ordner einer
// anderen greifen muessen. Der Zugang ist Handwerkszeug, kein Angebot.
//
// Ein PLZ-Cache sind ~1,3 MB JSON und damit mehr, als eine Upstash-Anfrage im
// Gratis-Tarif transportiert. Groessere Werte werden deshalb gepackt abgelegt;
// kleine bleiben Klartext, damit man sie im Upstash-Browser lesen kann.
import { gzipSync, gunzipSync } from "node:zlib";
import { getRedis, kvObject } from "./_auth.js";

const COMPRESS_ABOVE_BYTES = 64 * 1024;
const GZIP_PREFIX = "gz:";

function pack(value) {
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json) < COMPRESS_ABOVE_BYTES) return value;
  return GZIP_PREFIX + gzipSync(json).toString("base64");
}

function unpack(raw) {
  if (typeof raw === "string" && raw.startsWith(GZIP_PREFIX)) {
    try {
      return JSON.parse(gunzipSync(Buffer.from(raw.slice(GZIP_PREFIX.length), "base64")));
    } catch (err) {
      console.error("[kv] entpacken fehlgeschlagen:", err.message);
      return null;
    }
  }
  return kvObject(raw) ?? raw ?? null;
}

export async function readKey(key, fallback = null) {
  try {
    const raw = await getRedis().get(key);
    if (raw === null || raw === undefined) return fallback;
    const value = unpack(raw);
    return value === null ? fallback : value;
  } catch (err) {
    console.error(`[kv] lesen ${key}:`, err.message);
    return fallback;
  }
}

export async function writeKey(key, value, ttlSeconds) {
  try {
    const payload = pack(value);
    const options = ttlSeconds ? { ex: ttlSeconds } : undefined;
    await getRedis().set(key, payload, options);
    return true;
  } catch (err) {
    console.error(`[kv] schreiben ${key}:`, err.message);
    return false;
  }
}
