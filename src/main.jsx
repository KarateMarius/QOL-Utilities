import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { lockViewport } from "./utils/lockViewport.js";
import "./styles/index.css";

// Globales Seitenverhalten, kein Komponenten-Zustand - daher hier und nicht
// in einem Effekt in App.
lockViewport();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
