// Erzeugt ein VAPID-Schluesselpaar fuer Web Push.
//
//     node scripts/generate-vapid-keys.mjs
//
// Die Ausgabe kommt lokal in .env und bei Vercel unter Settings ->
// Environment Variables. Fuer Produktion eigene Schluessel nehmen: wer den
// privaten Schluessel hat, kann Benachrichtigungen in deinem Namen schicken.
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
