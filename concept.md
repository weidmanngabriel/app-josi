# Produktkonzept

## Grundidee

Josi ist eine kleine, lokal laufende Musik-App für das iPad. Nutzer importieren eigene Audiodateien aus der Dateien-App, organisieren sie in Playlists und spielen sie direkt in Josi ab.

Der Proof of Concept validiert vor allem den Ablauf **Importieren → organisieren → zuverlässig abspielen** und erweitert ihn schrittweise um Funktionen für größere lokale Musiksammlungen.

## Zielgruppe

Nutzer mit eigenen Musikdateien auf dem iPad, die diese ohne Streamingdienst einfach in Playlists organisieren und abspielen möchten.

## Kernfunktionen

- Mehrere lokale Audiodateien über den normalen Dateidialog importieren und lokal speichern.
- Bibliothek aller importierten Songs.
- Unter „Bibliothek“ ein eigener „Verlauf“-Tab mit chronologisch importierten Dateien.
- Songs des neuesten Imports blau markieren; ein neuer Import normalisiert automatisch die vorherige blaue Gruppe.
- Einen Song per Langdruck „Als gesehen markieren“ oder alle neuen Songs gleichzeitig als gesehen markieren.
- Unter „Verlauf“ ein eigener „Loops“-Tab für Songs mit gespeichertem Loop-Vorschlag.
- Songs mit gespeichertem Loop am rechten Ende ihrer Zeile mit einer roten Schleife markieren.
- Songdetailansicht mit experimenteller Loop-Analyse: Josi schlägt Start und Ende eines Loops vor und zeigt einen Vertrauenswert. Der Nutzer kann den Vorschlag aktivieren, neu analysieren oder entfernen.
- Linke Navigation und Songbereich unabhängig voneinander scrollen.
- Player mit Play/Pause, Vor, Zurück, Fortschrittsanzeige, Autoplay, Shuffle und Wiederholung.
- Lange Songtitel im kompakten „Jetzt“-Bereich automatisch horizontal durchlaufen lassen.
- Mehrere Playlists erstellen, umbenennen, bebildern und löschen.
- Unter jedem Songtitel anzeigen, in welchen Playlists der Song enthalten ist; sonst „In keiner Playlist“.
- In allen Songlisten eine „Auswählen“-Funktion verwenden, mehrere Songs markieren und gesammelt einer Playlist zuordnen.
- Die Playlist-Zuordnung unten rechts über einen einzigen Kasten „Alle Playlists“ öffnen. Die Liste ist alphabetisch bzw. numerisch gruppiert; Zahlen und Symbole stehen vor den Buchstaben-Gruppen.
- Reihenfolge von Songs in Bibliothek und Playlist bearbeiten.
- Reihenfolge der Playlists links bearbeiten; der Modus wird durch einen einsekündigen Langdruck auf „Playlists“ angeboten.
- Derselbe Langdruck bietet zusätzlich „Übersicht“ an. Diese Ansicht zeigt Playlists bildschirmfüllend als Galerie mit vier Karten pro Reihe auf iPad-Größe.
- Sortieren ohne langes Ziehen: Element auswählen, zur Zielstelle scrollen, Zwischenraum antippen, rote Zielmarkierung sehen und mit Haken bestätigen oder mit X abbrechen.
- Oben links stehen in dieser Reihenfolge Zurück, Vor, Undo und Redo. Bei einer vorgemerkten Verschiebung folgen rechts davon Haken und X.
- Media-Session-Integration für System-Mediensteuerungen, soweit der verwendete Browser/iPadOS dies bereitstellt.
- Installierbare PWA ohne Backend.

## Zentrale Abläufe

### Musik importieren

1. Nutzer tippt auf „Musik importieren“.
2. Der normale Dateidialog öffnet sich.
3. Eine oder mehrere Audiodateien werden ausgewählt.
4. Josi markiert die bisherige „Neu“-Gruppe als gesehen.
5. Josi speichert die neuen Dateien lokal und markiert genau diesen neuesten Import blau.
6. Die Dateien erscheinen zusätzlich im Verlauf mit Importzeitpunkt.

Der experimentelle Ordnerimport wurde wieder entfernt, weil er im Zielgerät nicht zuverlässig funktioniert hat.

### Neue Importe prüfen

1. Songs des neuesten Imports sind in Bibliothek und Verlauf blau hervorgehoben.
2. Ein etwa einsekündiger Langdruck auf einen Song öffnet ein kleines Menü.
3. „Als gesehen markieren“ entfernt die blaue Markierung nur bei diesem Song.
4. „Alle als gesehen markieren“ entfernt alle aktuellen Neu-Markierungen.
5. Beim nächsten Import werden verbliebene Markierungen des vorherigen Imports automatisch normalisiert.

### Mehrere Songs auswählen

