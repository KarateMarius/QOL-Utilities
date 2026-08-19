import { cmToPx, formatAreaM2 } from "../../geometry/units.js";
import { polygonCentroid } from "../../geometry/geometry.js";
import RoomNameDialog from "./RoomNameDialog.jsx";
import * as Actions from "../../state/floorPlanActions.js";

export default function RoomLayer({ rooms, pxPerCm, dispatch }) {
  return (
    <g className="room-layer">
      {rooms.map((room, index) => {
        const points = room.polygon.map((p) => `${cmToPx(p.x, pxPerCm)},${cmToPx(p.y, pxPerCm)}`).join(" ");
        const centroid = polygonCentroid(room.polygon);
        return (
          <g key={room.id}>
            <polygon
              points={points}
              className={`room-fill ${index % 2 === 0 ? "room-fill--a" : "room-fill--b"}`}
              style={{ pointerEvents: "none" }}
            />
            <text
              x={cmToPx(centroid.x, pxPerCm)}
              y={cmToPx(centroid.y, pxPerCm) + 22}
              textAnchor="middle"
              className="room-area-label"
              style={{ pointerEvents: "none" }}
            >
              {formatAreaM2(room.areaM2)}
            </text>
            <RoomNameDialog
              room={room}
              centroid={centroid}
              pxPerCm={pxPerCm}
              onCommit={(name) => dispatch({ type: Actions.SET_ROOM_NAME, roomId: room.id, name })}
            />
          </g>
        );
      })}
    </g>
  );
}
