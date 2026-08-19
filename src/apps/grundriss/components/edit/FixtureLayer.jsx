import { cmToPx } from "../../geometry/units.js";
import { pointOnWall } from "../../geometry/geometry.js";

const R = 9; // Radius in Bildschirm-Pixeln

// Bewusst feste Pixelgroessen statt cm: die Symbole sollen bei jedem
// Zoomgrad gleich gross und lesbar bleiben - genau wie die Raumnamen. Ein
// massstaeblich mitskaliertes Symbol waere auf dem Handy (Zoom < 0.1)
// unsichtbar.
function symbolFor(type) {
  switch (type) {
    // Steckdose: Kreis mit zwei Kontaktloechern, wie frontal gesehen.
    case "socket":
      return (
        <>
          <circle r={R} className="fixture__body" />
          <circle cx={-3.2} cy={0} r={1.5} className="fixture__mark" />
          <circle cx={3.2} cy={0} r={1.5} className="fixture__mark" />
        </>
      );
    // Lichtschalter: Kreis mit Kipphebel.
    case "switch":
      return (
        <>
          <circle r={R} className="fixture__body" />
          <line x1={-4} y1={4} x2={4} y2={-4} className="fixture__stroke" />
          <circle cx={4} cy={-4} r={1.8} className="fixture__mark" />
        </>
      );
    // Wasseranschluss: Kreis mit Tropfen.
    case "water":
      return (
        <>
          <circle r={R} className="fixture__body" />
          <path d="M 0 -5 C 3.4 -1 4 0.6 4 2 A 4 4 0 0 1 -4 2 C -4 0.6 -3.4 -1 0 -5 Z" className="fixture__mark" />
        </>
      );
    // Fussbodenheizung: Kreis mit Waermewellen.
    case "heating":
      return (
        <>
          <circle r={R} className="fixture__body" />
          <path d="M -4.5 2.5 q 2.25 -2.5 4.5 0 t 4.5 0" className="fixture__stroke" />
          <path d="M -4.5 -1 q 2.25 -2.5 4.5 0 t 4.5 0" className="fixture__stroke" />
        </>
      );
    default:
      return <circle r={R} className="fixture__body" />;
  }
}

export default function FixtureLayer({ fixtures, walls, pxPerCm }) {
  if (!fixtures || fixtures.length === 0) return null;

  return (
    <g className="fixture-layer" style={{ pointerEvents: "none" }}>
      {fixtures.map((fixture) => {
        const wall = walls.find((w) => w.id === fixture.wallId);
        if (!wall) return null; // verwaist (sollte durch die Loeschkaskade nicht vorkommen)
        const p = pointOnWall(wall, fixture.offsetCm);
        return (
          <g
            key={fixture.id}
            className={`fixture fixture--${fixture.type}`}
            transform={`translate(${cmToPx(p.x, pxPerCm)} ${cmToPx(p.y, pxPerCm)})`}
          >
            {symbolFor(fixture.type)}
          </g>
        );
      })}
    </g>
  );
}
