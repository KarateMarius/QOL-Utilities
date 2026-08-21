// Vorlauf: die Anfrage laeuft schon, bevor React steht.
//
// Der Weg zum Stempeln fuehrte bisher durch drei Wartezeiten hintereinander:
// erst /api/me, damit der Rahmen weiss, ob er ueberhaupt etwas zeigen darf,
// dann das nachgeladene App-Buendel, und erst danach ging die eigentliche
// Buchung raus. Am Handy sind das drei Handschlaege, von denen nur der letzte
// mit Arbeitszeit zu tun hat - und jeder davon wartet auf den davor.
//
// Diese Datei schickt den letzten zuerst los. Sie laeuft beim Start, also
// bevor React das erste Mal rendert, und legt die laufende Anfrage hier ab.
// ArbeitszeitApp findet sie beim Aufwachen vor und wartet nur noch auf die
// Antwort, statt sie erst loszuschicken.
//
// Die Antwort wird bewusst nicht ausgewertet - das gehoert der App. Hier
// wird nur dafuer gesorgt, dass ein Fehlschlag niemand aus dem Nichts
// anspringt, solange die App noch gar nicht da ist.

import { erinnerterNutzer } from "../../shell/angemeldet.js";

let laufend = null;

/** Ein Ergebnis, das nie wirft: { status, inhalt }. status 0 heisst: kein Netz.
    Auch die App fragt hierueber - so steht nur an einer Stelle, wie eine
    Antwort dieses Endpunkts aussieht. */
export function anfragen(stempeln, monat) {
  const pfad = "/api/arbeitszeit" + (monat ? `?monat=${monat}` : "");
  return fetch(pfad, stempeln ? { method: "POST" } : undefined)
    .then(async (res) => ({
      status: res.status,
      inhalt: res.status === 401 ? null : await res.json().catch(() => null),
    }))
    .catch(() => ({ status: 0, inhalt: null }));
}

export function starteVorlauf() {
  if (laufend) return;

  // Das Sprungziel im Manifest oeffnet /?stempeln=1#arbeitszeit. Die Adresse
  // wird sofort bereinigt, damit ein Neuladen oder ein Lesezeichen nicht ein
  // zweites Mal stempelt; dass dieses Modul nur einmal ausgewertet wird,
  // schuetzt zusaetzlich vor der doppelt ausgefuehrten Wirkung in React.
  const stempeln = new URLSearchParams(window.location.search).get("stempeln") === "1";
  if (stempeln) {
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  }

  laufend = { stempeln, ergebnis: anfragen(stempeln) };
}

/** Der Vorlauf gilt nur fuer den Start - wer ihn nimmt, nimmt ihn ganz. */
export function nimmVorlauf() {
  const vorlauf = laufend;
  laufend = null;
  return vorlauf;
}

// ── Der zuletzt gesehene Stand ────────────────────────────────────────
//
// Er liegt im Browser, damit der Knopf sofort dasteht und nicht erst, wenn
// der Server geantwortet hat. Das ist derselbe Handgriff wie beim Prospekt
// in useDeals.js, nur viel kleiner: ein Monat sind wenige hundert Bytes.
//
// Er ist ausdruecklich nicht die Wahrheit - die steht am Server. Die
// laufende Zeit rechnet der Knopf ohnehin selbst aus dem Beginn aus, also
// altert die Anzeige nicht, sie kann nur von einem anderen Geraet ueberholt
// worden sein. Deshalb wird die Anfrage trotzdem gestellt, jedes Mal, und
// der Stand ueberschrieben, sobald die Antwort da ist.
//
// Auf welche Seite man sich beim Antippen verlassen kann: gar keine. Was
// gebucht wird, entscheidet der Server - er sieht nach, ob ein Eintrag offen
// ist, und dreht ihn um. Ein Knopf, der noch den alten Stand zeigt, bucht
// also nicht falsch; er beschriftet sich nur einen Wimpernschlag lang falsch.
//
// Je Nutzer ein Schluessel. Zeiten sind niemandes Allgemeingut, und wer sich
// abmeldet, soll sie trotzdem behalten: beim naechsten Mal steht sein Stand
// wieder da, und der des anderen liegt daneben, nicht darueber. Geloescht
// wird hier nichts - ein Monat sind wenige hundert Bytes, und der Server
// bleibt ohnehin die Wahrheit.
//
// Gelesen und geschrieben wird unter zwei verschiedenen Namen, und das ist
// Absicht:
//
//   Gelesen wird unter dem Namen, unter dem der Browser zuletzt gestartet
//   ist. Der ist eine Annahme - dieselbe, mit der auch der Rahmen startet -,
//   und sie ist der Preis dafuer, dass ueberhaupt schon etwas dasteht.
//
//   Geschrieben wird unter dem Namen, den der Server in die Antwort
//   geschrieben hat. Der ist keine Annahme. Damit kann eine falsche Annahme
//   hoechstens einen Wimpernschlag lang das Falsche zeigen - sie kann aber
//   niemandem seinen Stand mit fremden Zeiten ueberschreiben, und genau das
//   waere das Schlimme, weil hier nichts mehr aufgeraeumt wird.

const SPEICHER = "arbeitszeit_stand_v1";

export function liesStand() {
  const nutzer = erinnerterNutzer();
  if (!nutzer) return null;
  try {
    const stand = JSON.parse(localStorage.getItem(`${SPEICHER}:${nutzer}`) || "null");
    return stand && Array.isArray(stand.eintraege) ? stand : null;
  } catch {
    return null;
  }
}

export function merkeStand(inhalt) {
  // Ohne Absender wird nicht abgelegt. Lieber kein Stand als einer im
  // falschen Fach.
  if (!inhalt?.nutzer) return;
  try {
    // nutzer steht im Schluessel und muss nicht noch einmal daneben; gebucht
    // und zeit gehoeren zur einzelnen Buchung und nicht zum Stand - sonst
    // begruesste die App beim naechsten Start mit einem "Feierabend um 17:03"
    // von vorgestern.
    const { nutzer, gebucht, zeit, ...stand } = inhalt;
    localStorage.setItem(`${SPEICHER}:${nutzer}`, JSON.stringify(stand));
  } catch {
    // Voller oder gesperrter Speicher kostet nur den schnellen Start.
  }
}
