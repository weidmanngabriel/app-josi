# Produktkonzept

## Grundidee

Josi ist eine kleine, lokal laufende Musik-App für das iPad. Nutzer importieren eigene Audiodateien aus der Dateien-App, organisieren sie in Playlists und spielen sie direkt in Josi ab.

Der Proof of Concept validiert vor allem den Ablauf **Importieren → organisieren → zuverlässig abspielen** und erweitert ihn schrittweise um Funktionen für größere lokale Musiksammlungen.

## Kernfunktionen

- Mehrere lokale Audiodateien über den normalen Dateidialog importieren und lokal speichern.
- Bibliothek aller importierten Songs.
- Verlauf für zuletzt importierte Dateien und blaue Markierung des neuesten Imports.
- Eigener „Loops“-Tab für Songs mit gespeichertem Loop-Vorschlag.
- Songs mit Loop durch eine rote Schleife am rechten Ende markieren.
- Experimentelle lokale Loop-Analyse in der Songdetailansicht.
- Player mit Play/Pause, Vor, Zurück, Fortschritt, Autoplay, Shuffle und Wiederholung.
- Lange Songtitel im kompakten Player automatisch horizontal durchlaufen lassen.
- Mehrere Playlists erstellen, umbenennen, bebildern und löschen.
- Unter jedem Songtitel anzeigen, in welchen Playlists er enthalten ist.
- In allen Songlisten mehrere Songs über „Auswählen“ markieren.
- Die Playlist-Zuordnung für Einzel- und Mehrfachauswahl ausschließlich über „Alle Playlists“ unten rechts öffnen.
- Playlist-Dialog nach Symbolen, Zahlen und anschließend Buchstaben gruppieren.
- Alle früheren Langdruck-Aktionen durch sichtbare Drei-Punkte-Menüs `•••` ersetzen.
- Alle Songlisten nach mehreren Kriterien sortierbar machen, ohne die manuelle Reihenfolge zu überschreiben.
- Lieddauer als `MM:SS` direkt in den Songzeilen anzeigen.
- Vollständig gehörte Wiedergaben zählen; übersprungene Songs erhöhen den Zähler nicht.
- Oben links Zurück, Vor, Undo und Redo; bei vorgemerkter manueller Verschiebung zusätzlich Haken und X.
- Media-Session-Integration für System-Mediensteuerungen, soweit Browser/iPadOS dies bereitstellt.

## Bedienprinzip Drei-Punkte-Menüs

Langdruck wird vollständig aus der App entfernt, weil diese Geste mit Scrollen, Auswahl und iPadOS-Gesten kollidieren kann.

Stattdessen steht ein sichtbarer `•••`-Knopf an Stellen mit zusätzlichen Funktionen:

- bei Songs,
- bei Playlists,
- neben der Überschrift „Playlists“.

Das Menü ist gleichzeitig der vorgesehene Platz für künftige Zusatzfunktionen. Bei Songs enthält es unter anderem „Als gesehen markieren“ und „Loop erstellen“.

## Mehrere Songs auswählen

1. In Bibliothek, Playlist, Verlauf oder Loops wird „Auswählen“ gewählt.
2. Mehrere Songs können markiert werden; „Alle“ markiert die komplette aktuell sichtbare Liste.
3. Der bisherige Kopfzeilen-Knopf „Zu Playlist“ entfällt.
4. Unten rechts bleibt „Alle Playlists“ aktiv und öffnet den Playlist-Dialog für die gesamte Auswahl.
5. Ein Tipp auf eine Playlist fügt alle ausgewählten Songs hinzu, ohne Audiodateien zu duplizieren.

Damit gibt es nur noch einen einzigen Weg zur Playlist-Zuordnung.

## Sortierung von Songlisten

Alle Listen mit Lieddateien bieten dieselben Optionen:

- **Manuell** – die selbst erstellte Reihenfolge.
- **A–Z Anfang** – Vergleich ab dem Anfang des Titels.
- **A–Z Ende** – Vergleich ab dem Ende des Titels nach vorne.
- **Anzahl des Hörens** – Zahl vollständig gehörter Wiedergaben.
- **Dauer** – Länge des Liedes.
- **Chronik** – Zeitpunkt des Imports.

