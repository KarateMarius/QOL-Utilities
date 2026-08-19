# QOL-Utilities

Kleine Werkzeuge für den Alltag unter einer Oberfläche. Der Startbildschirm
zeigt, was da ist; jede Anwendung läuft in einem eigenen Fenster, das sich
verschieben, minimieren und schließen lässt.

| App | Was sie tut |
|---|---|
| **Grundriss** | Wohnungen zeichnen, Räume vermessen, Installationen setzen, in der Cloud speichern |
| **Angebote** | Prospekte der Supermärkte in der Umgebung, Einkaufskorb, Watchlist mit Push aufs Handy |

## Wie es aufgebaut ist

```
api/
  _auth.js              Session, Nutzerliste, Redis-Zugang (von allen genutzt)
  me.js                 Wer ist angemeldet?
  login.js              An- und Abmelden
  plans.js              Gespeicherte Grundrisse
  angebote/
    deals.js            Prospekt-Angebote einer PLZ
    watchlist.js        Suchwörter und PLZ eines Nutzers
    push.js             Geräte anmelden, Korb und Tests verschicken
    cron.js             Täglicher Scan, meldet neue Treffer
    _scraper.js         Marktguru und Kaufda
    _categorize.js      Kategorien nach Stichwortlisten
    _pricing.js         Grundpreis (€ je kg · l · Stück)
    _store.js           Ablage in Upstash Redis
    _push.js            Web Push per VAPID
    _match.js           Abgleich Angebote gegen Watchlist

src/
  os/                   Desktop, Fenster, Taskleiste, Anmeldung
  apps/grundriss/       die Grundriss-App
  apps/angebote/        die Angebote-App
  styles/os.css         Oberfläche des Systems
```

Dateien in `api/` mit `_`-Präfix sind für Vercel keine Endpunkte, sondern nur
Module — so liegen geteilte Bausteine neben den Routen, die sie benutzen.

### Eine App hinzufügen

1. Ordner unter `src/apps/<id>/` anlegen, Komponente als Default-Export.
2. Eintrag in `src/os/apps.jsx`: Name, Beschreibung, Akzentfarbe, Icon,
   Wunschgröße. Mehr braucht der Desktop nicht.
3. Eigenes CSS in der App importieren und **unter einer Wurzelklasse kapseln**
   (`.meine-app .card { … }`). Klassennamen wie `.card` oder `.grid` gehören
   keiner App allein — die Angebote-App macht das vor.

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

## Daten

Alles liegt in derselben Upstash-Datenbank wie der Trainer:

| Schlüssel | Inhalt |
|---|---|
| `auth:users` | Nutzerliste (schreibt nur der Trainer) |
| `user:{id}:grundriss` | gespeicherte Grundrisse |
| `user:{id}:angebote` | PLZ, Watchlist, angemeldete Geräte |
| `angebote:deals:{plz}` | Prospekt-Cache, 6 Stunden, für alle Nutzer gemeinsam |
| `angebote:users` | wer den Angebotstracker nutzt (für den Cron-Job) |

Ein PLZ-Cache sind rund 1,3 MB JSON und damit mehr, als eine Upstash-Anfrage
im Gratis-Tarif transportiert. `_store.js` packt größere Werte deshalb
transparent mit gzip, bevor sie geschrieben werden.

## Bekannte Grenzen

- **Scraping:** Marktguru und Kaufda haben keine offizielle API. Ändern sie
  ihre Endpunkte, bricht der Scraper. Von Rechenzentrums-IPs aus können sie
  strenger filtern als von einem Heimanschluss — falls nach einem Deploy keine
  Angebote ankommen, liegt es vermutlich daran.
- **Rabatt-Anzeige:** nur wo die Quelle einen Vorher-Preis mitliefert. Bei
  Supermärkten selten, bei Elektronik häufig.
- **Zwei Anmelde-Wege:** Die Grundriss-App bringt ihr eigenes Anmeldefeld im
  Speichern-Dialog mit, zusätzlich zu dem in der Taskleiste. Beide führen zum
  selben Konto; zusammengelegt ist das noch nicht.
