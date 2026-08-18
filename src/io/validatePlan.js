import { SCHEMA_VERSION } from "../state/schema.js";

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function isPoint(p) {
  return p && isFiniteNumber(p.x) && isFiniteNumber(p.y);
}

// Validates the shape of an imported JSON object and rejects files written
// by a newer, forward-incompatible schema version. Throws a descriptive
// Error on any problem; returns the (lightly normalized) plan on success.
export function validatePlan(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Datei enthält kein gültiges JSON-Objekt.");
  }
  if (typeof data.schemaVersion !== "number") {
    throw new Error("Datei hat keine schemaVersion.");
  }
  if (data.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `Diese Datei wurde mit einer neueren App-Version erstellt (schemaVersion ${data.schemaVersion}), die diese App-Version noch nicht unterstützt.`
    );
  }
  if (!Array.isArray(data.walls) || !Array.isArray(data.openings) || !Array.isArray(data.rooms)) {
    throw new Error("Datei hat ein unerwartetes Format (walls/openings/rooms fehlen).");
  }

  for (const wall of data.walls) {
    if (!wall.id || !isPoint(wall.start) || !isPoint(wall.end) || !isFiniteNumber(wall.thicknessCm)) {
      throw new Error("Eine Wand in der Datei hat ein ungültiges Format.");
    }
  }

  return {
    schemaVersion: data.schemaVersion,
    meta: {
      name: typeof data.meta?.name === "string" ? data.meta.name : "Importierter Grundriss",
      gridSizeCm: isFiniteNumber(data.meta?.gridSizeCm) ? data.meta.gridSizeCm : 25,
    },
    walls: data.walls,
    openings: data.openings,
    rooms: data.rooms,
    furniture: Array.isArray(data.furniture) ? data.furniture : [],
  };
}
