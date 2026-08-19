import { useEffect, useState } from "react";
import { cmToPx } from "../../geometry/units.js";

// Inline editable room name, positioned at the room's centroid. Renders
// directly on the canvas (not a modal) so naming a room is a single click.
// Commits on blur/Enter rather than per-keystroke, so typing a name doesn't
// spam the undo history with one entry per character.
export default function RoomNameDialog({ room, centroid, pxPerCm, onCommit }) {
  const [draft, setDraft] = useState(room.name);

  // Keeps the field in sync with external changes (undo/redo) without
  // fighting the user mid-keystroke in the common case, since room.name
  // only otherwise changes to the same value on an unrelated recompute.
  useEffect(() => {
    setDraft(room.name);
  }, [room.name]);

  function commit() {
    if (draft !== room.name) onCommit(draft);
  }

  return (
    <foreignObject
      x={cmToPx(centroid.x, pxPerCm) - 60}
      y={cmToPx(centroid.y, pxPerCm) - 12}
      width={120}
      height={24}
      style={{ overflow: "visible" }}
    >
      <input
        className="room-name-input"
        value={draft}
        placeholder="Raum benennen"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        onPointerDown={(e) => e.stopPropagation()}
      />
    </foreignObject>
  );
}
