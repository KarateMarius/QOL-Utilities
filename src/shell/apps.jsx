import { lazy } from "react";
import { starteVorlauf } from "../apps/arbeitszeit/vorlauf.js";

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

function TankenIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M5 28V6a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v22M3 28h17" />
      <path d="M8 9h7v5H8z" className="app-icon__accent" />
      <path d="M18 12h4a2 2 0 0 1 2 2v9a2 2 0 0 0 4 0V13l-3-3" />
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

function ArbeitszeitIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="17" r="11" />
      <path d="M16 11v6l4 3" className="app-icon__accent" />
      <path d="M12 3h8" />
    </svg>
  );
}

// laden ist dieselbe Funktion, die auch lazy() bekommt: wer sie vorab aufruft,
// stoesst genau den Import an, auf den React spaeter wartet - der Browser hat
// das Buendel dann schon, wenn gerendert wird.
const ladeGrundriss = () => import("../apps/grundriss/GrundrissApp.jsx");
const ladeAngebote = () => import("../apps/angebote/AngeboteApp.jsx");
const ladeTanken = () => import("../apps/tanken/TankenApp.jsx");
const ladeArbeitszeit = () => import("../apps/arbeitszeit/ArbeitszeitApp.jsx");

export const APPS = [
  {
    id: "grundriss",
    name: "Grundriss",
    tagline: "Wohnungen zeichnen, Räume vermessen",
    accent: "#3b8fe0",
    Icon: GrundrissIcon,
    laden: ladeGrundriss,
    Component: lazy(ladeGrundriss),
  },
  {
    id: "angebote",
    name: "Angebote",
    tagline: "Prospekte der Supermärkte in deiner Nähe",
    accent: "#e5271a",
    Icon: AngeboteIcon,
    laden: ladeAngebote,
    Component: lazy(ladeAngebote),
  },
  {
    id: "tanken",
    name: "Tanken",
    tagline: "Spritpreise in deiner Umgebung, nach Preis sortiert",
    accent: "#0f857f",
    Icon: TankenIcon,
    laden: ladeTanken,
    Component: lazy(ladeTanken),
  },
  {
    id: "arbeitszeit",
    name: "Arbeitszeit",
    tagline: "Kommen und Gehen, ein Knopf",
    accent: "#6b4ee6",
    Icon: ArbeitszeitIcon,
    laden: ladeArbeitszeit,
    Component: lazy(ladeArbeitszeit),
    vorlauf: starteVorlauf,
  },
];

export function getApp(appId) {
  return APPS.find((app) => app.id === appId) || null;
}

/** Steht die App schon in der Adresse, faengt ihr Weg hier an - nicht erst
    beim ersten Rendern. Buendel und, wo die App das anbietet, auch die erste
    Anfrage laufen dann parallel zur Anmeldung statt hinter ihr. */
export function vorladen(appId) {
  const app = getApp(appId);
  if (!app) return;
  app.laden();
  app.vorlauf?.();
}

