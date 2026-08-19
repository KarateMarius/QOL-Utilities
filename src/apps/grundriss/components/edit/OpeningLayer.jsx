import { cmToPx } from "../../geometry/units.js";

function wallVector(wall) {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const length = Math.hypot(dx, dy) || 1;
  return { dir: { x: dx / length, y: dy / length }, length };
}

function pointAtOffset(wall, offsetCm, dir) {
  return { x: wall.start.x + dir.x * offsetCm, y: wall.start.y + dir.y * offsetCm };
}

// Simple 2D plan symbols (no 3D, per spec): a gap "erases" the wall line
// across the opening, then a door gets a leaf line + quarter-circle swing
// arc, a window gets a centerline with two short jamb ticks.
function OpeningSymbol({ wall, opening, pxPerCm }) {
  const { dir, length } = wallVector(wall);
  const perp = { x: -dir.y, y: dir.x };
  const swingSign = opening.swing === "right" ? -1 : 1;

  const halfWidth = opening.widthCm / 2;
  const edgeA = pointAtOffset(wall, Math.max(0, opening.offsetCm - halfWidth), dir);
  const edgeB = pointAtOffset(wall, Math.min(length, opening.offsetCm + halfWidth), dir);

  const toPx = (p) => `${cmToPx(p.x, pxPerCm)},${cmToPx(p.y, pxPerCm)}`;

  const gap = (
    <line
      x1={cmToPx(edgeA.x, pxPerCm)}
      y1={cmToPx(edgeA.y, pxPerCm)}
      x2={cmToPx(edgeB.x, pxPerCm)}
      y2={cmToPx(edgeB.y, pxPerCm)}
      className="opening-gap"
      strokeWidth={cmToPx(wall.thicknessCm + 2, pxPerCm)}
    />
  );

  if (opening.type === "door") {
    const hinge = edgeA;
    const farEdge = edgeB;
    const width = opening.widthCm;
    const leafTip = {
      x: hinge.x + perp.x * swingSign * width,
      y: hinge.y + perp.y * swingSign * width,
    };
    const widthPx = cmToPx(width, pxPerCm);
    const sweepFlag = swingSign === 1 ? 1 : 0;
    return (
      <g className="opening opening--door">
        {gap}
        <path
          d={`M ${toPx(hinge)} L ${toPx(leafTip)} A ${widthPx} ${widthPx} 0 0 ${sweepFlag} ${toPx(farEdge)}`}
          className="opening-door-path"
        />
      </g>
    );
  }

  // window
  const jamb = perp;
  const jambLenPx = cmToPx(wall.thicknessCm / 2, pxPerCm);
  return (
    <g className="opening opening--window">
      {gap}
      <line
        x1={cmToPx(edgeA.x, pxPerCm)}
        y1={cmToPx(edgeA.y, pxPerCm)}
        x2={cmToPx(edgeB.x, pxPerCm)}
        y2={cmToPx(edgeB.y, pxPerCm)}
        className="opening-window-line"
      />
      {[edgeA, edgeB].map((p, i) => (
        <line
          key={i}
          x1={cmToPx(p.x, pxPerCm) - jamb.x * jambLenPx}
          y1={cmToPx(p.y, pxPerCm) - jamb.y * jambLenPx}
          x2={cmToPx(p.x, pxPerCm) + jamb.x * jambLenPx}
          y2={cmToPx(p.y, pxPerCm) + jamb.y * jambLenPx}
          className="opening-window-jamb"
        />
      ))}
    </g>
  );
}

export default function OpeningLayer({ openings, walls, pxPerCm }) {
  return (
    <g className="opening-layer" style={{ pointerEvents: "none" }}>
      {openings.map((opening) => {
        const wall = walls.find((w) => w.id === opening.wallId);
        if (!wall) return null;
        return <OpeningSymbol key={opening.id} wall={wall} opening={opening} pxPerCm={pxPerCm} />;
      })}
    </g>
  );
}
