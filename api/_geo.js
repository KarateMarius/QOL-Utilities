// Postleitzahl zu Koordinaten.
//
// Mehrere Apps brauchen das (Prospekte, Tankpreise), deshalb steht es hier
// und nicht in einer davon.
//
// Warum ausgerechnet der Ortsdienst von Marktguru: er ist ohne Schluessel
// erreichbar, liefert fuer deutsche Postleitzahlen verlaessliche Werte und ist
// im Angebotstracker seit Beginn im Einsatz.
//
// Geprueft und verworfen: api.zippopotam.us. Der Dienst vertauscht in seinen
// deutschen Daten Felder - fuer 48155 steht der Breitengrad unter "longitude"
// und unter "latitude" eine Zahl, die keine ist. Bei anderen Postleitzahlen
// stimmt es. Ein Ortsdienst, der manchmal recht hat, ist schlimmer als
// keiner: er wuerde stillschweigend Ergebnisse aus der falschen Stadt liefern.

const LOCATIONS_URL = "https://api.marktguru.de/api/v1/locations";
const APIKEY_DEFAULT = "8Kk+pmbf7TgJ9nVj2cXeA7P5zBGv8iuutVVMRfOfvNE=";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export const FALLBACK = { lat: 51.9625, lng: 7.6252, place: "Münster" };

/** Liefert { lat, lng, place }. Bei Misserfolg den Rueckfallort. */
export async function locate(plz) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const url = new URL(LOCATIONS_URL);
    url.searchParams.set("as", "mobile");
    url.searchParams.set("limit", "1");
    url.searchParams.set("q", plz);

    const res = await fetch(url, {
      headers: {
        "x-apikey": process.env.MARKTGURU_APIKEY || APIKEY_DEFAULT,
        "user-agent": USER_AGENT,
        referer: "https://www.marktguru.de/",
        accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!res.ok) return FALLBACK;

    const hit = (await res.json())?.results?.[0];
    if (!hit) return FALLBACK;

    const lat = Number(hit.latitude);
    const lng = Number(hit.longitude);
    // Deutschland liegt zwischen 47 und 56 Grad Nord, 5 und 16 Grad Ost.
    // Alles andere ist ein Datenfehler, kein Ort.
    if (!(lat > 47 && lat < 56 && lng > 5 && lng < 16)) return FALLBACK;

    return { lat, lng, place: hit.name || hit.city || "" };
  } catch {
    return FALLBACK;
  } finally {
    clearTimeout(timer);
  }
}
