// Berliner Kalender, egal wo der Server steht.
//
// Der Server laeuft in UTC. Wer dort einen Tag oder Monat bildet, verschiebt
// alles zwischen Mitternacht und zwei Uhr um einen Tag nach hinten - eine
// Schicht, die um 01:00 im August anfaengt, faellt in den Juli, und ein
// Gedanke, den man um 00:30 aufschreibt, traegt das Datum von gestern.
//
// Steht hier und nicht in einer der Apps, weil inzwischen zwei danach fragen.
const ZEITZONE = "Europe/Berlin";

/** YYYY-MM-DD nach Berliner Kalender. */
export function berlinDatum(datum) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZEITZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(datum); // en-CA liefert 2026-08-21
}

/** YYYY-MM nach Berliner Kalender. */
export function berlinMonat(datum) {
  return berlinDatum(datum).slice(0, 7);
}
