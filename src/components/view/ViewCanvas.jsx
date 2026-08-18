import { useRef, useState } from "react";
import WallLayer from "../edit/WallLayer.jsx";
import OpeningLayer from "../edit/OpeningLayer.jsx";
import { ScaleBar } from "../edit/GridBackground.jsx";
import ViewRoomLabels from "./ViewRoomLabels.jsx";
import ViewDimensions from "./ViewDimensions.jsx";
import { useZoomPan } from "../../hooks/useZoomPan.js";

// Read-only rendering, deliberately separate from EditCanvas: pinch-zoom and
// two-finger-pan own the entire pointer lifecycle here (via
// bindPointerPanZoom) since there's no drawing gesture competing for it —
// this is the priority polish target for mobile per the spec. WallLayer and
// OpeningLayer are reused as-is from edit mode since they were already
// pure/read-only (pointer-events: none, no dispatch), so there's no reason
// to fork them; RoomLayer and the dimension overlay ARE forked (as
// ViewRoomLabels/ViewDimensions) because the edit versions carry
// editing-only concerns (the room-name input, live draw preview) that view
// mode must never expose.
export default function ViewCanvas({ floorPlan }) {
  const containerRef = useRef(null);
  const [showDimensions, setShowDimensions] = useState(true);
  const { transform, pxPerCm, onWheel, bindPointerPanZoom } = useZoomPan(containerRef);

  return (
    <div className="view-mode">
      <div className="view-mode__bar">
        <span className="view-mode__title">{floorPlan.meta.name}</span>
        <label className="view-mode__dimensions-toggle">
          <input type="checkbox" checked={showDimensions} onChange={(e) => setShowDimensions(e.target.checked)} />
          Bemaßung
        </label>
      </div>
      <div ref={containerRef} className="view-canvas-wrapper">
        <svg
          className="view-canvas"
          onWheel={onWheel}
          style={{ touchAction: "none" }}
          {...bindPointerPanZoom}
        >
          <g transform={`translate(${transform.panX} ${transform.panY})`}>
            <ViewRoomLabels rooms={floorPlan.rooms} pxPerCm={pxPerCm} />
            <WallLayer walls={floorPlan.walls} selectedWallId={null} pxPerCm={pxPerCm} />
            <OpeningLayer openings={floorPlan.openings} walls={floorPlan.walls} pxPerCm={pxPerCm} />
            {showDimensions && <ViewDimensions walls={floorPlan.walls} pxPerCm={pxPerCm} />}
          </g>
        </svg>
        <ScaleBar pxPerCm={pxPerCm} />
      </div>
    </div>
  );
}
