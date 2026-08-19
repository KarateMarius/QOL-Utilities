import { useRef, useState } from "react";
import Toolbar from "./Toolbar.jsx";
import GridBackground, { ScaleBar } from "./GridBackground.jsx";
import WallLayer from "./WallLayer.jsx";
import OpeningLayer from "./OpeningLayer.jsx";
import RoomLayer from "./RoomLayer.jsx";
import DimensionLayer from "./DimensionLayer.jsx";
import SelectionHandles from "./SelectionHandles.jsx";
import FixtureLayer from "./FixtureLayer.jsx";
import { useZoomPan } from "../../hooks/useZoomPan.js";
import { usePointerDrawing } from "../../hooks/usePointerDrawing.js";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts.js";
import * as Actions from "../../state/floorPlanActions.js";
import { TOOLS, DEFAULT_WALL_THICKNESS_CM } from "../../utils/constants.js";
import { wallsBounds } from "../../geometry/geometry.js";

// Large fixed px bounds for the grid background rect, generous enough to
// stay covered even when zoomed in and panned away from the origin.
const VIEWPORT_BOUNDS_PX = { minX: -30000, minY: -30000, width: 60000, height: 60000 };

export default function EditCanvas({ floorPlan, dispatch, undo, redo, canUndo, canRedo }) {
  const containerRef = useRef(null);
  const [tool, setTool] = useState(TOOLS.WALL);
  const [selectedWallId, setSelectedWallId] = useState(null);
  const [defaultWallThicknessCm, setDefaultWallThicknessCm] = useState(DEFAULT_WALL_THICKNESS_CM);
  const [showDimensions, setShowDimensions] = useState(false);

  const { transform, pxPerCm, screenToPlan, panBy, onWheel, fitTo } = useZoomPan(containerRef);

  // Bewusst nur auf Knopfdruck, nicht automatisch wie im Ansichtsmodus: ein
  // Einpassen mitten im Zeichnen waere ein Sprung unter der Hand.
  function handleFitToPlan() {
    const bounds = wallsBounds(floorPlan.walls);
    if (bounds) fitTo(bounds);
  }

  const selectedWall = floorPlan.walls.find((w) => w.id === selectedWallId) || null;

  const { spaceHeld } = useKeyboardShortcuts({
    onUndo: undo,
    onRedo: redo,
    onDelete: () => {
      if (selectedWallId) {
        dispatch({ type: Actions.DELETE_WALL_AND_RECOMPUTE, wallId: selectedWallId });
        setSelectedWallId(null);
      }
    },
    onEscape: () => {
      cancelDrawing();
      setSelectedWallId(null);
    },
  });

  const { previewWall, draggingHandle, panning, cancelDrawing, handlers } = usePointerDrawing({
    tool,
    walls: floorPlan.walls,
    openings: floorPlan.openings,
    fixtures: floorPlan.fixtures,
    gridSizeCm: floorPlan.meta.gridSizeCm,
    pxPerCm,
    screenToPlan,
    spaceHeld,
    panBy,
    dispatch,
    selectedWallId,
    setSelectedWallId,
    wallThicknessCm: defaultWallThicknessCm,
  });

  // Waehrend des Verschiebens die geschlossene Hand, sonst der Zeiger des
  // Werkzeugs. Die Leertaste zeigt die offene Hand schon vor dem Zugreifen.
  const cursorClass = panning
    ? "edit-canvas--grabbing"
    : spaceHeld
      ? "edit-canvas--pan"
      : `edit-canvas--${tool}`;

  return (
    <div className="edit-mode">
      <Toolbar
        tool={tool}
        onToolChange={(t) => {
          setTool(t);
          setSelectedWallId(null);
        }}
        gridSizeCm={floorPlan.meta.gridSizeCm}
        onGridSizeChange={(v) => dispatch({ type: Actions.SET_GRID_SIZE, gridSizeCm: v })}
        selectedWall={selectedWall}
        onSelectedLengthChange={(lengthCm) =>
          dispatch({ type: Actions.SET_WALL_LENGTH_AND_RECOMPUTE, wallId: selectedWall.id, lengthCm })
        }
        onSelectedThicknessChange={(thicknessCm) =>
          dispatch({ type: Actions.UPDATE_WALL_THICKNESS, wallId: selectedWall.id, thicknessCm })
        }
        newWallThicknessCm={defaultWallThicknessCm}
        onNewWallThicknessChange={setDefaultWallThicknessCm}
        onApplyThicknessToAll={() =>
          dispatch({ type: Actions.SET_ALL_WALL_THICKNESS, thicknessCm: defaultWallThicknessCm })
        }
        showDimensions={showDimensions}
        onToggleDimensions={setShowDimensions}
        onFitToPlan={handleFitToPlan}
        hasWalls={floorPlan.walls.length > 0}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
      />
      <div ref={containerRef} className={`edit-canvas-wrapper ${cursorClass}`}>
        <svg
          className="edit-canvas"
          onWheel={onWheel}
          onPointerDown={(e) => {
            // Ohne Pointer-Capture geht das pointerup verloren, sobald der
            // Zeiger die Flaeche verlaesst - die Geste haengt dann fest. Der
            // Aufruf darf aber scheitern (kein aktiver Zeiger, aeltere
            // Browser), und ein Fehler hier wuerde die gesamte Bedienung der
            // Zeichenflaeche mitreissen.
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* Geste funktioniert weiterhin, endet nur am Rand der Flaeche */
            }
            handlers.onPointerDown(e);
          }}
          onPointerMove={handlers.onPointerMove}
          onPointerUp={handlers.onPointerUp}
          onPointerCancel={handlers.onPointerCancel}
        >
          <g transform={`translate(${transform.panX} ${transform.panY})`}>
            <GridBackground gridSizeCm={floorPlan.meta.gridSizeCm} pxPerCm={pxPerCm} viewportBoundsPx={VIEWPORT_BOUNDS_PX} />
            <RoomLayer rooms={floorPlan.rooms} pxPerCm={pxPerCm} dispatch={dispatch} />
            <WallLayer walls={floorPlan.walls} selectedWallId={selectedWallId} pxPerCm={pxPerCm} />
            <OpeningLayer openings={floorPlan.openings} walls={floorPlan.walls} pxPerCm={pxPerCm} />
            <FixtureLayer fixtures={floorPlan.fixtures} walls={floorPlan.walls} pxPerCm={pxPerCm} />
            <DimensionLayer walls={floorPlan.walls} previewWall={previewWall} pxPerCm={pxPerCm} showAll={showDimensions} />
            <SelectionHandles wall={selectedWall} draggingHandle={draggingHandle} pxPerCm={pxPerCm} />
          </g>
        </svg>
        <ScaleBar pxPerCm={pxPerCm} />
      </div>
    </div>
  );
}
