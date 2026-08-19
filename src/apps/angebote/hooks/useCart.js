import { useCallback, useEffect, useState } from "react";

// Der Einkaufskorb liegt bewusst nur lokal im Browser: er ist eine
// Arbeitsnotiz fuer den naechsten Einkauf, kein Datenbestand.
//
// Zum Korb gehoert, was im Laden schon im Wagen liegt. Das steht getrennt,
// damit ein geleerter Korb nicht die Haken einer alten Liste erbt.
const STORAGE_KEY = "angebote_cart_v1";
const DONE_KEY = "angebote_cart_done_v1";

function read(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function useCart() {
  const [items, setItems] = useState(() => {
    const gelesen = read(STORAGE_KEY, []);
    return Array.isArray(gelesen) ? gelesen : [];
  });

  // Abgehakte Artikel als Objekt statt Liste: das Nachschlagen beim Zeichnen
  // ist so ein Zugriff statt einer Suche durch den ganzen Korb.
  const [done, setDone] = useState(() => {
    const gelesen = read(DONE_KEY, {});
    return gelesen && typeof gelesen === "object" ? gelesen : {};
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(DONE_KEY, JSON.stringify(done));
  }, [done]);

  const toggle = useCallback((deal) => {
    setItems((current) =>
      current.some((item) => item.id === deal.id)
        ? current.filter((item) => item.id !== deal.id)
        : [...current, deal]
    );
    // Ein Artikel, der den Korb verlaesst, nimmt seinen Haken mit.
    setDone((current) => {
      if (!(deal.id in current)) return current;
      const next = { ...current };
      delete next[deal.id];
      return next;
    });
  }, []);

  /**
   * Eine selbst getippte Zeile - Milch, Klopapier, Batterien. Sie sieht aus
   * wie ein Angebot, damit der ganze Korb (Gruppieren, Abhaken, Kopieren,
   * Drucken, aufs Handy) unveraendert damit umgehen kann, hat aber keinen
   * Preis und keinen Haendler.
   *
   * merchant traegt bewusst einen Namen und bleibt nicht leer: der Korb
   * gruppiert danach, und eine Gruppe ohne Ueberschrift saehe aus wie ein
   * Fehler.
   */
  const addEigenes = useCallback((titel) => {
    const name = String(titel || "").trim();
    if (!name) return;
    setItems((current) => [
      ...current,
      {
        id: `eigen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: name,
        subtitle: "",
        merchant: "Eigene Liste",
        category: "sonstige",
        price: 0,
        old_price: 0,
        discount_pct: 0,
      },
    ]);
  }, []);

  const remove = useCallback((id) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setDone((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  /** Haken setzen oder loesen: "liegt schon im Wagen". */
  const toggleDone = useCallback((id) => {
    setDone((current) => {
      const next = { ...current };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setDone({});
  }, []);

  /** Alle Haken loesen, ohne den Korb zu leeren - fuer den naechsten Einkauf. */
  const resetDone = useCallback(() => setDone({}), []);

  const total = items.reduce((sum, item) => sum + (item.price || 0), 0);
  const openItems = items.filter((item) => !done[item.id]);
  const openTotal = openItems.reduce((sum, item) => sum + (item.price || 0), 0);

  return {
    items,
    done,
    toggle,
    addEigenes,
    toggleDone,
    remove,
    clear,
    resetDone,
    total,
    openTotal,
    openCount: openItems.length,
  };
}
