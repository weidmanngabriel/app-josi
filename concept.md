# Produktkonzept

## Grundidee

Josi ist eine kleine, lokal laufende Musik-App für das iPad. Nutzer importieren eigene Audiodateien aus der Dateien-App, organisieren sie in Playlists und spielen sie direkt in Josi ab.

Der Proof of Concept validiert vor allem den Ablauf **Importieren → organisieren → zuverlässig abspielen** und erweitert ihn schrittweise um Funktionen für größere lokale Musiksammlungen.

## Kernfunktionen

- Mehrere lokale Audiodateien über den normalen Dateidialog importieren und lokal speichern.
- Bibliothek aller importierten Songs.
- Verlauf für zuletzt importierte Dateien und blaue Markierung des neuesten Imports.
- Eigener „Loops“-Tab für Songs mit gespeichertem Loop.
- Songs mit Loop durch eine rote Schleife am rechten Ende markieren.
- Manueller Loop-Editor auf einer eigenen Seite statt automatischer Loop-Erkennung.
- Player mit Play/Pause, Vor, Zurück, Fortschritt, Autoplay, Shuffle und Wiederholung.
- Lange Songtitel im kompakten Player automatisch horizontal durchlaufen lassen.
- Mehrere Playlists erstellen, umbenennen, bebildern und löschen.
- Unter jedem Songtitel anzeigen, in welchen Playlists er enthalten ist.
- In allen Songlisten mehrere Songs über „Auswählen“ markieren.
- Die Playlist-Zuordnung für Einzel- und Mehrfachauswahl ausschließlich über „Alle Playlists“ unten rechts öffnen.
- Playlist-Dialog nach Symbolen, Zahlen und anschließend Buchstaben gruppieren.
- Zusatzfunktionen über sichtbare Drei-Punkte-Menüs `•••` anbieten.
- Alle Songlisten nach mehreren Kriterien sortierbar machen, ohne die manuelle Reihenfolge zu überschreiben.
- Lieddauer als `MM:SS` direkt in den Songzeilen anzeigen, sobald sie bekannt ist.
- Vollständig gehörte Wiedergaben zählen; übersprungene Songs erhöhen den Zähler nicht.
- Oben links Zurück, Vor, Undo und Redo; bei vorgemerkter manueller Verschiebung zusätzlich Haken und X.
- Media-Session-Integration für System-Mediensteuerungen, soweit Browser/iPadOS dies bereitstellt.

## Import und lokale Dateien

Der Import soll so wenig Zusatzarbeit wie möglich auslösen:

1. Nutzer tippt auf „Musik importieren“.
2. Der File-Input wird vorher geleert, damit auch dieselbe Datei erneut ausgewählt werden kann.
3. Im iPad-Dateidialog werden eine oder mehrere Audiodateien ausgewählt und mit „Öffnen“ bestätigt.
4. Josi speichert diese Dateien direkt lokal.
5. Erst beim späteren Laden eines Songs wird dessen Dauer ergänzt.

Die App schreibt beim Import nicht mehr die gesamte bestehende Bibliothek erneut. Das reduziert Speicherlast und das Risiko, bei großen Audio-Bibliotheken an Browser-Quota-Grenzen zu stoßen.

`--:--` bedeutet: Die Dauer des Songs ist noch nicht bekannt. `FEHLT` bedeutet dagegen: Der lokal gespeicherte Audioblob ist nicht mehr vorhanden bzw. hat Größe 0. In diesem Fall muss die Originaldatei erneut importiert werden; die App kann verlorene Audiodaten nicht rekonstruieren.

## Bedienprinzip Drei-Punkte-Menüs

Langdruck wird nicht mehr für Funktionen verwendet, weil diese Geste mit Scrollen und iPadOS-Gesten kollidieren kann.

Stattdessen steht ein sichtbarer `•••`-Knopf an Stellen mit zusätzlichen Funktionen:

- bei Songs,
- bei Playlists,
- neben der Überschrift „Playlists“.

Bei Songs enthält das Menü unter anderem „Als gesehen markieren“ und „Loop erstellen“ bzw. „Loop bearbeiten“.

## Mehrere Songs auswählen

