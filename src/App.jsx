import { useEffect, useState } from "react";
import EditCanvas from "./components/edit/EditCanvas.jsx";
import ViewCanvas from "./components/view/ViewCanvas.jsx";
import ModeSwitch from "./components/shared/ModeSwitch.jsx";
import FileControls from "./components/shared/FileControls.jsx";
import CloudPanel from "./components/shared/CloudPanel.jsx";
import { useFloorPlanHistory } from "./state/useFloorPlanHistory.js";
import { useCloudStorage } from "./hooks/useCloudStorage.js";
import { createEmptyFloorPlan } from "./state/schema.js";
import { REPLACE_ALL, SET_PLAN_NAME } from "./state/floorPlanActions.js";
import { MODES } from "./utils/constants.js";

export default function App() {
  const [mode, setMode] = useState(MODES.EDIT);
  const { state: floorPlan, dispatch, undo, redo, canUndo, canRedo } = useFloorPlanHistory(createEmptyFloorPlan());
  const cloud = useCloudStorage();

  // Welcher gespeicherte Grundriss gerade offen ist. null = noch nie
  // gespeichert, "Speichern" legt dann einen neuen an statt zu ueberschreiben.
  const [currentPlanId, setCurrentPlanId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const [nameDraft, setNameDraft] = useState(floorPlan.meta.name);
  useEffect(() => setNameDraft(floorPlan.meta.name), [floorPlan.meta.name]);

  async function handleSave() {
    const id = await cloud.save({ id: currentPlanId, name: floorPlan.meta.name, floorPlan });
    if (id) setCurrentPlanId(id);
  }

  function handleLoad(plan) {
    dispatch({ type: REPLACE_ALL, floorPlan: plan.floorPlan });
    setCurrentPlanId(plan.id);
    setPanelOpen(false);
  }

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
        <button type="button" className="file-controls__button" onClick={() => setPanelOpen(true)}>
          {cloud.status === "ready" ? "Speichern / Öffnen" : "Anmelden"}
        </button>
        <FileControls
          floorPlan={floorPlan}
          onImport={(plan) => {
            dispatch({ type: REPLACE_ALL, floorPlan: plan });
            // Eine importierte Datei ist noch kein gespeicherter Grundriss -
            // sonst wuerde das naechste Speichern einen fremden Eintrag
            // ueberschreiben.
            setCurrentPlanId(null);
          }}
        />
      </header>
      <main className="app-main">
        {mode === MODES.EDIT ? (
          <EditCanvas floorPlan={floorPlan} dispatch={dispatch} undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo} />
        ) : (
          <ViewCanvas floorPlan={floorPlan} />
        )}
      </main>
      {panelOpen && (
        <CloudPanel
          cloud={cloud}
          currentPlanName={floorPlan.meta.name}
          currentPlanId={currentPlanId}
          onSave={handleSave}
          onLoad={handleLoad}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </div>
  );
}
