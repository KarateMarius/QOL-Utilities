import React from "react";
import ReactDOM from "react-dom/client";
import Desktop from "./os/Desktop.jsx";
import { lockViewport } from "./os/lockViewport.js";
import { registerServiceWorker } from "./apps/angebote/lib/push.js";
import "./styles/os.css";

// Globales Seitenverhalten, kein Komponenten-Zustand - daher hier und nicht
// in einem Effekt. Der Desktop soll sich wie eine Anwendung anfuehlen und
// nicht wie eine Webseite, die man wegwischen kann.
lockViewport();

// Der Service Worker gehoert zur Herkunft, nicht zu einer App: er muss auch
// dann bereitstehen, wenn die Angebote gerade nicht offen sind - sonst kaeme
// nach einem Neuladen keine Benachrichtigung mehr an.
registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Desktop />
  </React.StrictMode>
);
