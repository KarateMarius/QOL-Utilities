import { cmToPx, pxToCm, formatMeters } from "../../geometry/units.js";
import { distance, midpoint } from "../../geometry/geometry.js";

function perpendicularOffset(start, end, pxPerCm, px = 18) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  const offsetCm = pxToCm(px, pxPerCm);
  return { x: (-dy / len) * offsetCm, y: (dx / len) * offsetCm };
}

// Read-only wall dimension lines for view mode. Kept as its own small
// component (rather than shared with edit mode's DimensionLayer) since view
// mode never needs the live in-progress-drawing preview segment.
export default function ViewDimensions({ walls, pxPerCm }) {
  return (
    <g className="dimension-layer">
      {walls.map((wall) => {
        const offset = perpendicularOffset(wall.start, wall.end, pxPerCm);
        const a = { x: wall.start.x + offset.x, y: wall.start.y + offset.y };
        const b = { x: wall.end.x + offset.x, y: wall.end.y + offset.y };
        const mid = midpoint(a, b);
        return (
          <g key={wall.id} className="dimension-line">
            <line x1={cmToPx(a.x, pxPerCm)} y1={cmToPx(a.y, pxPerCm)} x2={cmToPx(b.x, pxPerCm)} y2={cmToPx(b.y, pxPerCm)} />
            <text x={cmToPx(mid.x, pxPerCm)} y={cmToPx(mid.y, pxPerCm) - 4} textAnchor="middle">
              {formatMeters(distance(wall.start, wall.end))}
            </text>
          </g>
        );
      })}
    </g>
  );
}
