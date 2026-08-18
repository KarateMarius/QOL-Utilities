import { DEFAULT_GRID_CM } from "../utils/constants.js";

export const SCHEMA_VERSION = 1;

// FUTURE EXTENSION (step 2, not implemented here): `furniture` will hold
// items shaped like { id, roomId, type, x, y, rotationDeg, widthCm, depthCm }.
// It is present and empty from day one so adding it later is a purely
// additive change to the schema — no migration needed to introduce the
// array itself, only if individual item fields are added later.

export function createEmptyFloorPlan(name = "Neuer Grundriss") {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      name,
      gridSizeCm: DEFAULT_GRID_CM,
    },
    walls: [],
    openings: [],
    // Installationselemente (Steckdose, Lichtschalter, Wasseranschluss,
    // Fussbodenheizung): Punkte auf einer Wand. Bewusst getrennt von
    // openings, weil sie die Wand nicht unterbrechen.
    fixtures: [],
    rooms: [],
    furniture: [],
  };
}
