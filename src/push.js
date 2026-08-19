// Web-Push im Browser: Unterstuetzung pruefen, Service Worker anmelden,
// Geraet an- und abmelden.
//
// Liegt neben den Apps und nicht in einer davon: ein angemeldetes Geraet
// gehoert zum Konto, nicht zu den Angeboten - der Tankpreis-Alarm meldet an
// dieselben Geraete. Die Endpunkte dafuer liegen weiterhin unter
// /api/angebote/push, dort steht das Nutzerprofil.
import {
  NOT_AUTHENTICATED,
  fetchPushConfig,
  registerSubscription,
  removeSubscription,
} from "./apps/angebote/lib/api.js";

// Zustaende der Benachrichtigungen. Sie sind Absicht so kleinteilig: "geht
// nicht" hilft niemandem, "der Browser blockiert es" oder "du bist nicht
// angemeldet" schon.
//
//   unsupported  - Browser kann kein Web Push
//   insecure     - kein HTTPS, also kein Service Worker
//   unconfigured - auf dem Server fehlen die VAPID-Schluessel
//   anonymous    - nicht angemeldet, Geraete haengen aber am Konto
//   denied       - der Browser hat die Erlaubnis verweigert
//   off / on     - angemeldet, nur eben (noch) nicht eingeschaltet

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Push braucht einen sicheren Kontext - http:// im LAN reicht nicht. */
export function secureContext() {
  return window.isSecureContext;
}

function urlBase64ToUint8Array(base64) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export async function registerServiceWorker() {
  if (!pushSupported() || !secureContext()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (error) {
    console.error("Service Worker konnte nicht registriert werden", error);
    return null;
  }
}

export async function currentState() {
  if (!pushSupported()) return "unsupported";
  if (!secureContext()) return "insecure";

  const config = await fetchPushConfig().catch(() => null);
  if (config === NOT_AUTHENTICATED) return "anonymous";
  if (!config?.configured || !config.public_key) return "unconfigured";
  if (Notification.permission === "denied") return "denied";

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? "on" : "off";
}

export async function enablePush() {
  const config = await fetchPushConfig();
  if (config === NOT_AUTHENTICATED) return "anonymous";
  if (!config.configured || !config.public_key) return "unconfigured";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  const registration =
    (await navigator.serviceWorker.getRegistration()) ?? (await registerServiceWorker());
  if (!registration) return "unsupported";
  await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(config.public_key),
  });

  const result = await registerSubscription(subscription.toJSON());
  return result === NOT_AUTHENTICATED ? "anonymous" : "on";
}

export async function disablePush() {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await removeSubscription(subscription.endpoint).catch(() => undefined);
    await subscription.unsubscribe();
  }
  return "off";
}
