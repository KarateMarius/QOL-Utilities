export const DEFAULT_GRID_CM = 25;
export const DEFAULT_WALL_THICKNESS_CM = 17.5;
export const DEFAULT_DOOR_WIDTH_CM = 80;
export const DEFAULT_WINDOW_WIDTH_CM = 100;

export const TOOLS = {
  SELECT: "select",
  WALL: "wall",
  DOOR: "door",
  WINDOW: "window",
  DELETE: "delete",
};

export const MODES = {
  EDIT: "edit",
  VIEW: "view",
};

export const MIN_ROOM_AREA_M2 = 0.25;

// Untergrenze bewusst sehr klein: bei BASE_PX_PER_CM = 2 entspricht zoom 0.04
// noch 0.08 px/cm, sodass auch eine grosse Wohnung (>15 m breit) auf ein
// 360-px-Display passt. Mit dem frueheren Wert 0.25 liess sich so ein
// Grundriss auf dem Handy prinzipiell nicht vollstaendig anzeigen.
export const ZOOM_MIN = 0.04;
export const ZOOM_MAX = 4;
