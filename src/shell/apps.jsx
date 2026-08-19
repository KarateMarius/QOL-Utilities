import { lazy } from "react";

// Verzeichnis aller Anwendungen. Wer eine neue hinzufuegt, traegt sie hier ein
// und legt sie unter src/apps/<id>/ ab - die Uebersicht und die Kopfleiste
// lesen alles Weitere aus diesem Eintrag.
//
// accent faerbt Kachel und Kopfleiste, damit auf einen Blick klar ist, worin
// man gerade steckt.
//
// Jede App wird per lazy() nachgeladen: die Uebersicht soll da sein, bevor
// irgendein App-Bundle uebertragen wurde.

function GrundrissIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect x="3" y="5" width="26" height="22" />
      <path d="M3 18h11M14 18V5M14 22h15" />
      <path d="M20 27v-5" className="app-icon__accent" />
    </svg>
  );
}

function AngeboteIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M17 4H6a2 2 0 0 0-2 2v11l13 13 13-13z" />
      <circle cx="10.5" cy="10.5" r="2.5" className="app-icon__accent" />
    </svg>
  );
}

export const APPS = [
  {
    id: "grundriss",
    name: "Grundriss",
    tagline: "Wohnungen zeichnen, Räume vermessen",
    accent: "#3b8fe0",
    Icon: GrundrissIcon,
    Component: lazy(() => import("../apps/grundriss/GrundrissApp.jsx")),
  },
  {
    id: "angebote",
    name: "Angebote",
    tagline: "Prospekte der Supermärkte in deiner Nähe",
    accent: "#e5271a",
    Icon: AngeboteIcon,
    Component: lazy(() => import("../apps/angebote/AngeboteApp.jsx")),
  },
];

export function getApp(appId) {
  return APPS.find((app) => app.id === appId) || null;
}
