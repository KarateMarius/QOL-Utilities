import { useEffect, useMemo } from "react";

// Wie viele Angebote diese Woche im Prospekt stehen - und wie viele es in der
// Woche davor waren.
//
// Rueckwirkend gibt es die Zahl nirgends: der Server haelt nur den aktuellen
// Prospekt. Sie entsteht deshalb hier, Woche fuer Woche, waehrend die App
// benutzt wird. Was folgt daraus, und beides ist Absicht:
//
// 1. In der ersten Woche gibt es keinen Vergleich. Die App zeigt dann auch
//    keinen, statt eine Null zu behaupten.
// 2. Verglichen wird mit der zuletzt *gesehenen* Woche, nicht stur mit
//    KW minus eins. Wer zwei Wochen nicht hereinschaut, bekommt den Vergleich
//    zu der Woche, die er zuletzt gesehen hat - und die Oberflaeche nennt
//    deren Nummer, damit die Zahl nicht in der Luft haengt.
//
// Je Postleitzahl getrennt: ein anderer Ort hat andere Prospekte, die Zahlen
// waeren nicht vergleichbar.

const KEY = "angebote_wochen_v1";
// Ein gutes halbes Jahr Ruecklage je Ort reicht; mehr liest ohnehin niemand.
const MAX_WOCHEN = 26;

function lesen() {
  try {
    const gelesen = JSON.parse(localStorage.getItem(KEY) || "null");
    return gelesen && typeof gelesen === "object" ? gelesen : {};
  } catch {
    return {};
  }
}

function schreiben(daten) {
  try {
    localStorage.setItem(KEY, JSON.stringify(daten));
  } catch {
    // Voller Speicher kostet hoechstens den Vergleich.
  }
}

/**
 * @param plz     Ort, zu dem die Zahl gehoert
 * @param kw      Kalenderwoche des Prospekts, oder null solange unbekannt
 * @param jahr    Jahr zur Kalenderwoche
 * @param anzahl  Angebote in dieser Woche
 */
export function useWochenzahl(plz, kw, jahr, anzahl) {
  // Schreiben erst, wenn wirklich Daten da sind. Ein leerer Prospekt waere
  // sonst als "diese Woche 0 Angebote" in der Ruecklage gelandet und haette
  // den Vergleich der Folgewoche verdorben.
  useEffect(() => {
    if (!plz || !kw || !anzahl) return;
    const daten = lesen();
    const wochen = Array.isArray(daten[plz]) ? daten[plz] : [];
    const marke = `${jahr}-${String(kw).padStart(2, "0")}`;

    const ohneDiese = wochen.filter((w) => w.woche !== marke);
    const naechste = [...ohneDiese, { woche: marke, anzahl }]
      .sort((a, b) => a.woche.localeCompare(b.woche))
      .slice(-MAX_WOCHEN);

    schreiben({ ...daten, [plz]: naechste });
  }, [plz, kw, jahr, anzahl]);

  // Fuer den Vergleich zaehlt der Stand *vor* dieser Woche.
  return useMemo(() => {
    if (!plz || !kw || !anzahl) return null;
    const wochen = lesen()[plz];
    if (!Array.isArray(wochen)) return null;

    const marke = `${jahr}-${String(kw).padStart(2, "0")}`;
    const frueher = wochen.filter((w) => w.woche < marke);
    if (!frueher.length) return null;

    const vorige = frueher[frueher.length - 1];
    return {
      differenz: anzahl - vorige.anzahl,
      vergleichsWoche: Number(vorige.woche.slice(-2)),
      vergleichsAnzahl: vorige.anzahl,
    };
  }, [plz, kw, jahr, anzahl]);
}