Neben der Sortieroption steht ein Pfeil. Pfeil nach unten zeigt die normale Richtung des gewählten Kriteriums, Pfeil nach oben kehrt sie um. Bei „Manuell“ ist der Pfeil deaktiviert.

Beispiel: „A–Z Anfang“ mit Pfeil nach unten ergibt A–Z, mit Pfeil nach oben Z–A.

Wichtig: Keine automatische Sortierung verändert die manuelle Reihenfolge. Sie wird separat gespeichert und erscheint unverändert wieder, sobald „Manuell“ gewählt wird.

## Lieddauer und Höranzahl

Die App versucht beim Import die Dauer lokal zu ermitteln. Zusätzlich wird die Dauer beim ersten Laden eines Songs im Player gespeichert. In den Songzeilen steht sie im Format `MM:SS`.

Ein Song zählt als vollständig gehört, wenn der Player sein natürliches Ende erreicht. Wechsel zum nächsten Song, Zurückspringen oder anderes manuelles Überspringen erhöht den Zähler nicht.

## Loop-Vorschlag

1. Nutzer öffnet die nähere Songansicht oder wählt im `•••`-Menü „Loop erstellen“.
2. Josi analysiert die Audiodatei lokal.
3. Ein vorgeschlagener Start- und Endpunkt sowie ein Vertrauenswert werden gespeichert.
4. In der Detailansicht kann der Loop aktiviert, neu analysiert oder entfernt werden.
5. Songs mit gespeichertem Loop tragen eine rote Schleife und erscheinen im Tab „Loops“.

Die Erkennung ist experimentell und erkennt klangliche Ähnlichkeit, aber nicht zuverlässig musikalische Absicht oder perfekte Taktgrenzen.

## Playlist-Verwaltung

Das `•••` neben „Playlists“ ersetzt den früheren Langdruck und bietet insbesondere:

- Bearbeiten der manuellen Playlist-Reihenfolge,
- Öffnen der großen Playlist-Übersicht.

Auch einzelne Playlist-Einträge besitzen `•••` für playlistbezogene Aktionen.

## Navigation und Bearbeitungsverlauf

- Zurück und Vor öffnen die vorherige bzw. nächste besuchte Ansicht.
- Undo und Redo stehen direkt rechts daneben.
- Bei einer vorgemerkten manuellen Verschiebung erscheinen rechts von diesen vier Knöpfen ein grüner Haken und ein rotes X.

## System-Mediensteuerung

Josi meldet aktuellen Song und Wiedergabestatus über die Media Session API. Unterstützte Systemoberflächen können Play/Pause, vorherigen/nächsten Song und Positionswechsel anbieten. Die tatsächliche Hintergrundwiedergabe wird weiterhin von Safari/iPadOS gesteuert.

## Abgrenzung

Noch nicht Teil der aktuellen Version:

- Cloud-Synchronisierung oder Backend,
- Nutzerkonten im Produktablauf,
- automatische Metadaten-/Cover-Erkennung,
- Suche,
- Musik-Streaming,
- manuelles Feintuning der Loop-Punkte,
- Crossfade/Fading,
- native iOS-Hintergrund-Audio-Berechtigungen außerhalb der Möglichkeiten einer PWA.

Der experimentelle Ordnerimport bleibt entfernt.

## Offene Annahmen

- Die lokale Browser-Speicherkapazität reicht für einen realistischen ersten Test.
- Relevante Audioformate werden von Safari/iPadOS zuverlässig abgespielt.
- Drei-Punkte-Menüs sind auf dem iPad robuster als Langdruck-Gesten.
- Die manuelle Reihenfolge bleibt verständlich, obwohl temporär andere Sortierungen verwendet werden können.
- Höranzahl und Dauer sind hilfreiche Kriterien für größere Sammlungen.
- Die Daueranalyse beim Import bleibt bei realistischen Dateimengen schnell genug.
- Die experimentelle Loop-Analyse liefert bei einem relevanten Anteil der realen Musiksammlung brauchbare Vorschläge.
