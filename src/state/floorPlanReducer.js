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
      const walls = moveEndpoint(state.walls, action.wallId, action.endpoint, action.point);
      return { ...state, walls, rooms: detectRooms(walls, state.rooms) };
    }

    case Actions.UPDATE_WALL_THICKNESS:
      return {
        ...state,
        walls: state.walls.map((w) => (w.id === action.wallId ? { ...w, thicknessCm: action.thicknessCm } : w)),
      };

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

function deleteWall(state, wallId, recompute) {
  const walls = state.walls.filter((w) => w.id !== wallId);
  const openings = state.openings.filter((o) => o.wallId !== wallId);
  const rooms = recompute ? detectRooms(walls, state.rooms) : state.rooms;
  return { ...state, walls, openings, rooms };
}
