// Ein Satz gezeichneter Symbole fuer alle Apps.
//
// Vorher standen an diesen Stellen Schriftzeichen: ↻ ☰ ▦ ✕ ✓ ⌕. Die sehen auf
// jedem System anders aus - andere Strichstaerke, andere optische Groesse,
// andere Grundlinie -, weil sie aus der jeweils vorhandenen Systemschrift
// kommen und nicht aus der Schrift der Seite. Auf Windows ist ✕ fett und
// klein, auf macOS duenn und gross; ⌕ fehlt manchen Schriften ganz und wird
// durch ein Ersatzzeichen ausgetauscht.
//
// Alle Zeichnungen teilen sich Flaeche (20 × 20), Strichstaerke (1,6) und
// runde Enden - dieselben Werte, die der Rahmen fuer seine App-Zeichen nutzt.
// Die Farbe kommt immer von currentColor, die Groesse aus dem CSS der
// aufrufenden Stelle; hier steht keine feste Groesse.

const base = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
  focusable: "false",
};

/** Neu laden. Dreht sich, solange die Schaltflaeche gesperrt ist - siehe CSS. */
export function IconRefresh(props) {
  return (
    <svg {...base} {...props}>
      <path d="M17.07 12.5a7.5 7.5 0 1 1-1.77-7.8l3.87 3.63" />
      <path d="M19.17 3.33v5h-5" />
    </svg>
  );
}

/** Listenansicht. */
export function IconList(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" />
    </svg>
  );
}

/** Rasteransicht. */
export function IconGrid(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.3" y="3.3" width="5.9" height="5.9" rx="1.2" />
      <rect x="10.8" y="3.3" width="5.9" height="5.9" rx="1.2" />
      <rect x="3.3" y="10.8" width="5.9" height="5.9" rx="1.2" />
      <rect x="10.8" y="10.8" width="5.9" height="5.9" rx="1.2" />
    </svg>
  );
}

/** Suchen. */
export function IconSearch(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="9" r="5.4" />
      <path d="M13 13l4 4" />
    </svg>
  );
}

/** Schliessen, entfernen. */
export function IconClose(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
    </svg>
  );
}

/** Haken: ausgewaehlt, eingesammelt. */
export function IconCheck(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 10.4l3.8 3.8 7.2-8" />
    </svg>
  );
}

/** Vergroessern. */
export function IconPlus(props) {
  return (
    <svg {...base} {...props}>
      <path d="M10 4.5v11M4.5 10h11" />
    </svg>
  );
}

/** Verkleinern. */
export function IconMinus(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 10h11" />
    </svg>
  );
}

/** Fuehrt aus der Seite hinaus - in den Shop, auf die Karte. */
export function IconExternal(props) {
  return (
    <svg {...base} {...props}>
      <path d="M16.5 11.5v5h-13v-13h5" />
      <path d="M12.5 3.5h4v4M16.5 3.5L9.5 10.5" />
    </svg>
  );
}
