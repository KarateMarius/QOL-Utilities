# QOL-Utilities

Kleine Werkzeuge für den Alltag unter einer Oberfläche. Die Übersicht zeigt,
was da ist; ein Klick öffnet die Anwendung bildschirmfüllend, „Übersicht"
führt zurück. Welche App offen ist, steht in der Adresse (`#angebote`) —
damit funktionieren Zurück-Knopf und Lesezeichen.

| App | Was sie tut |
|---|---|
| **Grundriss** | Wohnungen zeichnen, Räume vermessen, Installationen setzen, in der Cloud speichern |
| **Angebote** | Prospekte der Supermärkte, Rabatte aus Online-Shops, Preisverlauf, Einkaufskorb, Watchlist mit Push aufs Handy |
| **Tanken** | Spritpreise in der Umgebung, nach Preis sortiert, mit Route |

## Wie es aufgebaut ist

```
api/
  _auth.js              Session, Nutzerliste, Redis-Zugang (von allen genutzt)
  me.js                 Wer ist angemeldet?
  login.js              An- und Abmelden
  plans.js              Gespeicherte Grundrisse
  angebote/
    deals.js            Prospekt-Angebote einer PLZ plus Shop-Rabatte
    watchlist.js        Suchwörter und PLZ eines Nutzers
    push.js             Geräte anmelden, Korb und Tests verschicken
    history.js          Preisverlauf beobachteter Produkte
    cron.js             Täglicher Scan, meldet neue Treffer, schreibt Preise mit
    _scraper.js         Marktguru und Kaufda
    _shops.js           Online-Shops über Shopifys /products.json
    _history.js         Preisverlauf: Schlüssel, Aufzeichnung, Tiefstpreis
    _categorize.js      Kategorien nach Stichwortlisten
    _pricing.js         Grundpreis (€ je kg · l · Stück)
    _store.js           Ablage in Upstash Redis
    _push.js            Web Push per VAPID
    _match.js           Abgleich Angebote gegen Watchlist

api/
  _geo.js               Postleitzahl zu Koordinaten (von mehreren genutzt)
  tanken/
    stations.js         Spritpreise einer PLZ, 5 Minuten Cache
    _tankerkoenig.js    Anbindung an Tankerkönig

src/
  shell/                Übersicht, Kopfleiste, Anmeldung, Helligkeit
  styles/tokens.css     Farben, Schrift, Radien, Abstände — eine Quelle
  apps/grundriss/       die Grundriss-App
  apps/angebote/        die Angebote-App
  styles/shell.css      der Rahmen um die Apps
```

Dateien in `api/` mit `_`-Präfix sind für Vercel keine Endpunkte, sondern nur
Module — so liegen geteilte Bausteine neben den Routen, die sie benutzen.

### Eine App hinzufügen

1. Ordner unter `src/apps/<id>/` anlegen, Komponente als Default-Export.
2. Eintrag in `src/shell/apps.jsx`: Name, Beschreibung, Akzentfarbe, Icon.
   Mehr braucht der Rahmen nicht.
3. Eigenes CSS in der App importieren und **unter einer Wurzelklasse kapseln**
   (`.meine-app .card { … }`). Klassennamen wie `.card` oder `.grid` gehören
   keiner App allein — die Angebote-App macht das vor.
4. Farben, Schrift, Radien und Abstände aus `styles/tokens.css` nehmen, keine
   Rohwerte schreiben. Dann stimmt der Dunkelmodus von allein.

## Entwickeln

```bash
npm install
npm run dev          # nur Oberfläche, http://localhost:5173
vercel dev           # mit den Serverless-Funktionen unter /api
```

Ohne Backend bleiben beide Apps benutzbar — nur Speichern, Watchlist und
Benachrichtigungen brauchen eine Anmeldung.

### Optik ansehen ohne Server

```bash
node scripts/make-preview.mjs   # schreibt dist/preview.html
```

Eine einzelne Datei mit erfundenen Serverantworten, die sich per Doppelklick
öffnen lässt.

## Betrieb

### Umgebungsvariablen

Siehe `.env.example`. Neu gegenüber der reinen Grundriss-App sind die
VAPID-Schlüssel und `CRON_SECRET`:

```bash
node scripts/generate-vapid-keys.mjs
```

Für Produktion eigene Schlüssel nehmen — wer den privaten Schlüssel hat, kann
Benachrichtigungen in deinem Namen verschicken.

### Push auf dem Handy

- **Android:** Seite öffnen, anmelden, in der Watchlist einschalten.
- **iOS:** erst in **Safari** öffnen, über Teilen → „Zum Home-Bildschirm"
  installieren, die App von dort starten, dann einschalten. iOS liefert Web
  Push ausschließlich an installierte PWAs, ab iOS 16.4.

Push braucht HTTPS. Über `http://192.168.x.x` im lokalen Netz blockiert der
Browser Service Worker und damit Benachrichtigungen.

### Täglicher Scan