1. In Bibliothek, Playlist, Verlauf oder Loops wird „Auswählen“ gewählt.
2. Mehrere Songs werden markiert; „Alle“ markiert die aktuell sichtbare Liste vollständig.
3. „Zu Playlist“ öffnet die alphabetisch gruppierte Playlist-Liste.
4. Ein Tipp auf eine Playlist fügt alle ausgewählten Songs hinzu, ohne Audiodateien zu duplizieren.

### Playlist-Zuordnung des aktuellen Songs

1. Unten rechts steht nur der Kasten „Alle Playlists“.
2. Ein Tipp öffnet die vollständige Playlist-Liste.
3. Gruppen werden in der Reihenfolge Symbole, Zahlen und danach Buchstaben angezeigt.
4. Innerhalb jeder Gruppe stehen Playlists alphabetisch.
5. Plus bzw. Minus fügt den aktuellen Song hinzu oder entfernt ihn sofort.

### Loop-Vorschlag

1. Nutzer öffnet die nähere Songansicht.
2. „Loop vorschlagen“ analysiert die Audiodatei lokal auf dem Gerät.
3. Josi vergleicht kurze Klangabschnitte und sucht zwei Stellen, die als Übergang ähnlich klingen.
4. Ein vorgeschlagener Start- und Endpunkt sowie ein Vertrauenswert werden angezeigt.
5. „Loop aktivieren“ lässt den Player beim Endpunkt zum Startpunkt springen.
6. „Neu analysieren“ berechnet einen neuen Vorschlag; „Loop entfernen“ löscht den gespeicherten Vorschlag.
7. Songs mit gespeichertem Vorschlag tragen in Listen eine rote Schleife und erscheinen im Tab „Loops“.

Die Loop-Erkennung ist ausdrücklich experimentell. Sie erkennt klangliche Ähnlichkeit, aber nicht zuverlässig musikalische Absicht, Taktstruktur oder den perfekten Übergang bei jedem Lied.

### Playlist-Übersicht

1. Nutzer hält „Playlists“ links etwa eine Sekunde gedrückt.
2. Neben „Bearbeiten“ erscheint „Übersicht“.
3. „Übersicht“ öffnet eine bildschirmfüllende Playlist-Galerie.
4. Auf iPad-Größe stehen vier Playlists in einer Reihe mit großzügigem Abstand.
5. Jede Karte zeigt Playlist-Bild bzw. Icon, vollständigen Namen und Liedanzahl.

### Navigation und Bearbeitungsverlauf

- Zurück und Vor öffnen die vorherige bzw. nächste besuchte App-Ansicht.
- Undo und Redo stehen direkt rechts daneben und betreffen den Bearbeitungsverlauf.
- Bei einer vorgemerkten Verschiebung erscheinen rechts von diesen vier Knöpfen ein grüner Haken und ein rotes X.

### System-Mediensteuerung

- Josi meldet den aktuellen Song und den Wiedergabestatus über die Media Session API an den Browser.
- Unterstützte Systemoberflächen können dadurch Play/Pause, vorherigen/nächsten Song und Positionswechsel anbieten.
- Die PWA versucht die Wiedergabe beim App-Wechsel fortzuführen. Das tatsächliche Hintergrundverhalten wird jedoch von Safari/iPadOS gesteuert.

## Abgrenzung

Noch nicht Teil der aktuellen Version:

- Cloud-Synchronisierung oder Backend,
- Nutzerkonten im Produktablauf,
- automatische Metadaten-/Cover-Erkennung für Songs,
- Suche,
- Musik-Streaming,
- manuelles Feintuning der automatisch vorgeschlagenen Loop-Punkte,
- Crossfade/Fading,
- native iOS-Hintergrund-Audio-Berechtigungen außerhalb der Möglichkeiten einer PWA.

## Offene Annahmen

- Die lokale Browser-Speicherkapazität reicht für einen realistischen ersten Test.
- Relevante Audioformate werden von Safari/iPadOS zuverlässig abgespielt.
- Der Verlauf und die blaue Neu-Markierung helfen bei größeren Importen, neue Dateien schnell wiederzufinden.
- Mehrfachauswahl reduziert den Aufwand beim Zuordnen größerer Songgruppen zu Playlists.
- Die gruppierte „Alle Playlists“-Ansicht bleibt auch bei vielen Playlists schnell verständlich.
- Die experimentelle Loop-Analyse liefert bei einem relevanten Anteil der realen Musiksammlung brauchbare Vorschläge; dies muss praktisch getestet werden.
- Media-Session-Steuerungen funktionieren auf den verwendeten iPadOS-/Safari-Versionen ausreichend zuverlässig für den PoC.
- Für eine spätere Produktversion müssen Backup, Speichergrenzen, Datenverlust bei Browser-/Gerätebereinigung und gegebenenfalls eine native App-Hülle geprüft werden.
