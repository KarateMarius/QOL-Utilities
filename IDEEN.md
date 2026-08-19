# Ideen

Mögliche Features für QOL-Utilities. Kein Fahrplan, keine Zusagen — eine
Sammlung, aus der ausgewählt wird.

**Aufwand:** `S` eine Sitzung · `M` ein halber Tag · `L` mehrere Sitzungen.

Was „sehr gut gestaltet" hier heißt, damit die Liste nicht beliebig wird:

1. **Für den Eigenbedarf gebaut.** Der Maßstab ist, ob es im Laden, in der
   Wohnung, an der Tankstelle hilft — nicht, ob es sich vorzeigen lässt.
2. **Eine Handlung pro Bildschirm.** Jede App hat einen Grund, geöffnet zu
   werden. Was diesem Grund nicht dient, gehört nicht auf die Seite.
3. **Ehrliche Daten.** Kein „Tief 30 Tage" nach zwei Tagen Beobachtung. Was
   die App nicht weiß, sagt sie.
4. **Ein Haus.** Farben, Schrift, Abstände kommen aus `tokens.css`; eine neue
   App bringt keinen eigenen Geschmack mit.

---

## Rest vom Umbau

Kleinigkeiten, die der neue Anstrich offen gelassen hat.

- **Manifest-Farben nachziehen** `S` — `public/manifest.webmanifest` trägt noch
  `#0c1322` aus der Glas-Zeit. Das ist die Farbe des Startbildschirms und der
  Statusleiste der installierten App; sie passt nicht mehr zu `#0b1120` bzw.
  `#f2f5fa`.
- **Symbole statt Textzeichen** `M` — die Angebote-App setzt `↻ ☰ ▦ ✕ ✓ ⌕` als
  Schriftzeichen. Die rendert jedes Betriebssystem anders, in unterschiedlicher
  Strichstärke und optischer Größe. Der Rahmen hat bereits einen gezeichneten
  Satz (`stroke-width: 1.6`); ein gemeinsamer Satz für alle Apps wäre der
  sichtbarste Sprung an Sorgfalt für den geringsten Einsatz.
- **Kontrast nachmessen** `S` — die neue Palette ist nicht gegen WCAG AA
  geprüft. Verdächtig: `--qol-text-faint` auf `--qol-surface-3`, und die
  Händlerfarben mit weißer Schrift (Netto-Gelb, EDEKA-Gelb).

## Rahmen

- **Eine Anmeldung** `M` — die Grundriss-App bringt im Speichern-Dialog ein
  zweites Anmeldefeld mit, zusätzlich zu dem der Übersicht. Beide führen zum
  selben Konto. Steht schon als bekannte Grenze im README.
- **Ein Ort statt drei** `S` — die Angebote halten ihre PLZ auf dem Server, das
  Tanken unter `qol_plz` im Browser. Wer umzieht, trägt es zweimal ein. Ein
  gemeinsamer Ort im Konto, den beide lesen.
- **Sprungziele im Manifest** `S` — `shortcuts` im Manifest: langes Drücken aufs
  App-Symbol führt direkt in den Korb oder zu den Angeboten. Die App versteht
  `?panel=cart` bereits.
- **Kachel mit einer Kennzahl** `M` — die Übersicht ist ein Starter. Eine
  einzige Zahl je Kachel („3 Treffer", „1,72 €", „4 Grundrisse") macht daraus
  eine Antwort auf „lohnt sich das Öffnen?". Bewusst *eine* Zahl, keine
  Zusammenfassung — sonst wird die Übersicht zum Armaturenbrett.
- **Tastaturweg** `S` — `1/2/3` öffnet eine App, `Esc` führt zurück. Am Rechner
  spürbar, kostet fast nichts.

## Angebote

- **Eigene Zeilen auf der Liste** `M` — heute kommt auf die Einkaufsliste nur,
  was im Prospekt steht. Milch, Klopapier, Batterien nicht. Ein Eingabefeld im
  Korb schließt die größte Lücke zwischen „Angebots-App" und „Einkaufsliste".
- **Mengen** `S` — `2 ×` neben dem Artikel, Summe rechnet mit.
- **Liste teilen** `S` — Web Share API. Wer zu zweit einkauft, schickt sie
  rüber, statt sie abzufotografieren.
- **Preisverlauf als Kurve** `M` — der Tiefstwert steht schon auf der Karte. 30
  Punkte als kleine Linie daneben zeigen den Unterschied zwischen „dauerhaft
  billig" und „vorher hochgesetzt". Die Daten liegen bereits in
  `angebote:hist:{key}`.

> **Umgesetzt und deshalb hier raus:** Ladenweg-Sortierung im Korb, gemerkte
> Lieblingsläden, Watchlist-Vorschläge, Vergleich zur Vorwoche, Prospekt aus
> dem Browser-Speicher samt Offline-Hülle, eigene Zeilen und Rezepte auf der
> Einkaufsliste, Preisalarm, „nur jetzt geöffnete" und Tagesverlauf beim
> Tanken, Flächen-Übersicht und Möbel im Grundriss.

## Tanken

- **Lieblingsstationen** `S` — zwei, drei Stationen oben anpinnen; die
  Entscheidung fällt meist zwischen denselben.

## Grundriss

- **Maßstabsgetreu drucken** `M` — 1:50 auf A4, damit der Ausdruck am Bau
  taugt.
- **Mehrere Etagen** `L` — Blätter innerhalb eines Plans, umschaltbar.

## Mögliche neue Apps

Der Rahmen ist auf Zuwachs gebaut — Ordner, Eintrag in `apps.jsx`, fertig.

- **Vorräte** `L` — was ist da, was ist bald leer, was läuft ab. Verbindet sich
  natürlich mit den Angeboten: was leer wird, wandert auf die Watchlist.
- **Zählerstände** `M` — Strom, Gas, Wasser ablesen und eintragen. Wenige
  Zahlen im Monat, eine Kurve daraus, Verbrauch je Tag. Passt zum Eigenbedarf
  und ist die kleinste sinnvolle neue App.
- **Termine mit Vorlauf** `M` — TÜV, Zahnarzt, Filterwechsel. Push gibt es
  schon; es fehlt nur die Liste dahinter.

## Bewusst nicht

- **Freigabe an andere Konten.** Ein Werkzeug für den Eigenbedarf. Freigaben
  bringen Rechte, Einladungen und eine deutlich größere Angriffsfläche.
- **Native App.** Web Push läuft seit iOS 16.4 in der installierten PWA; der
  einzige echte Grund für nativ ist damit weg.
- **Gutschein-Codes bei den Shops.** Schon geprüft und verworfen, Begründung
  steht im README: die Texte liegen ohne Gültigkeitszeitraum vor.
- **Häufigerer Cron.** Ein Lauf pro Tag ist die Grenze des Hobby-Plans. Alles,
  was Minuten braucht, müsste woanders laufen.

---

## Wenn zuerst, dann das

Die vier Punkte, die hier standen, sind erledigt. Aus dem, was übrig ist,
wäre **eine Anmeldung** (statt zweier Anmeldefelder) der nächste ehrliche
Schritt: er räumt eine bekannte Grenze aus dem README weg, statt etwas
Neues danebenzustellen.
