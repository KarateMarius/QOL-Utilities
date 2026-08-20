import { IconMinus, IconPlus } from "../../../../icons.jsx";

// Zoomen ohne Rad, als Auflage auf der Zeichenflaeche.
//
// Sie liegt bewusst auf der Flaeche und nicht in der Werkzeugleiste: auf dem
// Handy ist die Leiste ein Streifen am oberen Rand, den man wegscrollt,
// sobald man zeichnet - eine Bedienung, die dort verschwindet, gibt es fuer
// den Daumen nicht. Auf der Flaeche ist sie immer am selben Ort.
//
// Unten rechts, weil dort die Massstabsleiste nicht steht (die sitzt unten
// links) und die Hand beim Zeichnen seltener hinkommt.

export default function ZoomBedienung({ zoom, onKleiner, onGroesser, onEinpassen, einpassenAus }) {
  return (
    <div className="zoom-bedienung">
      <button type="button" onClick={onKleiner} aria-label="Verkleinern" title="Verkleinern (−)">
        <IconMinus />
      </button>
      <span className="zoom-bedienung__wert">{Math.round(zoom * 100)} %</span>
      <button type="button" onClick={onGroesser} aria-label="Vergrößern" title="Vergrößern (+)">
        <IconPlus />
      </button>
      <button
        type="button"
        className="zoom-bedienung__einpassen"
        onClick={onEinpassen}
        disabled={einpassenAus}
        title="Ansicht einpassen (0)"
      >
        Einpassen
      </button>
    </div>
  );
}
