import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Die Hauptschrift vorziehen.
//
// Ohne das erfaehrt der Browser erst von ihr, wenn er die CSS ausgewertet und
// den Text gesetzt hat - gemessen bei 150 ms Latenz startete Inter erst nach
// 1366 ms, obwohl die Verbindung seit 420 ms steht. Ein preload im Kopf der
// Seite laesst sie zusammen mit dem JavaScript loslaufen.
//
// Nur Inter und nur latin: das ist die Schrift, in der die Oberflaeche
// geschrieben ist. Outfit traegt die Ueberschriften und DM Mono die Zahlen,
// beide kommen spaeter und in kleineren Mengen vor; sie mitzuziehen wuerde
// dem JavaScript Bandbreite wegnehmen, ohne dass frueher etwas zu sehen
// waere. latin-ext bleibt draussen - es wird nur geholt, wenn tschechische
// Zeichen auf der Seite stehen.
function schriftVorziehen() {
  let name = null;
  return {
    name: "schrift-vorziehen",
    apply: "build",
    generateBundle(_optionen, bundle) {
      name = Object.keys(bundle).find((datei) => /inter-var-latin-(?!ext)[^/]*\.woff2$/.test(datei)) || null;
    },
    transformIndexHtml() {
      if (!name) return [];
      return [
        {
          tag: "link",
          attrs: { rel: "preload", as: "font", type: "font/woff2", href: "/" + name, crossorigin: "" },
          injectTo: "head",
        },
      ];
    },
  };
}

export default defineConfig({
  plugins: [react(), schriftVorziehen()],
});
