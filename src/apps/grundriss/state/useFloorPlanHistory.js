import { useCallback, useState } from "react";
import { floorPlanReducer } from "./floorPlanReducer.js";
import { REPLACE_ALL, RESET } from "./floorPlanActions.js";

const HISTORY_LIMIT = 30; // spec requires >=20 undo steps

// Wraps floorPlanReducer with undo/redo. Snapshot-array history is
// deliberately simple (not diff/patch based): a floor plan's JSON is a few
// KB at realistic apartment scale, so keeping 30 full snapshots is
// negligible — a diff-based history would be premature complexity here.
export function useFloorPlanHistory(initialState) {
  const [history, setHistory] = useState({ past: [], present: initialState, future: [] });

  const dispatch = useCallback((action) => {
    setHistory((h) => {
      const nextPresent = floorPlanReducer(h.present, action);
      if (nextPresent === h.present) return h; // no-op action, don't pollute history

      if (action.type === REPLACE_ALL || action.type === RESET) {
        // Import/reset is a hard checkpoint: the previous history belonged
        // to a different loaded plan and shouldn't be undoable back into.
        return { past: [], present: nextPresent, future: [] };
      }

      const past = [...h.past, h.present].slice(-HISTORY_LIMIT);
      return { past, present: nextPresent, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h;
      const previous = h.past[h.past.length - 1];
      const past = h.past.slice(0, -1);
      return { past, present: previous, future: [h.present, ...h.future] };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h;
      const [next, ...rest] = h.future;
      return { past: [...h.past, h.present], present: next, future: rest };
    });
  }, []);

  return {
    state: history.present,
    dispatch,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
