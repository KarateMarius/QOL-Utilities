// Wer zuletzt angemeldet war - der Name, nicht der Nachweis.
//
// Der Nachweis ist das HttpOnly-Cookie, das der Browser mitschickt und das
// JavaScript nie zu sehen bekommt. Hier steht nur, unter welchem Namen die
// Oberflaeche schon einmal starten darf, waehrend /api/me im Hintergrund
// nachprueft.
//
// Der Name hat aber noch eine zweite Aufgabe, und deshalb steht er in einer
// eigenen Datei statt im Anmeldehaken: die Apps legen sich Sachen im Browser
// zurecht, damit sie schnell starten, und diese Sachen gehoeren jemandem.
// Wer sie ablegt, haengt den Namen an den Schluessel - dann liegen die Zeiten
// zweier Nutzer nebeneinander statt uebereinander, und keiner muss die des
// anderen wegraeumen, damit nichts durcheinandergeraet.
const SCHLUESSEL = "qol:angemeldet";

export function erinnerterNutzer() {
  try {
    return localStorage.getItem(SCHLUESSEL);
  } catch {
    return null;
  }
}

/** id = null vergisst die Anmeldung - nicht das, was die Apps abgelegt haben. */
export function merkeNutzer(id) {
  try {
    if (id) localStorage.setItem(SCHLUESSEL, id);
    else localStorage.removeItem(SCHLUESSEL);
  } catch {
    /* privater Modus: dann eben ohne Gedaechtnis */
  }
}
