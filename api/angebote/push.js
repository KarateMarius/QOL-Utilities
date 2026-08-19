// Web-Push-Geraete und Versand.
//
// GET  -> { configured, public_key, subscriptions }
// POST -> { action: "subscribe" | "unsubscribe" | "test" | "cart", ... }
//
// Beides nur mit Anmeldung: Geraete haengen am Nutzer.
import { requireUser } from "../_auth.js";
import { readProfile, writeProfile } from "./_store.js";
import { endpointOf, isConfigured, publicKey, sendToAll } from "./_push.js";

const MAX_DEVICES = 10;

function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body || {};
}

function cartMessage(items) {
  const total = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);

  const byMerchant = new Map();
  for (const item of items) {
    const merchant = String(item.merchant || "Sonstige");
    const list = byMerchant.get(merchant) || [];
    list.push(String(item.name || "").trim());
    byMerchant.set(merchant, list);
  }

  let body = [...byMerchant]
    .sort((a, b) => a[0].localeCompare(b[0], "de"))
    .map(([merchant, names]) => `${merchant}: ${names.join(", ")}`)
    .join("\n");
  if (body.length > 600) body = `${body.slice(0, 597)}...`;

  return {
    title: `Einkaufskorb — ${items.length} Artikel, ${total.toFixed(2).replace(".", ",")} €`,
    body,
    tag: "cart",
  };
}

export default async function handler(req, res) {
  const userId = await requireUser(req, res);
  if (!userId) return undefined;

  if (req.method === "GET") {
    const profile = await readProfile(userId);
    return res.status(200).json({
      configured: isConfigured(),
      public_key: publicKey(),
      subscriptions: profile.subscriptions.length,
    });
  }

  if (req.method !== "POST") return res.status(405).end();

  const body = parseBody(req);
  if (!body) return res.status(400).json({ error: "Ungültige Anfrage" });

  const profile = await readProfile(userId);
  const action = String(body.action || "");

  if (action === "subscribe") {
    const subscription = body.subscription;
    if (!endpointOf(subscription)) {
      return res.status(400).json({ error: "Anmeldung ohne endpoint" });
    }
    const others = profile.subscriptions.filter(
      (s) => endpointOf(s) !== endpointOf(subscription)
    );
    const subscriptions = [...others, subscription].slice(-MAX_DEVICES);
    await writeProfile(userId, { ...profile, subscriptions });
    return res.status(200).json({ status: "ok", subscriptions: subscriptions.length });
  }

  if (action === "unsubscribe") {
    const subscriptions = profile.subscriptions.filter((s) => endpointOf(s) !== body.endpoint);
    await writeProfile(userId, { ...profile, subscriptions });
    return res.status(200).json({ status: "ok", subscriptions: subscriptions.length });
  }

  if (action === "test" || action === "cart") {
    const payload =
      action === "test"
        ? { title: "QOL-Utilities", body: "Test-Benachrichtigung — Push funktioniert.", tag: "test" }
        : cartMessage(Array.isArray(body.items) ? body.items : []);

    if (action === "cart" && !body.items?.length) {
      return res.status(400).json({ error: "Einkaufskorb ist leer" });
    }

    const result = await sendToAll(profile.subscriptions, payload);
    if (result.subscriptions.length !== profile.subscriptions.length) {
      await writeProfile(userId, { ...profile, subscriptions: result.subscriptions });
    }
    return res.status(200).json({ sent: result.sent, failed: result.failed, error: result.error });
  }

  return res.status(400).json({ error: "Unbekannte Aktion" });
}
