# Produktkonzept

## Grundidee

Josi ist eine lokal laufende Musik-App für das iPad. Nutzer importieren eigene Audiodateien, organisieren sie in Playlists, spielen sie ab und bearbeiten ihre Sammlung direkt auf dem Gerät.

Der Proof of Concept validiert vor allem **Importieren → organisieren → zuverlässig abspielen → präzise verwalten**.

## Kernfunktionen

- Mehrere lokale Audiodateien über den normalen Dateidialog importieren.
- Bibliothek, Verlauf und eigener Loops-Tab.
- Neu importierte Songs blau markieren.
- Songs und Playlists über sichtbare Drei-Punkte-Menüs verwalten.
- Mehrere Songs auswählen und über „Alle Playlists“ einer Playlist zuordnen.
- Songlisten nach Manuell, A–Z Anfang, A–Z Ende, Höranzahl, Dauer oder Chronik sortieren.
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
5. Nur bei blau markierten Songs in blauer Schrift: **Als gelesen markieren**
6. Nur bei blau markierten Songs in blauer Schrift: **Alle als gelesen markieren**
7. In roter Schrift: **Löschen**

„Kopieren“ erstellt einen zweiten Bibliothekseintrag mit eigener ID. „Teilen“ öffnet nach Möglichkeit die iPad-Systemfreigabe mit der Audiodatei. „Löschen“ fragt vorher nach und entfernt den Song anschließend auch aus Playlists, ohne die Playlists selbst zu löschen.

## Drei-Punkte-Menü für Playlists

Einzelne Playlists bieten:

1. **Umbenennen**
2. **Kopieren**
3. **Teilen**
4. **Löschen** in Rot

Eine kopierte Playlist verweist auf dieselben Songs; Audiodateien werden nicht verdoppelt. Beim Teilen wird eine Textübersicht der Playlist mit ihren Liedern an die Systemfreigabe übergeben.

Der bisherige separate Löschknopf in einer geöffneten Playlist entfällt. Die Nachfrage „wirklich löschen?“ bleibt erhalten.

Das `•••` neben der Überschrift „Playlists“ bleibt für **Bearbeiten** und **Übersicht** zuständig.

## Import und lokale Dateien

Der Import bleibt bewusst leichtgewichtig. Nur neu ausgewählte Dateien werden gespeichert; bestehende Audiodaten werden nicht bei jedem Import erneut geschrieben.

`--:--` bedeutet unbekannte Dauer. `FEHLT` bedeutet, dass der lokale Audioblob nicht mehr vorhanden ist und der Song neu importiert werden muss.

## Mehrfachauswahl

„Auswählen“ funktioniert in Bibliothek, Playlist, Verlauf und Loops. Mehrere markierte Songs werden ausschließlich über den Kasten **„Alle Playlists“** unten rechts einer Playlist zugeordnet.

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

`•••` → **Loop erstellen** öffnet eine eigene Vollbildansicht. Die automatische Loop-Erkennung bleibt entfernt.

Der Editor enthält:

- einen **roten Loop-Kasten** mit verschiebbarem Gesamtbereich,
- getrennte rote Start- und Endkanten,
- **Zoom von 1× bis 16×** und horizontales Scrollen,
- einen **blauen Abspielstrich**, der unabhängig vom roten Bereich bewegt werden kann,
- einen Schalter, der den roten Loop-Bereich transparent und unbeweglich macht,
- **−5 s**, **Play/Pause** und **+5 s**,
- **orange Markierungen**, die an der Position des blauen Cursors gesetzt werden,
- anklickbare orange Markierungen, die den blauen Cursor direkt dorthin bringen,
- einen Schalter zum Aktivieren/Deaktivieren der Markierungsbedienung,
- **−10 ms / +10 ms** für die zuletzt berührte rote Start- oder Endkante,
- ein Eingabefeld für einen frei wählbaren Vorlauf in Sekunden, z. B. `0,5` oder `1`,
- **vor Start abspielen** und **vor Ende abspielen**, die den blauen Cursor entsprechend vor die gewünschte rote Kante setzen und die Wiedergabe starten.

Beim Abspielen innerhalb des Editors springt die Wiedergabe am Loop-Ende wieder zum Loop-Start. **Loop speichern** übernimmt Start, Ende, Marker und aktiviert den Loop. Gespeicherte Loops werden weiterhin mit einer roten Schleife markiert und im Tab **Loops** gesammelt.

## Teilen

Songs werden, soweit die Web Share API und iPadOS es erlauben, als tatsächliche Audiodatei geteilt. Wenn der Browser Dateifreigabe nicht unterstützt, zeigt Josi eine verständliche Meldung statt still zu scheitern.

Playlists sind keine einzelne Datei. Deshalb teilt Josi bei Playlists eine Textübersicht mit Playlistname und Liedliste.

## Navigation und Bearbeitungsverlauf

Zurück und Vor öffnen vorherige bzw. nächste App-Ansichten. Undo und Redo bleiben rechts daneben. Bei einer vorgemerkten manuellen Verschiebung folgen Haken und X. Im Loop-Editor schließt Zurück zuerst den Editor.

## Abgrenzung

Noch nicht Teil der aktuellen Version:

- Cloud-Synchronisierung oder Backend,
- Nutzerkonten im Produktablauf,
- automatische Metadaten-/Cover-Erkennung,
- Suche,
- Musik-Streaming,
- automatische Loop-Erkennung,
- Crossfade/Fading,
- native iOS-Hintergrund-Audio-Berechtigungen außerhalb der Möglichkeiten einer PWA.

Der experimentelle Ordnerimport bleibt entfernt.

## Offene Annahmen

- Die lokale Browser-Speicherkapazität reicht für einen realistischen Test.
- Das neue Datei-Löschen und Kopieren bleibt auch bei größeren Bibliotheken schnell genug.
- Systemfreigabe von Audiodateien funktioniert auf den tatsächlich verwendeten iPadOS-/Safari-Versionen ausreichend zuverlässig.
- Der präzise manuelle Loop-Editor ist für echte Musikdateien nützlicher als eine automatische Heuristik.
- Für eine spätere Produktversion müssen Backup, Speichergrenzen, Wiederherstellung verlorener Audiodaten und eventuell eine native App-Hülle geprüft werden.
