# Produktkonzept

## Grundidee

Josi ist eine lokal laufende Musik-App für das iPad. Nutzer importieren eigene Audiodateien, organisieren sie in Playlists, spielen sie ab und bearbeiten ihre Sammlung direkt auf dem Gerät.

Der Proof of Concept validiert vor allem **Importieren → organisieren → zuverlässig abspielen → präzise verwalten**.

## Kernfunktionen

- Mehrere lokale Audiodateien über den normalen Dateidialog importieren.
- Bibliothek, Importverlauf und eigener Loops-Tab.
- Neu importierte Songs blau markieren.
- Songs und Playlists über sichtbare Drei-Punkte-Menüs verwalten.
- Mehrere Songs auswählen und über „Alle Playlists“ einer Playlist zuordnen.
- Songlisten nach Manuell, A–Z Anfang, A–Z Ende, Höranzahl, Dauer oder Chronik sortieren.
- Bibliothek und Playlists per einfacher Zeichenfolgen-Suche durchsuchen.
- Lieddauer anzeigen, sobald sie vom Player ermittelt wurde.
- Vollständig gehörte Wiedergaben zählen.
- Manueller, präziser Loop-Editor statt automatischer Loop-Erkennung.
- Media-Session-Integration für System-Mediensteuerung, soweit iPadOS/Safari sie bereitstellt.

## Drei-Punkte-Menü für Songs

Die Aktionen stehen in dieser Reihenfolge:

1. **Umbenennen**
2. **Kopieren**
3. **Teilen**
4. **Loop erstellen** bzw. **Loop bearbeiten**
5. Bei vorhandenem Loop: **Loop aktivieren** bzw. **Loop deaktivieren**
6. Nur bei blau markierten Songs in blauer Schrift: **Als gelesen markieren**
7. Nur bei blau markierten Songs in blauer Schrift: **Alle als gelesen markieren**
8. In roter Schrift: **Löschen**

„Kopieren“ erstellt einen zweiten Bibliothekseintrag mit eigener ID. „Teilen“ öffnet nach Möglichkeit die iPad-Systemfreigabe mit der Audiodatei. „Löschen“ fragt vorher nach und entfernt den Song anschließend auch aus Playlists, ohne die Playlists selbst zu löschen.

## Drei-Punkte-Menü für Playlists

Einzelne Playlists bieten:

1. **Bild ändern**
2. **Umbenennen**
3. **Kopieren**
4. **Teilen**
5. **Löschen** in Rot

Eine kopierte Playlist verweist auf dieselben Songs; Audiodateien werden nicht verdoppelt. Beim Teilen wird eine Textübersicht der Playlist mit ihren Liedern an die Systemfreigabe übergeben.

Der bisherige separate Löschknopf in einer geöffneten Playlist entfällt. Die Nachfrage „wirklich löschen?“ bleibt erhalten.

Das `•••` neben der Überschrift „Playlists“ bleibt für **Bearbeiten** und **Übersicht** zuständig.

## Import und lokale Dateien

Der Import bleibt bewusst leichtgewichtig. Nur neu ausgewählte Dateien werden gespeichert; bestehende Audiodaten werden nicht bei jedem Import erneut geschrieben.

`--:--` bedeutet unbekannte Dauer. `FEHLT` bedeutet, dass der lokale Audioblob nicht mehr vorhanden ist und der Song neu importiert werden muss.

Wichtig für die Datenintegrität: Die eigentliche Audiodatei und spätere Änderungen an einem Song werden getrennt gespeichert. **Loop speichern, Umbenennen, Dauer, Hörzähler, „gelesen“ und Sortierung dürfen die Audiodatei selbst nicht erneut schreiben.** Dadurch kann eine reine Bearbeitung die importierte Datei nicht mehr durch einen erneuten Blob-Schreibvorgang beschädigen.

Dateien, die bereits vor dieser Änderung beschädigt oder leer geworden sind, können von der App nicht wiederhergestellt werden und müssen erneut importiert werden.

## Mehrfachauswahl

„Auswählen“ funktioniert in Bibliothek, Playlist, Verlauf und Loops. Rechts neben **„Alle Playlists“** erscheint ein runder `•••`-Knopf mit **Gruppieren** (später), **Bewegen**, **Tags** (später) und **Alle löschen**. Bewegen ist nur in Bibliothek bzw. geöffneter Playlist verfügbar und verschiebt die Auswahl als zusammenhängenden Block. Bei einer nicht-manuellen Sortierung fragt Josi, ob auf Manuell umgeschaltet werden soll; Nein bricht die Aktion ab. Alle löschen verlangt eine Sicherheitsabfrage.

