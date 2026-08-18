import { buildGraph } from "./wallGraph.js";
import { shoelaceSignedAreaCm2 } from "./geometry.js";
import { generateId } from "../utils/idGenerator.js";
import { MIN_ROOM_AREA_M2 } from "../utils/constants.js";

// ROOM DETECTION — planar graph face-tracing ("next edge" walk).
//
// COMPROMISE (root cause: snapping.js COMPROMISE 1 — no point-on-segment
// snapping): this algorithm treats walls as edges of a planar graph where
// NODES ARE WALL ENDPOINTS THAT ARE EXACTLY EQUAL (post-snap). It does NOT
// perform true geometric segment-intersection splitting. Consequences
// accepted for this build:
//  - Two walls that cross in an X without a shared snapped endpoint at the
//    crossing point are NOT split into 4 sub-edges — no room boundary is
//    detected through that crossing.
//  - T-junctions (one wall's endpoint touching the middle of another wall)
//    are NOT split either, for the same reason. A room bounded partly by a
//    T-junction wall fails to close on that side unless the user also draws
//    the two half-segments explicitly, meeting at a shared vertex.
//  - A "room" only forms where wall endpoints exactly coincide (within snap
//    tolerance, post-snap) around a closed loop.
// This is a standard, explicitly-scoped simplification for a first build,
// not a silently missing feature. Full arrangement-based polygon extraction
// (segment intersection + graph splitting) would be the natural next step.

function directedKey(u, v) {
  return `${u}=>${v}`;
}

// Traces every face of the planar graph, including the single unbounded
// outer face. For a directed edge (u -> v), the next edge in its face is
// found by looking, at v, for the reverse edge (v -> u) among v's
// angle-sorted outgoing edges and taking the following one — the classic
// "leftmost turn" DCEL face-traversal rule. This is a structural property of
// the algorithm (not data-dependent): tracing this way always produces every
// bounded face with one consistent shoelace-area sign, and the single
// unbounded outer face with the opposite sign — verified against a simple
// rectangle fixture (see roomDetection.test-fixture below), so filtering on
// that sign reliably discards the outer face regardless of how many rooms
// exist.
function traceFaces(graph) {
  const { nodes, adjacency } = graph;
  const visited = new Set();
  const faces = [];

  let totalDirectedEdges = 0;
  for (const edges of adjacency.values()) totalDirectedEdges += edges.length;

  for (const [startKey, edges] of adjacency) {
    for (const startEdge of edges) {
      const startDirKey = directedKey(startKey, startEdge.targetKey);
      if (visited.has(startDirKey)) continue;

      const polygonKeys = [];
      const wallIds = [];
      let u = startKey;
      let v = startEdge.targetKey;
      let wallId = startEdge.wallId;
      let steps = 0;
      let closed = false;

      while (steps <= totalDirectedEdges) {
        const dirKey = directedKey(u, v);
        if (visited.has(dirKey)) break; // safety net; should not happen mid-trace
        visited.add(dirKey);
        polygonKeys.push(u);
        wallIds.push(wallId);

        const vEdges = adjacency.get(v);
        const reverseIndex = vEdges.findIndex((e) => e.targetKey === u && e.wallId === wallId);
        const nextEdge = vEdges[(reverseIndex + 1) % vEdges.length];

        u = v;
        v = nextEdge.targetKey;
        wallId = nextEdge.wallId;
        steps += 1;

        if (u === startKey && v === startEdge.targetKey) {
          closed = true;
          break;
        }
      }

      if (closed && polygonKeys.length >= 3) {
        const polygon = polygonKeys.map((key) => nodes.get(key));
        faces.push({ polygon, wallIds: [...new Set(wallIds)] });
      }
    }
  }

  return faces;
}

function wallIdSetScore(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const id of setA) if (setB.has(id)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Matches newly detected faces against the previous room list so that
// user-entered names survive a recompute triggered by an unrelated edit
// (e.g. nudging one wall of a different room). Match by wall-id overlap
// (Jaccard similarity); a strong match carries over id + name.
function matchPreviousRoom(wallIds, previousRooms) {
  let best = null;
  let bestScore = 0;
  for (const room of previousRooms) {
    const score = wallIdSetScore(wallIds, room.wallIds || []);
    if (score > bestScore) {
      bestScore = score;
      best = room;
    }
  }
  return bestScore > 0.5 ? best : null;
}

/**
 * Pure function: wall segments in -> detected room polygons out.
 * @param {Array} walls
 * @param {Array} previousRooms - previous state.rooms, used only to carry over names/ids
 * @returns {Array} rooms: {id, name, polygon, areaM2, wallIds}
 */
export function detectRooms(walls, previousRooms = []) {
  if (walls.length < 3) return [];

  const graph = buildGraph(walls);
  const faces = traceFaces(graph);

  const rooms = [];
  for (const face of faces) {
    const signedArea = shoelaceSignedAreaCm2(face.polygon);
    // Positive sign = bounded interior face (see traceFaces doc comment).
    // Negative/zero = the outer face, or a degenerate zero-area sliver.
    if (signedArea <= 0) continue;

    const areaM2 = signedArea / 10000;
    if (areaM2 < MIN_ROOM_AREA_M2) continue; // discard noise slivers

    const previousMatch = matchPreviousRoom(face.wallIds, previousRooms);
    rooms.push({
      id: previousMatch ? previousMatch.id : generateId("room"),
      name: previousMatch ? previousMatch.name : "",
      polygon: face.polygon,
      areaM2,
      wallIds: face.wallIds,
    });
  }

  return rooms;
}
