export const DEFAULT_GRID_CM = 25;
export const DEFAULT_WALL_THICKNESS_CM = 5;
export const DEFAULT_DOOR_WIDTH_CM = 80;
export const DEFAULT_WINDOW_WIDTH_CM = 100;

export const TOOLS = {
  SELECT: "select",
  WALL: "wall",
  DOOR: "door",
  WINDOW: "window",
  DELETE: "delete",
  // Die Werte entsprechen exakt den Schluesseln in FIXTURE_TYPES, damit aus
  // dem aktiven Werkzeug direkt der Elementtyp folgt.
  SOCKET: "socket",
  SWITCH: "switch",
  WATER: "water",
  HEATING: "heating",
};

// Installationselemente. Alle sitzen als Punkt auf einer Wand (wallId +
// offsetCm), anders als Tueren/Fenster unterbrechen sie die Wand aber nicht.
// Sie werden mit fester Pixelgroesse gezeichnet, damit sie auch stark
// herausgezoomt auf dem Handy lesbar bleiben.
export const FIXTURE_TYPES = {
  socket: { label: "Steckdose", icon: "⊙", cssClass: "fixture--socket" },
  switch: { label: "Lichtschalter", icon: "⊘", cssClass: "fixture--switch" },
  water: { label: "Wasseranschluss", icon: "◇", cssClass: "fixture--water" },
  heating: { label: "Fußbodenheizung", icon: "≋", cssClass: "fixture--heating" },
};

export const FIXTURE_TOOLS = [TOOLS.SOCKET, TOOLS.SWITCH, TOOLS.WATER, TOOLS.HEATING];

// Moebel. Anders als Installationen haengen sie an keiner Wand, sondern
// stehen frei im Raum - deshalb x/y in Zentimetern statt wallId + Abstand.
//
// Die Masse sind uebliche Groessen und nur ein Startwert: jedes Stueck laesst
// sich danach in der Leiste genau einstellen. Sie sind der Grund fuer das
// ganze Werkzeug - die Frage ist ja "passt das Sofa an diese Wand".
export const FURNITURE_TYPES = {
  sofa: { label: "Sofa", widthCm: 220, depthCm: 90 },
  bett: { label: "Bett", widthCm: 180, depthCm: 200 },
  tisch: { label: "Tisch", widthCm: 160, depthCm: 90 },
  schrank: { label: "Schrank", widthCm: 120, depthCm: 60 },
  gerat: { label: "Gerät", widthCm: 60, depthCm: 60 },
};

// Die Moebel-Werkzeuge tragen ein Praefix, damit ihre Werte nicht mit den
// Installationen kollidieren koennen und aus dem aktiven Werkzeug eindeutig
// hervorgeht, was gesetzt wird.
export const FURNITURE_TOOL_PREFIX = "moebel:";

export const FURNITURE_TOOLS = Object.keys(FURNITURE_TYPES).map(
  (typ) => `${FURNITURE_TOOL_PREFIX}${typ}`
);

/** Moebeltyp eines Werkzeugs, oder null wenn es keines ist. */
export function furnitureTypeOfTool(tool) {
  const wert = String(tool || "");
  if (!wert.startsWith(FURNITURE_TOOL_PREFIX)) return null;
  const typ = wert.slice(FURNITURE_TOOL_PREFIX.length);
  return FURNITURE_TYPES[typ] ? typ : null;
}

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
