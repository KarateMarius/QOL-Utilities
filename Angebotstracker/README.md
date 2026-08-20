# Angebotstracker

Eigenständige Web-App für Prospekt-Angebote deutscher Supermärkte. Scraped
Marktguru und Kaufda, filtert und sortiert die Wochenangebote, sammelt sie in
einem Einkaufskorb und schickt sie als Push-Benachrichtigung aufs Handy.

Läuft komplett unabhängig von der GarminWebApp — kein Garmin, kein Training,
keine KI.

## Was drin ist

| Bereich | Funktion |
|---|---|
| Angebote | ~2.000 Angebote pro PLZ aus Marktguru + Kaufda, mit Produktbildern |
| Filter | Kategorie, Händler, Volltextsuche |
| Sortierung | Preis, Grundpreis (€/kg · l), Händler, Rabatt |
| Grundpreis | offizieller Grundpreis der Quelle, sonst aus dem Angebotstext berechnet |
| Korb | nach Laden gruppiert, mit Summe, Kopier- und Druckfunktion |
| Watchlist | Suchwörter mit Preisgrenze und Kategorie |
| Push | Korb aufs Handy senden; täglicher Scan meldet neue Watchlist-Treffer |
| PWA | installierbar, Dark/Light, funktioniert auf Android und iOS |

## Stack

- **Backend:** FastAPI als Vercel Serverless Function (`api/index.py`)
- **Frontend:** React 19 + TypeScript + Vite + TanStack Query, CSS ohne Framework
- **Speicher:** Upstash Redis über REST; lokal automatisch eine JSON-Datei
- **Push:** Web Push mit VAPID (`pywebpush`)

---

## Lokal starten

```bash
pip install -r requirements.txt
npm install

# Terminal 1 — API auf Port 8000
npm run api

# Terminal 2 — Frontend auf Port 5173 (proxyt /api auf 8000)
npm run dev
```

Ohne `KV_REST_API_URL` schreibt die App in `.local-store.json` — kein Cloud-Setup
nötig. Die `.env` enthält bereits generierte VAPID-Keys für die lokale Nutzung.

**Push lokal:** funktioniert nur auf `http://localhost`. Rufst du den Dev-Server
vom Handy über `http://192.168.x.x:5173` auf, blockiert der Browser Service
Worker und Push — das ist kein Bug, sondern die Secure-Context-Regel. Zum Testen
am Handy also die Vercel-URL nutzen.

### Optik ansehen ohne Server

```bash
npm run build
python scripts/make_preview.py   # schreibt dist/preview.html
```

`dist/preview.html` lässt sich direkt im Browser öffnen und zeigt die echte
Oberfläche mit Angeboten aus dem lokalen Cache.

---

## Deploy auf Vercel

### 1. Projekt anlegen

Repo pushen, in Vercel importieren. Framework-Preset **Vite**; Build-Command und
Output-Verzeichnis stehen schon in `vercel.json`.

### 2. Upstash Redis verbinden

Im Vercel-Projekt unter **Storage → Marketplace → Upstash Redis** eine Datenbank
anlegen und mit dem Projekt verbinden. Vercel setzt `KV_REST_API_URL` und
`KV_REST_API_TOKEN` dann automatisch.

Ohne diesen Schritt startet die App zwar, verliert aber bei jedem Aufruf Cache,
Watchlist und Push-Anmeldungen — Serverless Functions haben kein bleibendes
Dateisystem.

### 3. Environment-Variablen setzen

```bash
python scripts/generate_vapid_keys.py
```

In Vercel unter **Settings → Environment Variables** eintragen:

| Variable | Wert |
|---|---|
| `VAPID_PUBLIC_KEY` | aus dem Script |
| `VAPID_PRIVATE_KEY` | aus dem Script |
| `VAPID_SUBJECT` | `mailto:deine@mail.de` |
| `DEFAULT_PLZ` | z. B. `48155` |
| `CRON_SECRET` | beliebiges langes Zufallswort |

Nimm für Produktion **eigene** Keys, nicht die aus der lokalen `.env`.

### 4. Push auf dem Handy einschalten

- **Android:** Seite öffnen, in der Watchlist auf „Benachrichtigungen einschalten".
- **iOS:** erst in **Safari** öffnen, über Teilen → „Zum Home-Bildschirm" installieren,
  die App von dort starten, dann einschalten. iOS liefert Web Push ausschließlich
  an installierte PWAs, ab iOS 16.4.

### 5. Täglicher Scan

`vercel.json` registriert einen Cron auf `/api/cron/refresh` um 05:00 UTC. Der Job
lädt die Prospekte der gespeicherten PLZ neu, gleicht sie gegen die Watchlist ab
und pusht neue Treffer. Der Hobby-Plan erlaubt einen Lauf pro Tag; für häufigere
Läufe braucht es den Pro-Plan.

---

## API

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/health` | Status, Speicher-Backend, Push-Konfiguration |
| GET | `/api/deals?plz=&refresh=` | Angebote inkl. Watchlist-Treffer (6 h Cache) |
| DELETE | `/api/deals/cache?plz=` | Cache für eine PLZ verwerfen |
| GET/PUT | `/api/settings` | PLZ, die der Cron-Job scannt |
| GET/PUT | `/api/watchlist` | Watchlist-Einträge |
| GET | `/api/categories` | Kategorien mit Beschriftung |
| GET | `/api/push/config` | VAPID Public Key, Anzahl Anmeldungen |
| POST | `/api/push/subscribe` · `/unsubscribe` | Gerät an-/abmelden |
| POST | `/api/push/cart` | Einkaufskorb an alle Geräte senden |
| POST | `/api/push/test` | Testbenachrichtigung |
| GET | `/api/cron/refresh` | Täglicher Scan (braucht `CRON_SECRET`) |

## Aufbau

```
api/index.py            alle Routen
lib/deals.py            Scraper für Marktguru und Kaufda
lib/categorize.py       Kategorien nach Stichwortlisten
lib/pricing.py          Grundpreis aus Text und API-Feldern
lib/storage.py          Upstash Redis, lokal JSON-Datei
lib/push.py             Web Push, entfernt tote Anmeldungen
src/                    React-Frontend
public/sw.js            Service Worker für Push
```

## Bekannte Grenzen

- **Öffentliche URL:** Die App hat keine Anmeldung. Wer die Vercel-URL kennt,
  sieht deine Watchlist und kann sich für Pushes anmelden. Für den Eigenbedarf
  reicht das; sonst Vercel Password Protection aktivieren.
- **Scraping:** Marktguru und Kaufda haben keine offizielle API. Ändern sie ihre
  Endpunkte, bricht der Scraper. Von Rechenzentrums-IPs aus können sie außerdem
  strenger filtern als von einem Heimanschluss — falls nach dem Deploy nichts
  ankommt, liegt es vermutlich daran.
- **Rabatt-Badge:** Nur wo die Quelle einen Vorher-Preis mitliefert. Bei
  Supermärkten ist das selten, bei Elektronik häufig.
