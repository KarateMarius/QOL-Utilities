import { createEmptyFloorPlan } from "./schema.js";
import { detectRooms } from "../geometry/roomDetection.js";
import * as Actions from "./floorPlanActions.js";

// Pure reducer: (state, action) -> newState. Ids are assigned by the caller
// before dispatch (see idGenerator.js usage in the components/hooks that
// dispatch these actions) so this file stays trivially testable/replayable.
//
// The "_AND_RECOMPUTE" action variants perform a structural wall change and
// re-run room detection in the same reducer pass, so one dispatched action
// = one resulting state = one undo/redo step (see useFloorPlanHistory.js) —
// this is how "add wall" avoids becoming two separate undo steps ("add
// wall" then "rooms recalculated").
export function floorPlanReducer(state, action) {
  switch (action.type) {
    case Actions.ADD_WALL:
      return { ...state, walls: [...state.walls, action.wall] };

    case Actions.ADD_WALL_AND_RECOMPUTE: {
      const walls = [...state.walls, action.wall];
      return { ...state, walls, rooms: detectRooms(walls, state.rooms) };
    }

    case Actions.MOVE_WALL_ENDPOINT:
      return { ...state, walls: moveEndpoint(state.walls, action.wallId, action.endpoint, action.point) };

    case Actions.MOVE_WALL_ENDPOINT_AND_RECOMPUTE: {
      const wall = state.walls.find((w) => w.id === action.wallId);
      if (!wall) return state;
      const walls = moveVertex(state.walls, wall[action.endpoint], action.point);
      return { ...state, walls, rooms: detectRooms(walls, state.rooms) };
    }

    case Actions.SET_WALL_LENGTH_AND_RECOMPUTE: {
      const wall = state.walls.find((w) => w.id === action.wallId);
      if (!wall) return state;
      const currentLength = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
      if (currentLength === 0 || action.lengthCm <= 0) return state;
      // Keep `start` fixed and slide `end` along the wall's existing
      // direction, so editing a length never rotates the edited wall.
      //
      // Only that one corner moves. Walls meeting there stay attached and
      // therefore stretch/rotate to follow (a 4x3m rectangle whose top wall
      // is set to 5m becomes a trapezoid, not a 5x3m rectangle). This is
      // the same behaviour as dragging the corner by hand, just numerically
      // exact. Pushing a whole wall sideways and having the two
      // perpendicular neighbours stay perpendicular is a different, much
      // larger feature (constraint solving / push-pull) and is not
      // implemented.
      const dirX = (wall.end.x - wall.start.x) / currentLength;
      const dirY = (wall.end.y - wall.start.y) / currentLength;
      const newEnd = {
        x: wall.start.x + dirX * action.lengthCm,
        y: wall.start.y + dirY * action.lengthCm,
      };
      const walls = moveVertex(state.walls, wall.end, newEnd);
      return { ...state, walls, rooms: detectRooms(walls, state.rooms) };
    }

    case Actions.UPDATE_WALL_THICKNESS:
      return {
        ...state,
        walls: state.walls.map((w) => (w.id === action.wallId ? { ...w, thicknessCm: action.thicknessCm } : w)),
      };

    case Actions.SET_ALL_WALL_THICKNESS:
      return { ...state, walls: state.walls.map((w) => ({ ...w, thicknessCm: action.thicknessCm })) };

    case Actions.DELETE_WALL:
      return deleteWall(state, action.wallId, false);

    case Actions.DELETE_WALL_AND_RECOMPUTE:
      return deleteWall(state, action.wallId, true);

    case Actions.ADD_OPENING:
      return { ...state, openings: [...state.openings, action.opening] };

    case Actions.DELETE_OPENING:
      return { ...state, openings: state.openings.filter((o) => o.id !== action.openingId) };

    case Actions.SET_ROOM_NAME:
      return {
        ...state,
        rooms: state.rooms.map((r) => (r.id === action.roomId ? { ...r, name: action.name } : r)),
      };

    case Actions.RECOMPUTE_ROOMS:
      return { ...state, rooms: detectRooms(state.walls, state.rooms) };

    case Actions.SET_GRID_SIZE:
      return { ...state, meta: { ...state.meta, gridSizeCm: action.gridSizeCm } };

    case Actions.SET_PLAN_NAME:
      return { ...state, meta: { ...state.meta, name: action.name } };

    case Actions.REPLACE_ALL:
      return action.floorPlan;

    case Actions.RESET:
      return createEmptyFloorPlan();

    default:
      return state;
  }
}

function moveEndpoint(walls, wallId, endpoint, point) {
  return walls.map((w) => (w.id === wallId ? { ...w, [endpoint]: point } : w));
}

const VERTEX_EPSILON_CM = 0.01;

function samePoint(a, b) {
  return Math.abs(a.x - b.x) < VERTEX_EPSILON_CM && Math.abs(a.y - b.y) < VERTEX_EPSILON_CM;
}

// Moves a shared corner: EVERY wall endpoint sitting at `from` moves to
// `to`, not just one wall's. Walls only form rooms when their endpoints
// coincide exactly (see roomDetection.js), so moving a single wall's
// endpoint in isolation would silently tear open every room that corner
// belongs to. Vertex semantics keep the loops closed, which is what a
// floor-plan editor needs.
//
// TRADEOFF: there is deliberately no way to detach one wall from a shared
// corner by dragging — the walls meeting there always move together. To
// separate them, delete the wall and redraw it.
function moveVertex(walls, from, to) {
  return walls.map((w) => {
    const startMatches = samePoint(w.start, from);
    const endMatches = samePoint(w.end, from);
    if (!startMatches && !endMatches) return w;
    return {
      ...w,
      start: startMatches ? to : w.start,
      end: endMatches ? to : w.end,
    };
  });
}

function deleteWall(state, wallId, recompute) {
  const walls = state.walls.filter((w) => w.id !== wallId);
  const openings = state.openings.filter((o) => o.wallId !== wallId);
  const rooms = recompute ? detectRooms(walls, state.rooms) : state.rooms;
  return { ...state, walls, openings, rooms };
}
