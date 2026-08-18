let counter = 0;

// Simple, collision-free-enough id for a single in-memory session: a
// per-prefix counter plus a random suffix (guards against collisions after
// an import brings in ids from a previous session).
export function generateId(prefix) {
  counter += 1;
  const random = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${counter}_${random}`;
}
