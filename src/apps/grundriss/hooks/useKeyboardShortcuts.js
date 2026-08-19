import { useEffect, useState } from "react";

function isTypingTarget(target) {
  const tag = target?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
}

// Tracks spacebar-held (for edit-mode pan) and wires undo/redo/delete/escape
// shortcuts. Ignored while focus is in a text field (e.g. the room-name
// input) so typing doesn't trigger deletes or steal the spacebar.
export function useKeyboardShortcuts({ onUndo, onRedo, onDelete, onEscape, enabled = true }) {
  const [spaceHeld, setSpaceHeld] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;

    function handleKeyDown(e) {
      if (isTypingTarget(e.target)) return;

      if (e.code === "Space") {
        e.preventDefault();
        setSpaceHeld(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) onRedo?.();
        else onUndo?.();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        onRedo?.();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onDelete?.();
        return;
      }
      if (e.key === "Escape") {
        onEscape?.();
      }
    }

    function handleKeyUp(e) {
      if (e.code === "Space") {
        setSpaceHeld(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [enabled, onUndo, onRedo, onDelete, onEscape]);

  return { spaceHeld };
}
