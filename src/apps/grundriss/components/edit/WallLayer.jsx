import { cmToPx } from "../../geometry/units.js";

// Pointer events are disabled on every rendered shape layer (walls,
// openings, rooms, dimensions) so hit-testing stays centralized in
// usePointerDrawing's own distance-based logic against plan data, instead
// of being split between DOM element targets and geometry math.
export default function WallLayer({ walls, selectedWallId, pxPerCm }) {
  return (
    <g className="wall-layer" style={{ pointerEvents: "none" }}>
      {walls.map((wall) => (
        <line
          key={wall.id}
          x1={cmToPx(wall.start.x, pxPerCm)}
          y1={cmToPx(wall.start.y, pxPerCm)}
          x2={cmToPx(wall.end.x, pxPerCm)}
          y2={cmToPx(wall.end.y, pxPerCm)}
          strokeWidth={cmToPx(wall.thicknessCm, pxPerCm)}
          strokeLinecap="square"
          className={wall.id === selectedWallId ? "wall wall--selected" : "wall"}
        />
      ))}
    </g>
  );
}
