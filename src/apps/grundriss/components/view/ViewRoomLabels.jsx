import { cmToPx, formatAreaM2 } from "../../geometry/units.js";
import { polygonCentroid } from "../../geometry/geometry.js";

// Read-only room rendering: fill + name + area. No edit affordances (no
// input field) — view mode never dispatches into the floor-plan reducer.
// Text uses a fixed CSS font-size and this app never applies an SVG-native
// scale() transform (zoom is baked into pxPerCm for every coordinate
// instead, see useZoomPan), so labels are already a constant screen size at
// any zoom level without needing an extra counter-scale transform.
export default function ViewRoomLabels({ rooms, pxPerCm }) {
  return (
    <g className="room-layer">
      {rooms.map((room, index) => {
        const points = room.polygon.map((p) => `${cmToPx(p.x, pxPerCm)},${cmToPx(p.y, pxPerCm)}`).join(" ");
        const centroid = polygonCentroid(room.polygon);
        const cx = cmToPx(centroid.x, pxPerCm);
        const cy = cmToPx(centroid.y, pxPerCm);
        return (
          <g key={room.id}>
            <polygon points={points} className={`room-fill ${index % 2 === 0 ? "room-fill--a" : "room-fill--b"}`} />
            <text x={cx} y={cy - 2} textAnchor="middle" className="view-room-name">
              {room.name || "Unbenannt"}
            </text>
            <text x={cx} y={cy + 18} textAnchor="middle" className="view-room-area">
              {formatAreaM2(room.areaM2)}
            </text>
          </g>
        );
      })}
    </g>
  );
}
