import { cmToPx, pxToCm, formatMeters } from "../../geometry/units.js";
import { distance, midpoint } from "../../geometry/geometry.js";

function perpendicularOffset(wall, pxPerCm, px = 18) {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const len = Math.hypot(dx, dy) || 1;
  const offsetCm = pxToCm(px, pxPerCm);
  return { x: (-dy / len) * offsetCm, y: (dx / len) * offsetCm };
}

function DimensionLine({ start, end, pxPerCm }) {
  const offset = perpendicularOffset({ start, end }, pxPerCm);
  const a = { x: start.x + offset.x, y: start.y + offset.y };
  const b = { x: end.x + offset.x, y: end.y + offset.y };
  const mid = midpoint(a, b);
  const lengthCm = distance(start, end);

  return (
    <g className="dimension-line">
      <line x1={cmToPx(a.x, pxPerCm)} y1={cmToPx(a.y, pxPerCm)} x2={cmToPx(b.x, pxPerCm)} y2={cmToPx(b.y, pxPerCm)} />
      <text x={cmToPx(mid.x, pxPerCm)} y={cmToPx(mid.y, pxPerCm) - 4} textAnchor="middle">
        {formatMeters(lengthCm)}
      </text>
    </g>
  );
}

// Live wall length while drawing, plus (when toggled on) a static dimension
// line for every finished wall — matches the spec's "live length while
// drawing, finished walls optionally labeled" requirement.
export default function DimensionLayer({ walls, previewWall, pxPerCm, showAll }) {
  return (
    <g className="dimension-layer" style={{ pointerEvents: "none" }}>
      {showAll && walls.map((wall) => <DimensionLine key={wall.id} start={wall.start} end={wall.end} pxPerCm={pxPerCm} />)}
      {previewWall && <DimensionLine start={previewWall.start} end={previewWall.end} pxPerCm={pxPerCm} />}
    </g>
  );
}
