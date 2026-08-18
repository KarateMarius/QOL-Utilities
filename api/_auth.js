// Gemeinsame Auth-Helfer. Dateien mit "_"-Praefix sind fuer Vercel keine
// HTTP-Endpunkte, sondern nur Module.
//
// Bewusst ESM (export/import), nicht CommonJS wie im Trainer-Projekt: dieses
// package.json hat "type": "module", damit waeren require/module.exports in
// einer .js-Datei ein Syntaxfehler.
//
// Diese App teilt sich die Upstash-Datenbank mit dem Trainer und liest
// dieselbe Nutzerliste (auth:users). Sie hat aber ein EIGENES Cookie mit
// eigenem Namen und eigenem SESSION_SECRET, weil sich Cookies zwischen
// zwei *.vercel.app-Domains ohnehin nicht teilen lassen (vercel.app steht
// auf der Public Suffix List).
import { Redis } from "@upstash/redis";
import bcrypt from "bcryptjs";

export const COOKIE_NAME = "gsess";
export const MAX_AGE_SECS = 60 * 60 * 24 * 30; // 30 Tage

export function getRedis() {
  return new Redis({
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
  });
}

async function hmacHex(message, secret) {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const buf = await globalThis.crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function makeCookieValue(userId) {
  const exp = Date.now() + MAX_AGE_SECS * 1000;
  const sig = await hmacHex(`${userId}.${exp}`, process.env.SESSION_SECRET || "");
  return `${userId}:${exp}:${sig}`;
}

export function sessionCookie(value) {
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE_SECS}; Path=/`;
}

export function clearedCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`;
}

// Liest den Cookie-Header, verifiziert HMAC + Ablauf, gibt die userId zurueck
// oder null.
export async function getUserId(cookieHeader) {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  if (!m) return null;
  const parts = decodeURIComponent(m[1]).split(":");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  const expNum = parseInt(exp, 10);
  if (!userId || !expNum || Date.now() > expNum) return null;
  const expected = await hmacHex(`${userId}.${exp}`, process.env.SESSION_SECRET || "");
  return timingSafeEqual(expected, sig) ? userId : null;
}

// Spiegelt die Logik aus Training-Apps/api/_users.js: bcrypt-Hashes beginnen
// mit "$2", alte Klartext-Passwoerter werden timing-sicher verglichen.
export async function verifyPassword(plain, stored) {
  if (typeof stored !== "string" || !stored || typeof plain !== "string") return false;
  if (stored.startsWith("$2")) {
    try {
      return await bcrypt.compare(plain, stored);
    } catch {
      return false;
    }
  }
  return timingSafeEqual(stored, plain);
}

// Upstash deserialisiert Werte automatisch. Nie JSON.parse auf einen bereits
// geparsten Wert anwenden - genau das hat im Trainer-Projekt HTTP 500er
// verursacht.
export function kvObject(v) {
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return p && typeof p === "object" ? p : null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function getAllUsers() {
  try {
    const users = await getRedis().get("auth:users");
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

// Antwortet mit 401, wenn keine gueltige Session vorliegt. Gibt sonst die
// userId zurueck.
export async function requireUser(req, res) {
  const userId = await getUserId(req.headers.cookie || "");
  if (!userId) {
    res.status(401).json({ error: "Nicht angemeldet" });
    return null;
  }
  return userId;
}
