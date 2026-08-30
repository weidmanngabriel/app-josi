# Produktkonzept

## Grundidee

Josi ist eine kleine, lokal laufende Musik-App für das iPad. Nutzer importieren eigene Audiodateien aus der Dateien-App, organisieren sie in Playlists und spielen sie direkt in Josi ab.

Der erste Proof of Concept validiert vor allem den Ablauf **Importieren → organisieren → zuverlässig abspielen**.

## Zielgruppe

Nutzer mit eigenen Musikdateien auf dem iPad, die diese ohne Streamingdienst einfach in Playlists organisieren und abspielen möchten.

## Kernfunktionen des Proof of Concept

- Mehrere lokale Audiodateien über den normalen Dateidialog importieren und lokal speichern.
- Auf unterstützten iPadOS-/Safari-Versionen ganze Ordner über den Dateidialog importieren.
- Bibliothek aller importierten Songs.
- Unter „Bibliothek“ einen eigenen „Verlauf“-Tab mit den zuletzt importierten Dateien anzeigen.
- Songs des neuesten Imports blau markieren; ein neuer Import normalisiert automatisch die vorherige blaue Gruppe.
- Einen Song per Langdruck „Als gesehen markieren“ oder alle neuen Songs gleichzeitig als gesehen markieren.
- Linke Navigation und Songbereich unabhängig voneinander scrollen.
- Player mit Play/Pause, Vor, Zurück, Fortschrittsanzeige, Autoplay, Shuffle und Wiederholung.
- Lange Songtitel im kompakten „Jetzt“-Bereich automatisch horizontal durchlaufen lassen.
- Mehrere Playlists erstellen, umbenennen, bebildern und löschen.
- Songs Playlists per Plus/Minus zuordnen.
- Unter jedem Songtitel anzeigen, in welchen Playlists der Song enthalten ist; sonst „In keiner Playlist“.
- Songdetailansicht mit Titel, Playlist-Zugehörigkeit, Scrubbing, vorherigem tatsächlich abgespieltem Song, ±10 Sekunden und nächstem Song.
- Reihenfolge von Songs in Bibliothek und Playlist bearbeiten.
- Reihenfolge der Playlists links bearbeiten; der Modus wird durch einen einsekündigen Langdruck auf „Playlists“ angeboten.
- Derselbe Langdruck bietet zusätzlich „Übersicht“ an. Diese Ansicht zeigt Playlists bildschirmfüllend als Galerie mit vier Karten pro Reihe auf iPad-Größe.
- Sortieren ohne langes Ziehen: Element auswählen, zur Zielstelle scrollen, Zwischenraum antippen, rote Zielmarkierung sehen und mit Haken bestätigen oder mit X abbrechen.
- Oben links stehen in dieser Reihenfolge Zurück, Vor, Undo und Redo. Bei einer vorgemerkten Verschiebung folgen rechts davon Haken und X.
- Media-Session-Integration für System-Mediensteuerungen, soweit der verwendete Browser/iPadOS dies bereitstellt.
- Installierbare PWA ohne Backend.

## Zentrale Abläufe

### Musik importieren

1. Nutzer tippt auf „Musik importieren“ oder „Ordner importieren“.
2. Der normale Dateidialog öffnet sich.
3. Eine oder mehrere Audiodateien bzw. ein Ordner werden ausgewählt.
4. Josi markiert die bisherige „Neu“-Gruppe als gesehen.
5. Josi speichert die neuen Dateien lokal und markiert genau diesen neuesten Import blau.
6. Die Dateien erscheinen zusätzlich im Verlauf mit Importzeitpunkt und – falls verfügbar – relativem Ordnerpfad.

### Neue Importe prüfen

1. Songs des neuesten Imports sind in Bibliothek und Verlauf blau hervorgehoben.
2. Ein etwa einsekündiger Langdruck auf einen Song öffnet ein kleines Menü.
3. „Als gesehen markieren“ entfernt die blaue Markierung nur bei diesem Song.
4. „Alle als gesehen markieren“ entfernt alle aktuellen Neu-Markierungen.
5. Beim nächsten Import werden verbliebene Markierungen des vorherigen Imports automatisch normalisiert.

### Musik abspielen

1. Nutzer öffnet Bibliothek oder Playlist.
2. Ein Song wird angetippt und startet.
3. Play/Pause sowie Vor/Zurück steuern die Wiedergabe.
4. Nach Songende startet automatisch der nächste Song.
5. Shuffle und Wiederholung können optional aktiviert werden.
6. Ein Tipp auf „Jetzt“ öffnet die Songdetailansicht ohne Wiedergabeunterbrechung.
7. Ist der Songname im kompakten Player zu lang, läuft er automatisch horizontal durch.

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

## Loop-Erkennung

Eine automatische Erkennung musikalischer Loop-Punkte ist grundsätzlich möglich, gehört aber noch nicht zum PoC. Ein zuverlässiger Automatismus müsste Audio analysieren und passende Übergangspunkte anhand von Rhythmus, Ähnlichkeit und Übergangsklang schätzen. Das ist deutlich aufwendiger und fehleranfälliger als ein normaler Wiederholungsmodus.

Als spätere Erweiterung ist ein Schalter „Loop / Kein Loop“ denkbar. Für einen ersten Test wäre eine manuell oder halbautomatisch vorgeschlagene Loop-Stelle sinnvoller als eine vollständig automatische Erkennung.

## Abgrenzung

Noch nicht Teil der Minimum-Version:

- Cloud-Synchronisierung oder Backend,
- Nutzerkonten im Produktablauf,
- automatische Metadaten-/Cover-Erkennung für Songs,
- Suche,
- Musik-Streaming,
- automatische Loop-Punkt-Erkennung,
- Crossfade/Fading,
- native iOS-Hintergrund-Audio-Berechtigungen außerhalb der Möglichkeiten einer PWA.

## Offene Annahmen

- Die lokale Browser-Speicherkapazität reicht für einen realistischen ersten Test.
- Relevante Audioformate werden von Safari/iPadOS zuverlässig abgespielt.
- Ordnerimport ist auf dem verwendeten iPadOS/Safari verfügbar; bei älteren Versionen bleibt Mehrfach-Dateiauswahl der Fallback.
- Der Verlauf und die blaue Neu-Markierung helfen bei größeren Importen, neue Dateien schnell wiederzufinden.
- Media-Session-Steuerungen funktionieren auf den verwendeten iPadOS-/Safari-Versionen ausreichend zuverlässig für den PoC.
- Für eine spätere Produktversion müssen Backup, Speichergrenzen, Datenverlust bei Browser-/Gerätebereinigung und gegebenenfalls eine native App-Hülle geprüft werden.
