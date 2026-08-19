import { useCallback, useEffect, useState } from "react";

// Der Einkaufskorb liegt bewusst nur lokal im Browser: er ist eine
// Arbeitsnotiz fuer den naechsten Einkauf, kein Datenbestand. So funktioniert
// er auch ohne Anmeldung.
const STORAGE_KEY = "angebote_cart_v1";

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useCart() {
  const [items, setItems] = useState(read);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const toggle = useCallback((deal) => {
    setItems((current) =>
      current.some((item) => item.id === deal.id)
        ? current.filter((item) => item.id !== deal.id)
        : [...current, deal]
    );
  }, []);

  const remove = useCallback((id) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  return { items, toggle, remove, clear, total: items.reduce((sum, i) => sum + (i.price || 0), 0) };
}
