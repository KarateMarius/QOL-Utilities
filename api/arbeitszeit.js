// Arbeitszeit: Kommen und Gehen.
//
// GET    ?monat=YYYY-MM  -> { monat, eintraege, laeuft }
// POST   { }             -> stempelt: laeuft nichts, faengt es an; laeuft
//                           etwas, beendet es. Antwortet wie GET, dazu
//                           { gebucht: "kommen" | "gehen", zeit }
// PUT    { id, beginn, ende }  -> nachtragen und berichtigen
// DELETE ?id=...               -> Eintrag loeschen
//
// Ein Schluessel je Nutzer und Monat: arbeitszeit:{nutzer}:2026-08. Ein Monat
// sind rund zwanzig Paare, also wenige hundert Bytes - das passt in einen
// Wert und spart das Zusammensuchen ueber viele Schluessel.
//
// Zeiten stehen als ISO-Zeitstempel mit Zeitzone drin, der Monat wird aber
// nach Berliner Zeit gebildet. Sonst faellt eine Schicht, die um 01:00 im
// August beginnt, im UTC-Kalender in den Juli - der Server steht in UTC.
import { requireUser, getRedis } from "./_auth.js";

const ZEITZONE = "Europe/Berlin";

/** YYYY-MM-DD bzw. YYYY-MM nach Berliner Kalender, egal wo der Server steht. */
function berlinDatum(datum) {
  const teile = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZEITZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(datum);
  return teile; // en-CA liefert 2026-08-20
}

function berlinMonat(datum) {
  return berlinDatum(datum).slice(0, 7);
}

function schluessel(nutzer, monat) {
  return `arbeitszeit:${nutzer}:${monat}`;
}

function istMonat(wert) {
  return typeof wert === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(wert);
}

function istZeit(wert) {
  return typeof wert === "string" && !Number.isNaN(Date.parse(wert));
}

async function lies(redis, nutzer, monat) {
  const roh = await redis.get(schluessel(nutzer, monat));
  if (!roh) return [];
  const liste = typeof roh === "string" ? JSON.parse(roh) : roh;
  return Array.isArray(liste) ? liste : [];
}

async function schreib(redis, nutzer, monat, eintraege) {
  eintraege.sort((a, b) => Date.parse(a.beginn) - Date.parse(b.beginn));
  await redis.set(schluessel(nutzer, monat), JSON.stringify(eintraege));
}

/** Der offene Eintrag, falls einer laeuft - gesucht wird auch im Vormonat,
    denn eine Nachtschicht faengt am 31. an und endet am 1. */
async function offenerEintrag(redis, nutzer, jetzt) {
  const monate = [berlinMonat(jetzt), berlinMonat(new Date(jetzt.getTime() - 31 * 86400000))];
  for (const monat of [...new Set(monate)]) {
    const eintraege = await lies(redis, nutzer, monat);
    const offen = eintraege.find((e) => !e.ende);
    if (offen) return { monat, eintraege, offen };
  }
  return null;
}

function antwort(monat, eintraege, laeuft, extra = {}) {
  return { monat, eintraege, laeuft, ...extra };
}

export default async function handler(req, res) {
  const nutzer = await requireUser(req, res);
  if (!nutzer) return;

  const redis = getRedis();
  const jetzt = new Date();

  if (req.method === "GET") {
    const monat = istMonat(req.query.monat) ? req.query.monat : berlinMonat(jetzt);
    const eintraege = await lies(redis, nutzer, monat);
    const offen = await offenerEintrag(redis, nutzer, jetzt);
    return res.status(200).json(antwort(monat, eintraege, offen ? offen.offen : null));
  }

  if (req.method === "POST") {
    const offen = await offenerEintrag(redis, nutzer, jetzt);

    if (offen) {
      // Feierabend: den offenen Eintrag schliessen, wo immer er liegt.
      offen.offen.ende = jetzt.toISOString();
      await schreib(redis, nutzer, offen.monat, offen.eintraege);
      const monat = berlinMonat(jetzt);
      const eintraege = monat === offen.monat ? offen.eintraege : await lies(redis, nutzer, monat);
      return res.status(200).json(
        antwort(monat, eintraege, null, { gebucht: "gehen", zeit: offen.offen.ende })
      );
    }

    const monat = berlinMonat(jetzt);
    const eintraege = await lies(redis, nutzer, monat);
    const neu = { id: `az-${jetzt.getTime()}`, beginn: jetzt.toISOString(), ende: null };
    eintraege.push(neu);
    await schreib(redis, nutzer, monat, eintraege);
    return res.status(200).json(antwort(monat, eintraege, neu, { gebucht: "kommen", zeit: neu.beginn }));
  }

  if (req.method === "PUT") {
    const { id, beginn, ende } = req.body || {};
    if (!id || !istZeit(beginn)) return res.status(400).json({ error: "Beginn fehlt" });
    if (ende !== null && ende !== undefined && !istZeit(ende)) {
      return res.status(400).json({ error: "Ende ist keine Zeit" });
    }
    if (ende && Date.parse(ende) <= Date.parse(beginn)) {
      return res.status(400).json({ error: "Das Ende liegt vor dem Beginn." });
    }

    // Der Eintrag wandert mit, wenn die Berichtigung ihn in einen anderen
    // Monat schiebt - sonst stuende er im falschen Blatt.
    const zielMonat = berlinMonat(new Date(beginn));
    const quellMonat = istMonat(req.query.monat) ? req.query.monat : zielMonat;

    const quelle = await lies(redis, nutzer, quellMonat);
    const stelle = quelle.findIndex((e) => e.id === id);
    if (stelle === -1) return res.status(404).json({ error: "Eintrag nicht gefunden" });

    const eintrag = { ...quelle[stelle], beginn, ende: ende || null };

    if (zielMonat === quellMonat) {
      quelle[stelle] = eintrag;
      await schreib(redis, nutzer, quellMonat, quelle);
    } else {
      quelle.splice(stelle, 1);
      await schreib(redis, nutzer, quellMonat, quelle);
      const ziel = await lies(redis, nutzer, zielMonat);
      ziel.push(eintrag);
      await schreib(redis, nutzer, zielMonat, ziel);
    }

    const monat = berlinMonat(jetzt);
    const eintraege = await lies(redis, nutzer, monat);
    const offen = await offenerEintrag(redis, nutzer, jetzt);
    return res.status(200).json(antwort(monat, eintraege, offen ? offen.offen : null));
  }

  if (req.method === "DELETE") {
    const id = req.query.id;
    const monat = istMonat(req.query.monat) ? req.query.monat : berlinMonat(jetzt);
    if (!id) return res.status(400).json({ error: "Kein Eintrag angegeben" });
    const eintraege = await lies(redis, nutzer, monat);
    const rest = eintraege.filter((e) => e.id !== id);
    if (rest.length === eintraege.length) return res.status(404).json({ error: "Eintrag nicht gefunden" });
    await schreib(redis, nutzer, monat, rest);
    const offen = await offenerEintrag(redis, nutzer, jetzt);
    return res.status(200).json(antwort(monat, rest, offen ? offen.offen : null));
  }

  return res.status(405).end();
}
