// Web Push per VAPID.
//
// Die Geraete-Anmeldungen liegen im Nutzerprofil. Anmeldungen, die der
// Push-Dienst mit 404/410 abweist, sind endgueltig tot und werden entfernt -
// sonst waechst die Liste bei jedem neuen Geraet weiter an.
import webpush from "web-push";

let configured = false;

export function isConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function publicKey() {
  return process.env.VAPID_PUBLIC_KEY || "";
}

function ensureConfigured() {
  if (configured || !isConfigured()) return isConfigured();
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
  return true;
}

/**
 * Verschickt eine Nachricht an alle Geraete eines Nutzers.
 * Gibt { sent, failed, subscriptions } zurueck - subscriptions ist die um
 * tote Eintraege bereinigte Liste, die der Aufrufer speichern sollte.
 */
export async function sendToAll(subscriptions, payload) {
  if (!ensureConfigured()) {
    return { sent: 0, failed: 0, error: "VAPID-Schlüssel fehlen", subscriptions };
  }
  if (!subscriptions?.length) {
    return { sent: 0, failed: 0, error: "Kein Gerät angemeldet", subscriptions: [] };
  }

  const body = JSON.stringify(payload);
  const results = await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription, body, { TTL: 60 * 60 * 12 });
        return { alive: true, sent: true };
      } catch (err) {
        const status = err?.statusCode || 0;
        console.error(`[push] fehlgeschlagen (${status}):`, err?.body || err?.message);
        return { alive: status !== 404 && status !== 410, sent: false };
      }
    })
  );

  return {
    sent: results.filter((r) => r.sent).length,
    failed: results.filter((r) => !r.sent).length,
    subscriptions: subscriptions.filter((_, i) => results[i].alive),
  };
}

export function endpointOf(subscription) {
  return subscription?.endpoint || "";
}
