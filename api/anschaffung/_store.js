// Ablage fuer die Anschaffungen.
//
// Zwei Dinge, die nichts miteinander zu tun haben:
//
//   anschaffung:{nutzer}     die Posten - was fehlt, was es kosten darf, was
//                            man dafuer schon gesehen hat. Das ist der Kern
//                            und haengt an keinem fremden Server.
//
//   anschaffung:deals:{plz}  die Prospekte der Moebel- und Technikhaeuser.
//                            24 Stunden, nicht 6 wie beim Wocheneinkauf: ein
//                            Moebelprospekt laeuft wochenlang, und wer eine
//                            Kueche sucht, braucht sie nicht stuendlich neu.
//
// Getrennt von angebote:deals:{plz} und ausdruecklich nicht im taeglichen
// Lauf. Der Wocheneinkauf soll nicht voller Sofas sein, und ein Prospekt, der
// sich alle paar Wochen aendert, gehoert nicht in einen Cron.
//
// Der Zugang kommt aus api/_kv.js und nicht aus dem Ordner der Angebote: er
// ist Handwerkszeug und gehoert keiner der beiden Apps.
import { readKey, writeKey } from "../_kv.js";

export const ANGEBOTE_TTL_SECONDS = 24 * 3600;

const postenKey = (nutzer) => `anschaffung:${nutzer}`;
const angeboteKey = (plz) => `anschaffung:deals:${plz}`;

export async function liesPosten(nutzer) {
  const gelesen = await readKey(postenKey(nutzer));
  return Array.isArray(gelesen) ? gelesen : [];
}

export async function schreibPosten(nutzer, posten) {
  await writeKey(postenKey(nutzer), posten);
}

export const liesAngebote = (plz) => readKey(angeboteKey(plz));

export const schreibAngebote = (plz, angebote) =>
  writeKey(angeboteKey(plz), { timestamp: Date.now(), angebote }, ANGEBOTE_TTL_SECONDS);
