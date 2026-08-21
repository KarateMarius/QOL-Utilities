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
| **Gedanken** | Einseitiger Chat mit sich selbst: aufschreiben, sofort aufs Handy melden oder für einen Tag vormerken |
| **Anschaffungen** | Was für eine leere Wohnung fehlt, was es kosten darf, was man dafür gesehen hat — mit Prospekten der Möbel-, Technik- und Baumärkte |

## Anmeldung

Der Dienst steht nicht offen. Ohne Session gibt es weder Übersicht noch App,
und **jeder Daten-Endpunkt antwortet mit 401** — das ist der Riegel, der
Anmeldebildschirm tut nur nicht so, als gäbe es etwas zu sehen.

Offen bleiben nur `/api/login` und `/api/me` (ohne sie käme niemand hinein)
sowie `/api/angebote/cron`, den weiterhin das `CRON_SECRET` schützt.

Es ist dieselbe Nutzerliste wie im Trainer und dieselbe Upstash-Datenbank, aber
ein eigenes Cookie mit eigenem `SESSION_SECRET` — Cookies lassen sich zwischen
zwei `*.vercel.app`-Adressen ohnehin nicht teilen.

Anders als der Trainer geht das hier nicht über Edge-Middleware. Die schützt
dort einzelne Seiten und leitet auf die Anmeldeseite um; bei einer
Einzelseiten-App wäre eine Umleitung von `/` auf `/` eine Schleife.

Läuft die Sitzung während der Nutzung ab, meldet die betroffene App ein
`qol:unauthorized`-Ereignis; der Rahmen fragt den Status neu ab und zeigt bei
Bedarf wieder den Anmeldebildschirm.

## Wie es aufgebaut ist

```
api/                    acht geroutete Endpunkte — mehr erlaubt der Hobby-Tarif
  _auth.js              Session, Nutzerliste, Redis-Zugang (von allen genutzt)
  _kv.js                Lesen/Schreiben in Upstash, packt große Werte mit gzip
  _geo.js               Postleitzahl zu Koordinaten (von mehreren genutzt)
  _zeit.js              Berliner Kalender, egal wo der Server steht
  session.js            GET wer bin ich · POST anmelden · DELETE abmelden
    _wer.js  _anmelden.js
  plans.js              Gespeicherte Grundrisse
  arbeitszeit.js        Kommen und Gehen
  gedanken.js           Einseitiger Chat mit sich selbst
  _gedanken.js          Ablage und Zustellung der Gedanken
  angebote/
    index.js            ?was=prospekte · preisverlauf · geraete · rezepte · watchlist
    _prospekte.js       Prospekt-Angebote einer PLZ plus Shop-Rabatte
    _watchlist.js       Suchwörter und PLZ eines Nutzers
    _geraete.js         Geräte anmelden, Korb und Tests verschicken
    _preisverlauf.js    Preisverlauf beobachteter Produkte
    _rezepte.js         Rezepte zur Einkaufsliste
    cron.js             Täglicher Lauf: Prospekte, Tankalarm, fällige Gedanken
    _scraper.js         Marktguru und Kaufda, je Zielgruppe
    _shops.js           Online-Shops über Shopifys /products.json
    _history.js         Preisverlauf: Schlüssel, Aufzeichnung, Tiefstpreis
    _categorize.js      Kategorien nach Stichwortlisten
    _pricing.js         Grundpreis (€ je kg · l · Stück)
    _store.js           Schlüssel und Profile des Angebotstrackers
    _push.js            Web Push per VAPID
    _match.js           Abgleich Angebote gegen Watchlist
  tanken/
    index.js            ?was=stationen · alarm
    _stationen.js       Spritpreise einer PLZ, 5 Minuten Cache
    _preisalarm.js      Schwelle setzen und lesen
    _tankerkoenig.js    Anbindung an Tankerkönig
    _alarm.js  _ausland.js  _verlauf.js
  anschaffung/
    index.js            ?was=posten · prospekte
    _posten.js          Die Liste: was fehlt, was es kosten darf
    _prospekte.js       Angebote der Möbel-, Technik- und Baumärkte
    _haeuser.js         welche Häuser gefragt werden
    _erkennen.js        ist das eine Anschaffung, und welcher Art?
    _store.js           Posten und Prospekt-Speicher

src/
  shell/                Übersicht, Kopfleiste, Anmeldung, Helligkeit
  icons.jsx             gezeichnete Symbole, von allen Apps genutzt
  styles/tokens.css     Farben, Schrift, Radien, Abstände — eine Quelle
  apps/<id>/            je App ein Ordner, eingetragen in shell/apps.jsx
  styles/shell.css      der Rahmen um die Apps
```

