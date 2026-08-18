import { useCallback, useEffect, useRef, useState } from "react";
import { resolveSnap } from "../geometry/snapping.js";
import { distance, distanceToSegment, closestPointOnSegment } from "../geometry/geometry.js";
import { pxToCm } from "../geometry/units.js";
import { generateId } from "../utils/idGenerator.js";
import * as Actions from "../state/floorPlanActions.js";
import { TOOLS, DEFAULT_DOOR_WIDTH_CM, DEFAULT_WINDOW_WIDTH_CM } from "../utils/constants.js";

const SELECT_HIT_TOLERANCE_PX = 12;
const HANDLE_HIT_TOLERANCE_PX = 14;
const OPENING_HIT_TOLERANCE_PX = 16;
const MIN_WALL_LENGTH_CM = 5;

// Edit-mode interaction state machine: draws/selects/moves/deletes walls and
// openings depending on the active tool. Built on Pointer Events so a
// single tap on touch already degenerates to "tap to place a point" with no
// touch-specific branching — satisfying the spec's "must not break on
// touch" bar without extra code. Pinch-zoom/two-finger-pan is deliberately
// NOT handled here (view-mode only, see useZoomPan's bindPointerPanZoom) —
// over-engineering edit-mode touch is explicitly out of scope.
export function usePointerDrawing({
  tool,
  walls,
  openings,
  gridSizeCm,
  pxPerCm,
  screenToPlan,
  spaceHeld,
  panBy,
  dispatch,
  selectedWallId,
  setSelectedWallId,
  wallThicknessCm,
}) {
  const chainStart = useRef(null);
  const [previewWall, setPreviewWall] = useState(null);
  const [draggingHandle, setDraggingHandle] = useState(null); // {wallId, endpoint, point}
  const panRef = useRef(null);

  // Leaving the wall tool (or losing the selection) cancels any in-progress
  // chain/drag so stale state doesn't leak into the next gesture.
  useEffect(() => {
    chainStart.current = null;
    setPreviewWall(null);
  }, [tool]);
  useEffect(() => {
    setDraggingHandle(null);
  }, [selectedWallId]);

  const cancelDrawing = useCallback(() => {
    chainStart.current = null;
    setPreviewWall(null);
    setDraggingHandle(null);
  }, []);

  const findWallAt = useCallback(
    (planPoint) => {
      const toleranceCm = pxToCm(SELECT_HIT_TOLERANCE_PX, pxPerCm);
      let best = null;
      let bestDist = Infinity;
      for (const wall of walls) {
        const d = distanceToSegment(planPoint, wall.start, wall.end);
        const effectiveTolerance = toleranceCm + wall.thicknessCm / 2;
        if (d <= effectiveTolerance && d < bestDist) {
          bestDist = d;
          best = wall;
        }
      }
      return best;
    },
    [walls, pxPerCm]
  );

  const findOpeningNear = useCallback(
    (planPoint) => {
      const toleranceCm = pxToCm(OPENING_HIT_TOLERANCE_PX, pxPerCm);
      let best = null;
      let bestDist = Infinity;
      for (const opening of openings) {
        const wall = walls.find((w) => w.id === opening.wallId);
        if (!wall) continue;
        const t = opening.offsetCm / distance(wall.start, wall.end);
        const openingPoint = {
          x: wall.start.x + (wall.end.x - wall.start.x) * t,
          y: wall.start.y + (wall.end.y - wall.start.y) * t,
        };
        const d = distance(planPoint, openingPoint);
        if (d <= toleranceCm && d < bestDist) {
          bestDist = d;
          best = opening;
        }
      }
      return best;
    },
    [openings, walls, pxPerCm]
  );

  const handlePointerDown = useCallback(
    (e) => {
      if (spaceHeld) {
        panRef.current = { lastX: e.clientX, lastY: e.clientY };
        return;
      }

      const raw = screenToPlan(e.clientX, e.clientY);

      if (tool === TOOLS.WALL) {
        const snapped = resolveSnap(raw, walls, gridSizeCm, chainStart.current, pxPerCm);
        if (!chainStart.current) {
          chainStart.current = snapped;
        }
        setPreviewWall({ start: chainStart.current, end: snapped });
        return;
      }

      if (tool === TOOLS.SELECT) {
        if (selectedWallId && draggingHandle === null) {
          const selectedWall = walls.find((w) => w.id === selectedWallId);
          if (selectedWall) {
            const handleToleranceCm = pxToCm(HANDLE_HIT_TOLERANCE_PX, pxPerCm);
            for (const endpoint of ["start", "end"]) {
              if (distance(raw, selectedWall[endpoint]) <= handleToleranceCm) {
                setDraggingHandle({ wallId: selectedWall.id, endpoint, point: selectedWall[endpoint] });
                return;
              }
            }
          }
        }
        const hit = findWallAt(raw);
        setSelectedWallId(hit ? hit.id : null);
        return;
      }

      if (tool === TOOLS.DOOR || tool === TOOLS.WINDOW) {
        const wall = findWallAt(raw);
        if (!wall) return;
        const { t } = closestPointOnSegment(raw, wall.start, wall.end);
        const wallLength = distance(wall.start, wall.end);
        dispatch({
          type: Actions.ADD_OPENING,
          opening: {
            id: generateId("opening"),
            type: tool,
            wallId: wall.id,
            offsetCm: t * wallLength,
            widthCm: tool === TOOLS.DOOR ? DEFAULT_DOOR_WIDTH_CM : DEFAULT_WINDOW_WIDTH_CM,
            swing: tool === TOOLS.DOOR ? "left" : null,
          },
        });
        return;
      }

      if (tool === TOOLS.DELETE) {
        const openingHit = findOpeningNear(raw);
        if (openingHit) {
          dispatch({ type: Actions.DELETE_OPENING, openingId: openingHit.id });
          return;
        }
        const wallHit = findWallAt(raw);
        if (wallHit) {
          dispatch({ type: Actions.DELETE_WALL_AND_RECOMPUTE, wallId: wallHit.id });
          if (selectedWallId === wallHit.id) setSelectedWallId(null);
        }
      }
    },
    [
      spaceHeld,
      screenToPlan,
      tool,
      walls,
      gridSizeCm,
      pxPerCm,
      selectedWallId,
      draggingHandle,
      findWallAt,
      findOpeningNear,
      dispatch,
      setSelectedWallId,
    ]
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (panRef.current) {
        const dx = e.clientX - panRef.current.lastX;
        const dy = e.clientY - panRef.current.lastY;
        panRef.current = { lastX: e.clientX, lastY: e.clientY };
        panBy(dx, dy);
        return;
      }

      const raw = screenToPlan(e.clientX, e.clientY);

      if (tool === TOOLS.WALL && chainStart.current) {
        const snapped = resolveSnap(raw, walls, gridSizeCm, chainStart.current, pxPerCm);
        setPreviewWall({ start: chainStart.current, end: snapped });
        return;
      }

      if (draggingHandle) {
        const snapped = resolveSnap(raw, walls, gridSizeCm, null, pxPerCm);
        setDraggingHandle((d) => (d ? { ...d, point: snapped } : d));
      }
    },
    [screenToPlan, tool, walls, gridSizeCm, pxPerCm, draggingHandle, panBy]
  );

  const handlePointerUp = useCallback(
    (e) => {
      if (panRef.current) {
        panRef.current = null;
        return;
      }

      if (tool === TOOLS.WALL && chainStart.current && previewWall) {
        const raw = screenToPlan(e.clientX, e.clientY);
        const snapped = resolveSnap(raw, walls, gridSizeCm, chainStart.current, pxPerCm);
        if (distance(chainStart.current, snapped) >= MIN_WALL_LENGTH_CM) {
          dispatch({
            type: Actions.ADD_WALL_AND_RECOMPUTE,
            wall: {
              id: generateId("wall"),
              start: chainStart.current,
              end: snapped,
              thicknessCm: wallThicknessCm,
            },
          });
          chainStart.current = snapped; // re-arm: chain the next wall from here
          setPreviewWall({ start: snapped, end: snapped });
        }
        return;
      }

      if (draggingHandle) {
        dispatch({
          type: Actions.MOVE_WALL_ENDPOINT_AND_RECOMPUTE,
          wallId: draggingHandle.wallId,
          endpoint: draggingHandle.endpoint,
          point: draggingHandle.point,
        });
        setDraggingHandle(null);
      }
    },
    [tool, previewWall, screenToPlan, walls, gridSizeCm, pxPerCm, dispatch, draggingHandle, wallThicknessCm]
  );

  const handlePointerCancel = useCallback(() => {
    panRef.current = null;
    setDraggingHandle(null);
  }, []);

  return {
    previewWall,
    draggingHandle,
    cancelDrawing,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  };
}
