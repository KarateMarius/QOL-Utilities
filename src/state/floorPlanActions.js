export const ADD_WALL = "ADD_WALL";
export const MOVE_WALL_ENDPOINT = "MOVE_WALL_ENDPOINT";
export const UPDATE_WALL_THICKNESS = "UPDATE_WALL_THICKNESS";
export const SET_ALL_WALL_THICKNESS = "SET_ALL_WALL_THICKNESS";
export const SET_WALL_LENGTH_AND_RECOMPUTE = "SET_WALL_LENGTH_AND_RECOMPUTE";
export const DELETE_WALL = "DELETE_WALL";
export const ADD_OPENING = "ADD_OPENING";
export const DELETE_OPENING = "DELETE_OPENING";
export const SET_ROOM_NAME = "SET_ROOM_NAME";
export const RECOMPUTE_ROOMS = "RECOMPUTE_ROOMS";
export const SET_GRID_SIZE = "SET_GRID_SIZE";
export const SET_PLAN_NAME = "SET_PLAN_NAME";
export const REPLACE_ALL = "REPLACE_ALL";
export const RESET = "RESET";

// Actions that recompute rooms as a side-effect of a structural wall change
// are dispatched as this compound action from EditCanvas so undo/redo treats
// "draw a wall" as one step, not two (see useFloorPlanHistory.js).
export const ADD_WALL_AND_RECOMPUTE = "ADD_WALL_AND_RECOMPUTE";
export const MOVE_WALL_ENDPOINT_AND_RECOMPUTE = "MOVE_WALL_ENDPOINT_AND_RECOMPUTE";
export const DELETE_WALL_AND_RECOMPUTE = "DELETE_WALL_AND_RECOMPUTE";
