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
- !!->es soll immer die letze gecached gezeigt werden um beim start einmal alles neu gefetcht oder in sinnvollen abständen wenn man die 8 mal in der minute öffnet muss nicht 8 mal alles akutlaisiert werden es gibt ja dazu einen extra knopf überall**App-Hülle offline verfügbar** `M` — der Service Worker macht heute nur Push
  und cacht bewusst nichts, weil Angebotsdaten veralten würden. Das stimmt für
  die Daten, nicht für die Hülle: der Korb liegt ohnehin im `localStorage`, aber
  ohne Netz startet die installierte App gar nicht erst. Genau im Laden, im
  Keller, hinter der Kühltheke. Hülle cachen, Daten weiter frisch holen.
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

> Vier Punkte aus diesem Abschnitt sind umgesetzt und deshalb hier raus:
> Ladenweg-Sortierung im Korb, gemerkte Lieblingsläden, Watchlist-Vorschläge
> und der Vergleich zur Vorwoche.

## Tanken

- !!**Preisalarm** `M` — „sag Bescheid, wenn Diesel unter 1,65 fällt". Die
  Push-Strecke steht bereits (VAPID, Geräte, Cron). Einschränkung: der
  Hobby-Plan erlaubt einen Cron-Lauf pro Tag — ein Alarm wäre also eine
  Tagesmeldung, keine Live-Warnung. Das muss die Oberfläche sagen.
- **Lieblingsstationen** `S` — zwei, drei Stationen oben anpinnen; die
  Entscheidung fällt meist zwischen denselben.
- !!**Nur jetzt geöffnete** `S` — die Öffnungszeiten kommen von Tankerkönig mit.
- !!**Tagesverlauf** `L` — Sprit ist morgens teuer, abends billiger. Ein
  Stundenprofil bräuchte stündliche Abfragen; auf dem Hobby-Plan nicht drin,
  ohne den Cron woanders hinzulegen.

## Grundriss

- !!->was ist bei räumen die eine offene seite haben?**Flächen-Übersicht** `M` — eine Liste aller Räume mit m² und Summe. Die
  Geometrie steht bereits (`roomDetection`), es fehlt die Darstellung. Der
  häufigste Grund, überhaupt einen Grundriss zu zeichnen.
- **Maßstabsgetreu drucken** `M` — 1:50 auf A4, damit der Ausdruck am Bau
  taugt.
- !!**Möbel setzen** `L` — Rechtecke mit Namen und Maß („Sofa 220 × 90"), um zu
  prüfen, ob etwas passt. Die Installations-Ebene macht es vor.
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
- !!**Rezepte auf die Einkaufsliste** `L` — Zutaten eines Rezepts in den Korb.
  Schön, aber die Pflege der Rezepte ist die eigentliche Arbeit.

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

Vier Punkte, die zusammen den größten Unterschied machen und sich nicht
gegenseitig blockieren:

1. **Manifest-Farben** `S` — Rest vom Umbau, in Minuten erledigt.
2. **Symbole statt Textzeichen** `M` — der sichtbarste Gewinn an Sorgfalt.
3. **Eigene Zeilen auf der Einkaufsliste** `M` — macht aus der Angebots-App
   die Liste, mit der man tatsächlich losgeht.
4. **App-Hülle offline** `M` — behebt den Fall, in dem die Liste gebraucht wird
   und nicht aufgeht.
