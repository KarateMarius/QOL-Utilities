import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WallLayer from "../edit/WallLayer.jsx";
import OpeningLayer from "../edit/OpeningLayer.jsx";
import { ScaleBar } from "../edit/GridBackground.jsx";
import FixtureLayer from "../edit/FixtureLayer.jsx";
import ViewRoomLabels from "./ViewRoomLabels.jsx";
import ViewDimensions from "./ViewDimensions.jsx";
import { useZoomPan } from "../../hooks/useZoomPan.js";
import { wallsBounds } from "../../geometry/geometry.js";

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
  const { transform, pxPerCm, bindPointerPanZoom, fitTo } = useZoomPan(containerRef);

  const bounds = useMemo(() => wallsBounds(floorPlan.walls), [floorPlan.walls]);

  const fitToPlan = useCallback(() => {
    if (bounds) fitTo(bounds);
  }, [bounds, fitTo]);

  // Beim Betreten der Ansicht und bei jedem Grundriss mit anderer Ausdehnung
  // einmal einpassen. Die Abhaengigkeit haengt bewusst an den Eckwerten und
  // nicht am gesamten Grundriss: sonst wuerde jede Namensaenderung die
  // Ansicht zurueckspringen lassen. Eigenes Zoomen/Verschieben aendert die
  // Eckwerte nicht und bleibt deshalb erhalten.
  const boundsKey = bounds ? `${bounds.minX},${bounds.minY},${bounds.maxX},${bounds.maxY}` : "leer";
  useEffect(() => {
    if (!bounds) return undefined;
    // Ein Frame warten, damit der Container beim ersten Rendern schon eine
    // Groesse hat - sonst waere die Rechnung durch width/height 0 wertlos.
    const raf = requestAnimationFrame(() => fitTo(bounds));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey]);

  // Nach einer Drehung des Geraets passt der alte Ausschnitt nicht mehr.
  useEffect(() => {
    if (!bounds) return undefined;
    const onResize = () => fitTo(bounds);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [bounds, fitTo]);

  const isEmpty = !bounds;

  return (
    <div className="view-mode">
      <div className="view-mode__bar">
        <span className="view-mode__title">{floorPlan.meta.name}</span>
        <div className="view-mode__actions">
          <button type="button" className="view-mode__button" onClick={fitToPlan} disabled={isEmpty}>
            Zentrieren
          </button>
          <label className="view-mode__dimensions-toggle">
            <input type="checkbox" checked={showDimensions} onChange={(e) => setShowDimensions(e.target.checked)} />
            Bemaßung
          </label>
        </div>
      </div>
      <div ref={containerRef} className="view-canvas-wrapper">
        <svg className="view-canvas" style={{ touchAction: "none" }} {...bindPointerPanZoom}>
          <g transform={`translate(${transform.panX} ${transform.panY})`}>
            <ViewRoomLabels rooms={floorPlan.rooms} pxPerCm={pxPerCm} />
            <WallLayer walls={floorPlan.walls} selectedWallId={null} pxPerCm={pxPerCm} />
            <OpeningLayer openings={floorPlan.openings} walls={floorPlan.walls} pxPerCm={pxPerCm} />
            <FixtureLayer fixtures={floorPlan.fixtures} walls={floorPlan.walls} pxPerCm={pxPerCm} />
            {showDimensions && <ViewDimensions walls={floorPlan.walls} pxPerCm={pxPerCm} />}
          </g>
        </svg>
        {isEmpty && <p className="view-canvas__empty">Noch nichts gezeichnet.</p>}
        <ScaleBar pxPerCm={pxPerCm} />
      </div>
    </div>
  );
}
