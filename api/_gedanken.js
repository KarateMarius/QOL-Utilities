// Gedanken: Ablage und Zustellung.
//
// Getrennt vom Endpunkt, weil zwei Seiten hineingreifen - die App selbst und
// der taegliche Lauf, der die faelligen Gedanken meldet.
//
// Ein Schluessel je Nutzer: gedanken:{nutzer}. Anders als bei der Arbeitszeit
// bewusst nicht je Monat: hier blaettert man zurueck, und ein Zettel von vor
// einem halben Jahr soll dastehen, ohne dass jemand einen Monat auswaehlt.
// Ein Gedanke sind rund hundert Bytes - das traegt einige Jahre, und wenn es
// eines Tages nicht mehr traegt, ist das an dieser Stelle zu aendern.
//
// Die Geraete stehen nicht hier, sondern im Konto-Profil der Angebote. Das
// ist kein Versehen: ein angemeldetes Geraet gehoert dem Konto, nicht einer
// App - dieselbe Begruendung steht in src/push.js.
import { getRedis } from "./_auth.js";
import { berlinDatum } from "./_zeit.js";
import { sendToAll } from "./angebote/_push.js";
import { readProfile, writeProfile } from "./angebote/_store.js";

const NUTZER = "gedanken:users";

function schluessel(nutzer) {
  return `gedanken:${nutzer}`;
}

export async function lies(nutzer) {
  const roh = await getRedis().get(schluessel(nutzer));
  if (!roh) return [];
  const liste = typeof roh === "string" ? JSON.parse(roh) : roh;
  return Array.isArray(liste) ? liste : [];
}

export async function schreib(nutzer, gedanken) {
  const redis = getRedis();
  await redis.set(schluessel(nutzer), JSON.stringify(gedanken));
  // Eigene Nutzerliste statt der von den Angeboten: dort steht nur, wer je
  // ein Profil geschrieben hat. Wer nur Gedanken aufschreibt, waere sonst im
  // taeglichen Lauf unsichtbar und bekaeme nie eine Erinnerung.
  await redis.sadd(NUTZER, nutzer);
}

export async function listeNutzer() {
  try {
    const nutzer = await getRedis().smembers(NUTZER);
    return Array.isArray(nutzer) ? nutzer : [];
  } catch {
    return [];
  }
}

/** Die Meldung selbst. Eigener tag je Gedanke, sonst schiebt der Browser die
    zweite ueber die erste - sie sollen nebeneinander stehenbleiben. */
export async function melde(nutzer, gedanke, titel) {
  const profil = await readProfile(nutzer);
  // Warum es nicht ging, wird zurueckgegeben und nicht verschluckt. Eine App,
  // die "Notiz an dich" verspricht und dann stillschweigend nichts schickt,
  // ist schlimmer als eine, die sagt, dass der Weg fehlt.
  if (!profil.subscriptions?.length) return { gesendet: 0, grund: "kein_geraet" };

  const ergebnis = await sendToAll(profil.subscriptions, {
    title: titel,
    body: gedanke.text,
    tag: `gedanke-${gedanke.id}`,
    url: "/#gedanken",
  });

  // sendToAll gibt die Geraete zurueck, die noch antworten - abgemeldete
  // fallen dabei raus. Nur dann zurueckschreiben: die Liste ist immer eine
  // neue, ein Vergleich auf Gleichheit wuerde bei jeder Meldung schreiben.
  if (ergebnis.subscriptions.length !== profil.subscriptions.length) {
    await writeProfile(nutzer, { ...profil, subscriptions: ergebnis.subscriptions });
  }
  if (ergebnis.sent) return { gesendet: ergebnis.sent, grund: "ok" };
  return { gesendet: 0, grund: ergebnis.error ? "nicht_eingerichtet" : "fehlgeschlagen" };
}

/** Alles, was heute oder frueher faellig ist und noch nicht gemeldet wurde.
    Frueher deshalb, weil ein ausgefallener Lauf sonst einen Gedanken fuer
    immer verschluckte - lieber einen Tag zu spaet als gar nicht. */
export async function meldeFaellige(nutzer, jetzt = new Date()) {
  const heute = berlinDatum(jetzt);
  const gedanken = await lies(nutzer);
  const faellig = gedanken.filter((g) => !g.gemeldet && g.faellig && g.faellig <= heute);
  if (!faellig.length) return null;

  let gesendet = 0;
  for (const gedanke of faellig) {
    const ergebnis = await melde(nutzer, gedanke, "Erinnerung");
    gesendet += ergebnis.gesendet;
    gedanke.gemeldet = jetzt.toISOString();
  }

  await schreib(nutzer, gedanken);
  return { faellig: faellig.length, gesendet };
}