**Ein Endpunkt je App.** Der Hobby-Tarif erlaubt zwölf Serverless Functions je
Auslieferung, und Vercel zählt Dateien, nicht Aufgaben — bei fünfzehn schlug
die Auslieferung fehl. Deshalb führt je App ein `index.js` hin und ein
`?was=`-Parameter weiter; die Handler liegen unverändert daneben und tragen
nur einen Unterstrich, damit sie nicht einzeln geroutet werden. Wer eine App
hinzufügt, kommt mit einer Funktion aus — aktuell sind acht von zwölf belegt.

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

## Wochenvergleich

Neben der Zahl der Angebote steht, wie viele es zuletzt waren. Diese Zahl
entsteht **im Browser**, Woche für Woche, während die App benutzt wird — der
Server hält nur den aktuellen Prospekt, rückwirkend gibt es sie nirgends.

Daraus folgen zwei Dinge, beide Absicht:

- In der ersten Woche steht dort nichts. Eine Null zu behaupten wäre gelogen.
- Verglichen wird mit der zuletzt *gesehenen* Woche, nicht stur mit KW minus
  eins. Wer zwei Wochen nicht hereinschaut, bekommt den Vergleich zu der
  Woche, die er zuletzt gesehen hat — und die Oberfläche nennt deren Nummer.

Je Postleitzahl getrennt: ein anderer Ort hat andere Prospekte.

Der Einkaufskorb sortiert innerhalb eines Ladens nach dem Weg durch den Laden
(`LADENWEG` in `lib/api.js`) statt nach der Reihenfolge des Antippens. Und was
mindestens zweimal im Korb lag, schlägt die Watchlist als Suchwort vor —
dasselbe normalisierte Wort, gegen das der tägliche Scan ohnehin vergleicht.

## Spritpreis im Ausland

Unter der Stationsliste steht der **Landesdurchschnitt für Tschechien**. Kein
Preis einer einzelnen Tankstelle — und die Zeile sagt das an drei Stellen.

Der Grund ist die Datenlage: In Deutschland müssen Tankstellen jede
Preisänderung binnen fünf Minuten an die Markttransparenzstelle melden. Aus
dieser Pflicht entsteht die Liste, die diese App sonst zeigt. Die Pflicht endet
an der Grenze. Tschechien veröffentlicht amtlich nur den Landesdurchschnitt,
wöchentlich; Preise je Station führen dort allein Sammler, die auf Meldungen
von Nutzern beruhen oder Geld kosten.

Also lieber die kleinere Zahl ehrlich als die größere geraten. Der Durchschnitt
beantwortet ohnehin die Frage, die an der Grenze zählt: lohnt der Umweg?

Genannt wird deshalb immer mit: dass es ein Durchschnitt ist, aus welcher
Erhebungswoche er stammt, wann er geholt wurde und mit welchem Kurs er
umgerechnet wurde. Beide Quellen sind amtlich und brauchen keinen Schlüssel:

| | |
|---|---|
| Preise | Tschechisches Statistikamt, Datensatz `CENPHMT`, wöchentlich |
| Kurs | Tschechische Nationalbank, Tageskurs |

Der Wert hält 24 Stunden im Cache und wird vom täglichen Lauf vorgewärmt. E5
und E10 führt die Quelle nicht getrennt — beide bekommen den Wert für Natural
95, und die Oberfläche sagt das dazu.

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
| `gedanken:{nutzer}` | aufgeschriebene Gedanken, ein Schlüssel für alle |
| `gedanken:users` | wer Gedanken aufschreibt (für den Cron-Job) |
| `anschaffung:{nutzer}` | Posten einer Anschaffungsliste samt gesehener Preise |
| `anschaffung:deals:{plz}` | Prospekte der Möbel- und Technikhäuser, 24 Stunden |

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
