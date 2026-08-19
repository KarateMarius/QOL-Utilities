import { useCallback, useState } from "react";

// Zaehlt mit, was wiederholt im Korb gelandet ist. Daraus entstehen die
// Vorschlaege fuer die Watchlist: was jemand dreimal eingekauft hat, will er
// vermutlich auch gemeldet bekommen, wenn es das naechste Mal im Prospekt
// steht.
//
// Bewusst nur lokal im Browser, wie der Korb selbst. Es ist eine Beobachtung
// des eigenen Verhaltens, kein Datenbestand - und auf dem Server waere es ein
// weiterer Schluessel, den jemand pflegen muesste.
//
// Gezaehlt wird nach deal.key (Haendler plus normalisierter Name, siehe
// README), nicht nach der Angebots-ID: die vergeben die Prospekte jede Woche
// neu, ueber sie waere nichts wiederzuerkennen.

const KEY = "angebote_oft_v1";
// Mehr Eintraege braucht niemand, und der Speicher des Browsers ist knapp.
const MAX_EINTRAEGE = 200;

function lesen() {
  try {
    const gelesen = JSON.parse(localStorage.getItem(KEY) || "null");
    return gelesen && typeof gelesen === "object" ? gelesen : {};
  } catch {
    return {};
  }
}

/** Aus "rewe|hähnchenbrustfilet" wird "hähnchenbrustfilet". */
export function wortAusKey(key) {
  const teile = String(key || "").split("|");
  return teile.length > 1 ? teile.slice(1).join("|") : "";
}

export function useOftGekauft() {
  const [zaehler, setZaehler] = useState(lesen);

  const merken = useCallback((deal) => {
    if (!deal?.key) return;
    setZaehler((current) => {
      const vorher = current[deal.key];
      const naechster = {
        ...current,
        [deal.key]: {
          anzahl: (vorher?.anzahl ?? 0) + 1,
          titel: deal.title || vorher?.titel || "",
          zuletzt: Date.now(),
        },
      };

      // Aeltestes fliegt raus, wenn es zu viel wird.
      const schluessel = Object.keys(naechster);
      if (schluessel.length > MAX_EINTRAEGE) {
        schluessel
          .sort((a, b) => (naechster[a].zuletzt ?? 0) - (naechster[b].zuletzt ?? 0))
          .slice(0, schluessel.length - MAX_EINTRAEGE)
          .forEach((k) => delete naechster[k]);
      }

      try {
        localStorage.setItem(KEY, JSON.stringify(naechster));
      } catch {
        // Voller Speicher darf den Einkauf nicht aufhalten.
      }
      return naechster;
    });
  }, []);

  return { zaehler, merken };
}