## Suche

In Bibliothek und geöffneter Playlist gibt es ein Suchfeld. Es sucht nur nach der tatsächlich vorhandenen Zeichenfolge im Liednamen und ignoriert lediglich Groß-/Kleinschreibung. Es gibt bewusst keine semantischen oder unscharfen Treffer.

## Importverlauf

Der frühere „Verlauf“-Tab heißt **Importverlauf**. Er zeigt die aktuell blau markierten neuen Importe. In der Navigation steht **x/y**: x ist die Zahl der blauen Importe, y die Gesamtzahl aller importierten Songs.

## Sortierung

Alle Songlisten bieten:

- **Manuell**
- **A–Z Anfang**
- **A–Z Ende**
- **Anzahl des Hörens**
- **Dauer**
- **Chronik**

Der Pfeil kehrt die Sortierung um. Die manuelle Reihenfolge bleibt separat gespeichert und wird durch andere Sortierungen nicht verändert.

## Präziser Loop-Editor

`•••` → **Loop erstellen** öffnet den Schnittplatz als feste Vollbildansicht. Das Interface orientiert sich direkt an der vom Nutzer gezeichneten Skizze.

Oben stehen Zurück/Vor und Editor-Undo/Redo. Zoom ist eine Auswahlliste von **1× bis 15×**. Die Cursor-Geschwindigkeit bietet **5%, 10%, 25%, 50%, 75%, 100%, 150%, 200%, 500%, 1000% und 5000%**. **Fokus folgt Cursor** hat drei Zustände: zentriert folgen, seitenweise weiterblättern oder aus. Loop-Kasten, Cursor-Loop und Markierungen werden mit Schaltern gesteuert. Erläuterungen aus der Skizze, die in Klammern standen, werden nicht als zusätzlicher Text angezeigt.

Die Zeitachse verwendet die bestehende Amplituden-Wellenform und vier klare Farbfamilien: Loop leicht rot, Cursor leicht blau, Fokus leicht grün und Markierungen leicht orange. Direkt an den jeweiligen Strichen werden ihre aktuellen Zeiten angezeigt; diese Zahlen sind reine Anzeigen und nicht bedienbar. Der Cursor wird weiterhin nur am blauen Punkt verschoben.

Unter der Zeitachse stehen **Fokus**, **Cursor** und **Loop** in einer kompakten Reihe; der Loop-Block liegt rechts neben Fokus und Cursor. Die Markierungen liegen darunter. Direkt hinter jedem Wort „Standort“ steht die aktuelle Position bis auf Millisekunden. Die bisherigen freien Zahleneingaben sind durch kleine Schritt-Auswahllisten ersetzt. Beim Cursor sind zusätzlich 30 s und 60 s auswählbar. Auch die Vorlaufwerte werden ausgewählt und bedeuten immer nur „x Sekunden vor Start“ bzw. „x Sekunden vor Ende“.

Markierungen heißen A, B, C usw. Oberhalb von „Alle Markierungen löschen“ steht ein eigener **Markierung setzen**-Knopf. Das `•••` enthält weiterhin „Zoom hinbewegen“, „Loop-Anfang hinbewegen“, „Loop-Ende hinbewegen“ und „Markierung löschen“.

Loop-Kasten sperren, Cursor-Loop, Marker an/aus, Fokus-Modus, Zoom und Geschwindigkeit verändern nur den Editorzustand. **Loop speichern** schreibt weiterhin nur Metadaten und niemals den Audio-Blob. Vor **Loop speichern**, **Loop löschen** und **Alle Markierungen löschen** erscheint jeweils eine Sicherheitsabfrage.

Der Editor besitzt eine eigene Scrollfläche und die App verwendet keinen selbst gebauten Pull-to-Refresh mehr. Nach oben oder unten scrollen darf deshalb keinen App-Reload auslösen.

## Wiederholen: Liste oder ausgewählte Songs

