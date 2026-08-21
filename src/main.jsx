import React from "react";
import ReactDOM from "react-dom/client";
import Shell from "./shell/Shell.jsx";
import { vorladen } from "./shell/apps.jsx";
import { lockViewport } from "./shell/lockViewport.js";
import { registerServiceWorker } from "./push.js";
import "./styles/shell.css";

// Zuerst das, worauf gewartet wird: steht in der Adresse schon eine App
// (#arbeitszeit), gehen ihr Buendel und ihre erste Anfrage jetzt raus - nicht
// erst, wenn React sie rendert, und schon gar nicht erst hinter der
// Anmeldung. Das Netz hat dadurch alles gleichzeitig zu tun statt der Reihe
// nach; am Handy ist die Reihe nach der ganze Unterschied.
vorladen(window.location.hash.replace(/^#/, ""));

// Globales Seitenverhalten, kein Komponenten-Zustand - daher hier und nicht
// in einem Effekt. Die Seite soll sich wie eine Anwendung anfuehlen und nicht
// wie eine Webseite, die man wegwischen kann.
lockViewport();

// Der Service Worker gehoert zur Herkunft, nicht zu einer App: er muss auch
// dann bereitstehen, wenn die Angebote gerade nicht offen sind - sonst kaeme
// nach einem Neuladen keine Benachrichtigung mehr an.
registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Shell />
  </React.StrictMode>
);
