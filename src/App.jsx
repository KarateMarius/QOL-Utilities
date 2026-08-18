import { useEffect, useState } from "react";
import EditCanvas from "./components/edit/EditCanvas.jsx";
import ViewCanvas from "./components/view/ViewCanvas.jsx";
import ModeSwitch from "./components/shared/ModeSwitch.jsx";
import FileControls from "./components/shared/FileControls.jsx";
import { useFloorPlanHistory } from "./state/useFloorPlanHistory.js";
import { createEmptyFloorPlan } from "./state/schema.js";
import { REPLACE_ALL, SET_PLAN_NAME } from "./state/floorPlanActions.js";
import { MODES } from "./utils/constants.js";

export default function App() {
  const [mode, setMode] = useState(MODES.EDIT);
  const { state: floorPlan, dispatch, undo, redo, canUndo, canRedo } = useFloorPlanHistory(createEmptyFloorPlan());

  const [nameDraft, setNameDraft] = useState(floorPlan.meta.name);
  useEffect(() => setNameDraft(floorPlan.meta.name), [floorPlan.meta.name]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <input
          className="app-header__name"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => {
            if (nameDraft !== floorPlan.meta.name) dispatch({ type: SET_PLAN_NAME, name: nameDraft });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          aria-label="Grundriss-Name"
        />
        <ModeSwitch mode={mode} onChange={setMode} />
        <FileControls floorPlan={floorPlan} onImport={(plan) => dispatch({ type: REPLACE_ALL, floorPlan: plan })} />
      </header>
      <main className="app-main">
        {mode === MODES.EDIT ? (
          <EditCanvas floorPlan={floorPlan} dispatch={dispatch} undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo} />
        ) : (
          <ViewCanvas floorPlan={floorPlan} />
        )}
      </main>
    </div>
  );
}
