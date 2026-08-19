import { cmToPx } from "../../geometry/units.js";
import { FURNITURE_TYPES } from "../../utils/constants.js";

// Moebel als Rechteck mit Name und Mass. Mehr braucht die Frage nicht, fuer
// die es sie gibt: passt das Sofa an diese Wand?
//
// Sie liegen ueber Raeumen und Waenden, aber unter der Bemassung - ein
// Moebelstueck verdeckt keine Massangabe.

function beschriftung(moebel) {
  const name = FURNITURE_TYPES[moebel.type]?.label || "Möbel";
  return `${name} ${Math.round(moebel.widthCm)} × ${Math.round(moebel.depthCm)}`;
}

export default function FurnitureLayer({ furniture = [], selectedId, pxPerCm }) {
  return (
    <g className="furniture-layer">
      {furniture.map((moebel) => {
        const breite = cmToPx(moebel.widthCm, pxPerCm);
        const tiefe = cmToPx(moebel.depthCm, pxPerCm);
        const x = cmToPx(moebel.x, pxPerCm);
        const y = cmToPx(moebel.y, pxPerCm);
        const gedreht = `rotate(${moebel.rotationDeg || 0} ${x} ${y})`;

        return (
          <g key={moebel.id} transform={gedreht}>
            <rect
              x={x - breite / 2}
              y={y - tiefe / 2}
              width={breite}
              height={tiefe}
              className={`furniture${moebel.id === selectedId ? " furniture--selected" : ""}`}
            />
            {/* Erst ab einer gewissen Groesse beschriften - sonst steht der
                Text weit ueber dem Stueck und stiftet Verwirrung. */}
            {breite > 46 && tiefe > 18 && (
              <text x={x} y={y + 4} textAnchor="middle" className="furniture-label">
                {beschriftung(moebel)}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
