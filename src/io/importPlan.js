import { validatePlan } from "./validatePlan.js";

// File -> validated floor-plan object. Throws on malformed JSON or an
// invalid/forward-incompatible shape; the caller is responsible for
// catching and surfacing the error to the user.
export async function importPlan(file) {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Datei ist kein gültiges JSON.");
  }
  return validatePlan(parsed);
}
