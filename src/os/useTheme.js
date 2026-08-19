import { useEffect, useState } from "react";

// Helligkeit gilt fuer das ganze System, nicht je App: ein Fenster im
// Dunkelmodus neben einem hellen waere kein Betriebssystem, sondern ein Unfall.
// Die Apps lesen den Wert ueber [data-theme] am <html>-Element.

const STORAGE_KEY = "qol_theme";

function initial() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState(initial);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return { theme, toggle: () => setTheme((current) => (current === "dark" ? "light" : "dark")) };
}
