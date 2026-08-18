import { angleOf } from "./geometry.js";

// Precision used to decide whether two wall endpoints are "the same" node.
// Endpoints only coincide exactly because snapping.js already rounded them
// onto the grid/other-endpoint — this is not a general geometric merge.
const NODE_KEY_PRECISION = 0.01;

function nodeKey(point) {
  const round = (v) => Math.round(v / NODE_KEY_PRECISION) * NODE_KEY_PRECISION;
  return `${round(point.x)},${round(point.y)}`;
}

// Builds a planar graph from a set of walls: nodes are unique (post-snap)
// endpoint coordinates, edges are walls stored as directed half-edges (one
// entry per direction) so face-tracing in roomDetection.js can walk them.
// Each vertex's outgoing half-edges are pre-sorted by angle, which is what
// the face-tracing "next edge" rule relies on.
export function buildGraph(walls) {
  const nodes = new Map(); // key -> {x, y}
  const adjacency = new Map(); // key -> [{targetKey, wallId, angle}]

  function ensureNode(point) {
    const key = nodeKey(point);
    if (!nodes.has(key)) {
      nodes.set(key, { x: point.x, y: point.y });
      adjacency.set(key, []);
    }
    return key;
  }

  for (const wall of walls) {
    const startKey = ensureNode(wall.start);
    const endKey = ensureNode(wall.end);
    if (startKey === endKey) continue; // zero-length wall after snapping, ignore

    adjacency.get(startKey).push({
      targetKey: endKey,
      wallId: wall.id,
      angle: angleOf(wall.start, wall.end),
    });
    adjacency.get(endKey).push({
      targetKey: startKey,
      wallId: wall.id,
      angle: angleOf(wall.end, wall.start),
    });
  }

  for (const edges of adjacency.values()) {
    edges.sort((a, b) => a.angle - b.angle);
  }

  return { nodes, adjacency };
}
