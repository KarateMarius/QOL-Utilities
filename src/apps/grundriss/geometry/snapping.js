import { distance, angleOf } from "./geometry.js";
import { pxToCm, BASE_PX_PER_CM } from "./units.js";

const ENDPOINT_SNAP_PX = 15;
const ANGLE_SNAP_STEP_DEG = 45;
const ANGLE_SNAP_TOLERANCE_DEG = 4;

// COMPROMISE 1: Endpoint snap only considers wall.start/wall.end, not
// arbitrary points along a wall's length. A wall drawn to touch the *middle*
// of another wall (a T-junction) will NOT snap to a point on that wall — the
// user must manually land close enough to trigger grid snap, or endpoint
// snap to a nearby existing vertex. True "snap-to-nearest-point-on-any-
// segment" is not implemented; this is the single biggest simplification and
// directly limits room detection to vertex-sharing topologies (see
// roomDetection.js for the consequence).
//
// COMPROMISE 2: Angle snap is computed relative to the *current* draw
// segment's own start point only, not relative to a previous wall's angle
// chain or a global "constrain to orthogonal grid" mode. Each new wall's
// angle is snapped independently.
//
// COMPROMISE 3: Snap tolerance is a fixed pixel radius converted to the
// current zoom's cm-per-pixel, not further adjusted per grid size. At very
// coarse grid settings (e.g. 100cm/cell) this can feel loose; acceptable
// tradeoff for a single tuned default (25cm).

/**
 * Resolve where a raw pointer position should snap to, given the current
 * walls, grid size, and (optionally) the fixed start point of a wall
 * currently being drawn.
 *
 * Priority: endpoint snap > angle snap > grid snap > raw point.
 *
 * @param {{x:number,y:number}} rawPoint - pointer position in plan-space cm
 * @param {Array} walls
 * @param {number} gridSizeCm
 * @param {{x:number,y:number}|null} activeStartPoint
 * @param {number} pxPerCm - current zoom level, for consistent on-screen tolerance
 * @returns {{x:number,y:number,snapType:"endpoint"|"angle"|"grid"|"none"}}
 */
export function resolveSnap(rawPoint, walls, gridSizeCm, activeStartPoint = null, pxPerCm = BASE_PX_PER_CM) {
  const endpointToleranceCm = pxToCm(ENDPOINT_SNAP_PX, pxPerCm);

  let nearestEndpoint = null;
  let nearestEndpointDistance = Infinity;
  for (const wall of walls) {
    for (const endpoint of [wall.start, wall.end]) {
      const d = distance(rawPoint, endpoint);
      if (d < nearestEndpointDistance) {
        nearestEndpointDistance = d;
        nearestEndpoint = endpoint;
      }
    }
  }
  if (nearestEndpoint && nearestEndpointDistance <= endpointToleranceCm) {
    return { x: nearestEndpoint.x, y: nearestEndpoint.y, snapType: "endpoint" };
  }

  if (activeStartPoint) {
    const rawAngleDeg = (angleOf(activeStartPoint, rawPoint) * 180) / Math.PI;
    const nearestStepDeg = Math.round(rawAngleDeg / ANGLE_SNAP_STEP_DEG) * ANGLE_SNAP_STEP_DEG;
    const angleDiff = Math.abs(rawAngleDeg - nearestStepDeg);
    if (angleDiff <= ANGLE_SNAP_TOLERANCE_DEG) {
      const dist = distance(activeStartPoint, rawPoint);
      const rad = (nearestStepDeg * Math.PI) / 180;
      return {
        x: activeStartPoint.x + Math.cos(rad) * dist,
        y: activeStartPoint.y + Math.sin(rad) * dist,
        snapType: "angle",
      };
    }
  }

  return {
    x: Math.round(rawPoint.x / gridSizeCm) * gridSizeCm,
    y: Math.round(rawPoint.y / gridSizeCm) * gridSizeCm,
    snapType: "grid",
  };
}
