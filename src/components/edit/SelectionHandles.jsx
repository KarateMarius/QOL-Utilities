import { cmToPx } from "../../geometry/units.js";

const HANDLE_RADIUS_PX = 7;

// Purely visual — the actual drag hit-testing/move logic lives in
// usePointerDrawing (tolerance-based distance check against the wall's own
// endpoints), so these circles never need their own pointer handlers.
export default function SelectionHandles({ wall, draggingHandle, pxPerCm }) {
  if (!wall) return null;

  const points = {
    start: draggingHandle?.endpoint === "start" ? draggingHandle.point : wall.start,
    end: draggingHandle?.endpoint === "end" ? draggingHandle.point : wall.end,
  };

  return (
    <g className="selection-handles" style={{ pointerEvents: "none" }}>
      {Object.values(points).map((p, i) => (
        <circle key={i} cx={cmToPx(p.x, pxPerCm)} cy={cmToPx(p.y, pxPerCm)} r={HANDLE_RADIUS_PX} className="selection-handle" />
      ))}
    </g>
  );
}
