// Prueft die Preisalarme im taeglichen Lauf.
//
// Gemeldet wird der Uebergang: faellt der guenstigste offene Preis unter die
// Marke, kommt eine Nachricht. Bleibt er unten, kommt keine weitere - sonst
// stuende jeden Morgen dieselbe Meldung auf dem Schirm. Steigt er wieder
// darueber, ist der Alarm fuer das naechste Mal scharf.
//
// Einmal am Tag ist die Grenze des Hobby-Tarifs (ein Cron-Lauf). Das ist eine
// Morgenmeldung, keine Live-Warnung.
import { fetchStations } from "./_tankerkoenig.js";
import { sendToAll } from "../angebote/_push.js";

const NAMEN = { diesel: "Diesel", e5: "Super E5", e10: "Super E10" };

function preisText(preis) {
  return `${preis.toFixed(3).replace(".", ",")} €`;
}

/**
 * @param profile  Nutzerprofil mit tankalarm und subscriptions
 * @returns {{ geaendert: boolean, profile: object, bericht: object|null }}
 */
export async function pruefeTankalarm(profile) {
  const alarm = profile.tankalarm;
  if (!alarm?.schwelle) return { geaendert: false, profile, bericht: null };

  const { stations } = await fetchStations({
    plz: alarm.plz,
    type: alarm.typ,
    radius: alarm.radius,
  }).catch(() => ({ stations: [] }));

  // Nur offene Stationen: an einer geschlossenen nuetzt der beste Preis nichts.
  const offen = stations.filter((s) => s.open && s.price > 0);
  if (!offen.length) return { geaendert: false, profile, bericht: { alarm: alarm.typ, stationen: 0 } };

  const guenstigste = offen.reduce((a, b) => (b.price < a.price ? b : a));
  const unterhalb = guenstigste.price <= alarm.schwelle;
  const bericht = {
    alarm: alarm.typ,
    stationen: offen.length,
    bester: guenstigste.price,
    unterhalb,
    gemeldet: false,
  };

  // Nur der Wechsel von "darueber" nach "darunter" wird gemeldet.
  if (unterhalb && !alarm.unterhalb && profile.subscriptions?.length) {
    const result = await sendToAll(profile.subscriptions, {
      title: `${NAMEN[alarm.typ] || alarm.typ} bei ${preisText(guenstigste.price)}`,
      body: `${guenstigste.brand} ${guenstigste.name}, ${guenstigste.distance} km — unter deiner Marke von ${preisText(alarm.schwelle)}.`,
      tag: "tankalarm",
    });
    bericht.gemeldet = true;
    bericht.gesendet = result.sent;
    return {
      geaendert: true,
      profile: { ...profile, subscriptions: result.subscriptions, tankalarm: { ...alarm, unterhalb } },
      bericht,
    };
  }

  if (unterhalb !== alarm.unterhalb) {
    return { geaendert: true, profile: { ...profile, tankalarm: { ...alarm, unterhalb } }, bericht };
  }

  return { geaendert: false, profile, bericht };
}