Kurzer Druck auf den Wiederholen-Knopf schaltet die normale Listenwiederholung. **Langdruck ist hier bewusst die einzige Ausnahme zur sonst abgeschafften Langdruck-Bedienung:** Er aktiviert `↻1`. Ohne Mehrfachauswahl wiederholt Josi den aktuell gewählten Song. Werden vorher mehrere Songs mit „Auswählen“ markiert, übernimmt der Langdruck genau diese Songs als Wiederholgruppe, beendet den Auswahlmodus und markiert die Gruppe dauerhaft grün, solange der Modus aktiv ist. Die Songs laufen in Listenreihenfolge und beginnen nach dem letzten wieder beim ersten. Das Symbol bleibt `↻1`, auch wenn mehrere Songs dazugehören.

## Wiedergabe nach Loop-Bearbeitung

Das Speichern oder Umschalten eines Loops darf die zugrunde liegende Audiodatei weder neu laden noch neu in IndexedDB schreiben. Die Audioquelle wird nur dann neu erzeugt, wenn sich der ausgewählte Song oder dessen tatsächlicher Datei-Blob ändert.

Änderungen wie Loop speichern, Loop an/aus, Marker, Dauer oder Umbenennen verändern nur Metadaten. Dadurch bleibt die importierte Datei geschützt. Für den eigentlichen Übergang versucht Josi eine kurze Doppelwiedergabe: Kurz vor dem Loop-Ende beginnt ein zweiter unsichtbarer Wiedergabekanal bereits am Loop-Anfang, sodass Ende und Anfang ungefähr 0,18 Sekunden überlappen. Wenn Lautstärkesteuerung unterstützt wird, werden beide Kanäle gegeneinander überblendet. Scheitert der zweite Kanal technisch, sucht Josi lokal in einem kleinen Bereich um die gesetzten Grenzen nach einem möglichst ähnlichen Signal-Verbindungspunkt. Dieser Fallback verändert die gespeicherten Loop-Punkte nicht und kann musikalisch falsch liegen.

## Teilen

Songs werden, soweit die Web Share API und iPadOS es erlauben, als tatsächliche Audiodatei geteilt. Wenn der Browser Dateifreigabe nicht unterstützt, zeigt Josi eine verständliche Meldung statt still zu scheitern.

Playlists sind keine einzelne Datei. Deshalb teilt Josi bei Playlists eine Textübersicht mit Playlistname und Liedliste.

## Navigation und Bearbeitungsverlauf

Ganz links stehen **Home** und **Einstellungen**, danach Zurück/Vor sowie Undo/Redo. Home öffnet von jedem Tab direkt die Bibliothek. Die Einstellungen sind zunächst ein Prototyp für die Spulweite (5/10/15/30/60 Sekunden) und erklären den automatischen Loop-Übergang. Im Hauptplayer liegt Play/Pause ganz innen; daneben stehen Spulen, dann Liedwechsel und ganz außen Shuffle bzw. Wiederholen. In der näheren Song-Ansicht sitzen Shuffle und Wiederholen außen um die bisherigen Transportknöpfe; Langdruck auf Wiederholen nutzt dort ebenfalls `↻1`.

## Abgrenzung

Noch nicht Teil der aktuellen Version:

- Cloud-Synchronisierung oder Backend,
- Nutzerkonten im Produktablauf,
- automatische Metadaten-/Cover-Erkennung,
- Musik-Streaming,
- automatische Loop-Erkennung,
- Frequenz-Spektrogramm,
- Crossfade/Fading zwischen unterschiedlichen Liedern,
- native iOS-Hintergrund-Audio-Berechtigungen außerhalb der Möglichkeiten einer PWA.

Der experimentelle Ordnerimport bleibt entfernt.

## Offene Annahmen

- Die lokale Browser-Speicherkapazität reicht für einen realistischen Test.
- Systemfreigabe von Audiodateien funktioniert auf den tatsächlich verwendeten iPadOS-/Safari-Versionen ausreichend zuverlässig.
- Die klassische Amplituden-Wellenform ist auf realen Musikdateien schnell genug berechenbar und hilft bei der Loop-Auswahl.
- Die vergrößerten Trefferflächen und die getrennte Fokus-Leiste machen den Editor auf Touch-Geräten zuverlässiger bedienbar.
- Die getrennte Speicherung von Audiodatei und Metadaten verhindert, dass reine Bearbeitungsschritte bestehende Audiodaten erneut schreiben.
- Für eine spätere Produktversion müssen Backup, Speichergrenzen, Wiederherstellung verlorener Audiodaten und eventuell eine native App-Hülle geprüft werden.