1. In Bibliothek, Playlist, Verlauf oder Loops wird „Auswählen“ gewählt.
2. Mehrere Songs können markiert werden; „Alle“ markiert die komplette aktuell sichtbare Liste.
3. Unten rechts bleibt „Alle Playlists“ aktiv und öffnet den Playlist-Dialog für die gesamte Auswahl.
4. Ein Tipp auf eine Playlist fügt alle ausgewählten Songs hinzu, ohne Audiodateien zu duplizieren.

## Sortierung von Songlisten

Alle Listen mit Lieddateien bieten dieselben Optionen:

- **Manuell** – die selbst erstellte Reihenfolge.
- **A–Z Anfang** – Vergleich ab dem Anfang des Titels.
- **A–Z Ende** – Vergleich ab dem Ende des Titels nach vorne.
- **Anzahl des Hörens** – Zahl vollständig gehörter Wiedergaben.
- **Dauer** – Länge des Liedes.
- **Chronik** – Zeitpunkt des Imports.

Neben der Sortieroption steht ein Pfeil. Pfeil nach unten zeigt die normale Richtung des gewählten Kriteriums, Pfeil nach oben kehrt sie um. Bei „Manuell“ ist der Pfeil deaktiviert.

Wichtig: Keine automatische Sortierung verändert die manuelle Reihenfolge.

## Lieddauer und Höranzahl

Die App analysiert die Lieddauer nicht mehr beim Import. Sobald ein Song das erste Mal im normalen Player geladen wird, übernimmt Josi die vom Audio-Element gemeldete Dauer und speichert sie.

Ein Song zählt als vollständig gehört, wenn der Player sein natürliches Ende erreicht. Manuelles Überspringen erhöht den Zähler nicht.

## Manueller Loop-Editor

Die bisherige automatische Loop-Erkennung wird entfernt, weil sie auf realen Musikdateien nicht zuverlässig genug funktioniert.

Der neue Ablauf orientiert sich an einem Clip-Editor:

1. Nutzer wählt bei einem Song `•••` → „Loop erstellen“ oder öffnet in der Songdetailansicht „Loop erstellen“.
2. Eine eigene Vollbildseite öffnet sich.
3. Auf dem kompletten Zeitstrahl liegt ein roter Auswahlkasten.
4. Der gesamte Kasten kann nach links und rechts verschoben werden.
5. Linke und rechte Kante können separat gezogen werden, um Start und Ende einzustellen.
6. „Loop testen“ spielt den ausgewählten Abschnitt und springt am Ende wieder zum Start.
7. „Loop speichern“ übernimmt den Bereich und aktiviert ihn.
8. Gespeicherte Loops tragen die rote Schleife und erscheinen im Tab „Loops“.

Der Nutzer bestimmt damit selbst den musikalisch passenden Bereich; es gibt keinen automatisch behaupteten Loop-Vorschlag mehr.

## Playlist-Verwaltung

Das `•••` neben „Playlists“ bietet insbesondere:

- Bearbeiten der manuellen Playlist-Reihenfolge,
- Öffnen der großen Playlist-Übersicht.

Auch einzelne Playlist-Einträge besitzen `•••` für playlistbezogene Aktionen.

## Navigation und Bearbeitungsverlauf

- Zurück und Vor öffnen die vorherige bzw. nächste besuchte Ansicht.
- Undo und Redo stehen direkt rechts daneben.
- Bei einer vorgemerkten manuellen Verschiebung erscheinen rechts von diesen vier Knöpfen ein grüner Haken und ein rotes X.
- Im Loop-Editor schließt Zurück zunächst den Editor.

## System-Mediensteuerung

Josi meldet aktuellen Song und Wiedergabestatus über die Media Session API. Unterstützte Systemoberflächen können Play/Pause, vorherigen/nächsten Song und Positionswechsel anbieten. Die tatsächliche Hintergrundwiedergabe wird weiterhin von Safari/iPadOS gesteuert.

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

- Die lokale Browser-Speicherkapazität reicht für einen realistischen ersten Test.
- Relevante Audioformate werden von Safari/iPadOS zuverlässig abgespielt.
- Der vereinfachte Import reduziert Fehler bei großen lokalen Musikbibliotheken.
- Die manuelle Loop-Auswahl ist zuverlässiger und verständlicher als die bisherige automatische Heuristik.
- Drei-Punkte-Menüs sind auf dem iPad robuster als Langdruck-Gesten.
- Für eine spätere Produktversion müssen Backup, Speichergrenzen, Wiederherstellung verlorener Audiodaten und gegebenenfalls eine native App-Hülle geprüft werden.