`vercel.json` registriert einen Cron auf `/api/angebote/cron` um 05:00 UTC.
Der Job lädt je genutzter PLZ die Prospekte neu, gleicht sie gegen alle
Watchlists ab und meldet nur Treffer, die beim letzten Lauf noch nicht dabei
waren. Der Hobby-Plan erlaubt einen Lauf pro Tag.

## Online-Shops

`_shops.js` liest den Katalog über Shopifys `/products.json` — mit Preis,
Streichpreis, Lieferbarkeit und Gewicht. Daraus entstehen belegte Rabatte statt
geschätzter, und aus dem Gewicht fällt der Kilopreis ab. Ausverkauftes fliegt
raus.

Einen Shop aufnehmen: Zeile in `SHOPS` ergänzen und prüfen, ob
`<basis>/products.json` antwortet. Getestet: ESN, More Nutrition.

**Was nicht erfasst wird:** Gutschein-Kampagnen („mit Code ESN -25% auf
Vitalstoffe") senken den gelisteten Preis nicht und stehen nicht im Katalog.
Sie von der Startseite zu lesen wurde geprüft und verworfen: die Texte liegen
dort als Vorrat in vier Sprachen ohne Gültigkeitszeitraum — eine gelaufene
Messeaktion ist von einer heutigen nicht zu unterscheiden.

## Tankpreise

Quelle ist [Tankerkönig](https://tankerkoenig.de), das die Meldungen der
Markttransparenzstelle für Kraftstoffe weitergibt — die Preise also, die
Tankstellen gesetzlich melden müssen.

Ein eigener Schlüssel ist kostenlos und gehört in `TANKERKOENIG_APIKEY`. Ohne
ihn läuft die App mit dem Demo-Schlüssel aus der Dokumentation: Namen, Marken,
Entfernungen und Öffnungszeiten stimmen, die Preise sind für alle Stationen
derselbe Platzhalter. Die App sagt das oben deutlich.

Der Cache hält fünf Minuten — Tankerkönig bittet darum, dieselbe Abfrage nicht
häufiger zu stellen, und Preise ändern sich nicht sekündlich.

## Preisverlauf

Ein Rabatt allein sagt wenig: -30% auf einen vorher angehobenen Preis ist kein
Angebot. Der Cron-Lauf schreibt deshalb täglich den günstigsten Preis
beobachteter Produkte mit, die App zeigt den Tiefstpreis der letzten 30 Tage.

Beobachtet wird nur, was jemanden angeht: was im Korb liegt, was die Watchlist
trifft und was aus einem Shop kommt. Wonach die App fragt, das wird zugleich
vorgemerkt.

Der Schlüssel darf nicht die Angebots-ID sein — Prospekte vergeben jede Woche
neue. Stattdessen Händler plus normalisierter Name (`rewe|hähnchenbrustfilet`),
bei Shops die stabile Varianten-ID.

**Der Verlauf beginnt am Tag der ersten Beobachtung.** Rückwirkend gibt es
nirgends Daten. Die Oberfläche nennt deshalb immer den tatsächlichen Zeitraum:
„Tief 30 Tage" erst nach 30 Tagen, vorher „Tief 6 Tage".

## Daten

Alles liegt in derselben Upstash-Datenbank wie der Trainer:

| Schlüssel | Inhalt |
|---|---|
| `auth:users` | Nutzerliste (schreibt nur der Trainer) |
| `user:{id}:grundriss` | gespeicherte Grundrisse |
| `user:{id}:angebote` | PLZ, Watchlist, angemeldete Geräte |
| `angebote:deals:{plz}` | Prospekt-Cache, 6 Stunden, für alle Nutzer gemeinsam |
| `angebote:users` | wer den Angebotstracker nutzt (für den Cron-Job) |
| `angebote:shops` | Rabatte der Online-Shops, 3 Stunden, bundesweit |
| `angebote:hist:{key}` | Preisverlauf eines beobachteten Produkts, 60 Tage |

Ein PLZ-Cache sind rund 1,3 MB JSON und damit mehr, als eine Upstash-Anfrage
im Gratis-Tarif transportiert. `_store.js` packt größere Werte deshalb
transparent mit gzip, bevor sie geschrieben werden.

## Bekannte Grenzen

- **Scraping:** Marktguru und Kaufda haben keine offizielle API. Ändern sie
  ihre Endpunkte, bricht der Scraper. Von Rechenzentrums-IPs aus können sie
  strenger filtern als von einem Heimanschluss — falls nach einem Deploy keine
  Angebote ankommen, liegt es vermutlich daran.
- **Rabatt-Anzeige:** nur wo die Quelle einen Vorher-Preis mitliefert. Bei
  Supermärkten selten, bei Shopify-Shops zuverlässig.
- **Tiefstpreis:** so alt wie die Beobachtung. Ein frisch aufgenommenes Produkt
  hat einen Datenpunkt, und der ist der aktuelle Preis.
- **Zwei Anmelde-Wege:** Die Grundriss-App bringt ihr eigenes Anmeldefeld im
  Speichern-Dialog mit, zusätzlich zu dem in der Übersicht. Beide führen zum
  selben Konto; zusammengelegt ist das noch nicht.
