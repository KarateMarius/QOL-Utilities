import { useCallback, useEffect, useRef, useState } from "react";
import { resolveSnap } from "../geometry/snapping.js";
import { distance, distanceToSegment, closestPointOnSegment, pointOnWall } from "../geometry/geometry.js";
import { pxToCm } from "../geometry/units.js";
import { generateId } from "../utils/idGenerator.js";
import * as Actions from "../state/floorPlanActions.js";
import { TOOLS, DEFAULT_DOOR_WIDTH_CM, DEFAULT_WINDOW_WIDTH_CM, FIXTURE_TYPES } from "../utils/constants.js";

const SELECT_HIT_TOLERANCE_PX = 12;
const HANDLE_HIT_TOLERANCE_PX = 14;
const OPENING_HIT_TOLERANCE_PX = 16;
const FIXTURE_HIT_TOLERANCE_PX = 16;
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
  fixtures,
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
  // One drag == one wall. The start point is captured on pointerdown and
  // lives only for the duration of that drag.
  //
  // An earlier version kept a persistent "chain start" across gestures so a
  // connected run of walls could be drawn without re-clicking the previous
  // endpoint. That was removed: because the start point outlived the
  // gesture, pressing down anywhere else still drew from the *old* start,
  // silently producing stray walls on top of existing ones. Endpoint
  // snapping (see snapping.js, highest snap priority) already makes a new
  // drag begun near an existing endpoint land exactly on it, so chaining
  // added no reach and cost correctness.
  const drawStart = useRef(null);
  const [previewWall, setPreviewWall] = useState(null);
  const [draggingHandle, setDraggingHandle] = useState(null); // {wallId, endpoint, point}
  const panRef = useRef(null);

  // Switching tools (or selection) cancels an in-progress gesture so stale
  // state can't leak into the next one.
  useEffect(() => {
    drawStart.current = null;
    setPreviewWall(null);
  }, [tool]);
  useEffect(() => {
    setDraggingHandle(null);
  }, [selectedWallId]);

  const cancelDrawing = useCallback(() => {
    drawStart.current = null;
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

  // Installationselemente werden ueber ihren gezeichneten Mittelpunkt
  // getroffen, nicht ueber die Wand - sonst waere beim Radieren nicht
  // entscheidbar, ob Wand oder Element gemeint ist.
  const findFixtureNear = useCallback(
    (planPoint) => {
      const toleranceCm = pxToCm(FIXTURE_HIT_TOLERANCE_PX, pxPerCm);
      let best = null;
      let bestDist = Infinity;
      for (const fixture of fixtures || []) {
        const wall = walls.find((w) => w.id === fixture.wallId);
        if (!wall) continue;
        const d = distance(planPoint, pointOnWall(wall, fixture.offsetCm));
        if (d <= toleranceCm && d < bestDist) {
          bestDist = d;
          best = fixture;
        }
      }
      return best;
    },
    [fixtures, walls, pxPerCm]
  );

  const handlePointerDown = useCallback(
    (e) => {
      if (spaceHeld) {
        panRef.current = { lastX: e.clientX, lastY: e.clientY };
        return;
      }

      const raw = screenToPlan(e.clientX, e.clientY);

      if (tool === TOOLS.WALL) {
        const snapped = resolveSnap(raw, walls, gridSizeCm, null, pxPerCm);
        drawStart.current = snapped;
        setPreviewWall({ start: snapped, end: snapped });
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

      if (FIXTURE_TYPES[tool]) {
        const wall = findWallAt(raw);
        if (!wall) return;
        const { t } = closestPointOnSegment(raw, wall.start, wall.end);
        dispatch({
          type: Actions.ADD_FIXTURE,
          fixture: {
            id: generateId("fixture"),
            type: tool,
            wallId: wall.id,
            offsetCm: t * distance(wall.start, wall.end),
          },
        });
        return;
      }

      if (tool === TOOLS.DELETE) {
        // Reihenfolge = Zeichenreihenfolge von oben nach unten: was obenauf
        // liegt, wird zuerst getroffen.
        const fixtureHit = findFixtureNear(raw);
        if (fixtureHit) {
          dispatch({ type: Actions.DELETE_FIXTURE, fixtureId: fixtureHit.id });
          return;
        }
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
      findFixtureNear,
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

      if (tool === TOOLS.WALL && drawStart.current) {
        const snapped = resolveSnap(raw, walls, gridSizeCm, drawStart.current, pxPerCm);
        setPreviewWall({ start: drawStart.current, end: snapped });
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

      if (tool === TOOLS.WALL && drawStart.current) {
        const raw = screenToPlan(e.clientX, e.clientY);
        const start = drawStart.current;
        const snapped = resolveSnap(raw, walls, gridSizeCm, start, pxPerCm);
        // A tap (or a drag too short to be meaningful) places nothing.
        if (distance(start, snapped) >= MIN_WALL_LENGTH_CM) {
          dispatch({
            type: Actions.ADD_WALL_AND_RECOMPUTE,
            wall: {
              id: generateId("wall"),
              start,
              end: snapped,
              thicknessCm: wallThicknessCm,
            },
          });
        }
        drawStart.current = null;
        setPreviewWall(null);
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
    [tool, screenToPlan, walls, gridSizeCm, pxPerCm, dispatch, draggingHandle, wallThicknessCm]
  );

  const handlePointerCancel = useCallback(() => {
    panRef.current = null;
    drawStart.current = null;
    setPreviewWall(null);
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
