# Produktkonzept

## Grundidee

Josi ist eine kleine, lokal laufende Musik-App für das iPad. Nutzer importieren eigene Audiodateien aus der Dateien-App, organisieren sie in Playlists und spielen sie direkt in Josi ab.

Der erste Proof of Concept validiert vor allem den Ablauf **Importieren → organisieren → zuverlässig abspielen**.

## Zielgruppe

Nutzer mit eigenen Musikdateien auf dem iPad, die diese ohne Streamingdienst einfach in Playlists organisieren und abspielen möchten.

## Kernfunktionen des Proof of Concept

- Mehrere lokale Audiodateien über den normalen Dateidialog importieren und lokal speichern.
- Bibliothek aller importierten Songs.
- Linke Navigation und Songbereich unabhängig voneinander scrollen.
- Player mit Play/Pause, Vor, Zurück, Fortschrittsanzeige, Autoplay, Shuffle und Wiederholung.
- Lange Songtitel im kompakten „Jetzt“-Bereich automatisch horizontal durchlaufen lassen: kurz am Anfang stehen, langsam bis zum Ende scrollen, dort kurz stehen und wieder von vorne beginnen.
- Mehrere Playlists erstellen, umbenennen, bebildern und löschen.
- Songs Playlists per Plus/Minus zuordnen.
- Unter jedem Songtitel anzeigen, in welchen Playlists der Song enthalten ist; sonst „In keiner Playlist“.
- Songdetailansicht mit Titel, Playlist-Zugehörigkeit, Scrubbing, vorherigem tatsächlich abgespieltem Song, ±10 Sekunden und nächstem Song.
- Reihenfolge von Songs in Bibliothek und Playlist bearbeiten.
- Reihenfolge der Playlists links bearbeiten; der Modus wird durch einen einsekündigen Langdruck auf „Playlists“ angeboten.
- Derselbe Langdruck bietet zusätzlich „Übersicht“ an. Diese Ansicht zeigt Playlists bildschirmfüllend als Galerie mit vier Karten pro Reihe auf iPad-Größe, großem Bild/Icon, vollständigem Namen und Liedanzahl.
- Sortieren ohne langes Ziehen: Element auswählen, zur Zielstelle scrollen, Zwischenraum antippen, rote Zielmarkierung sehen und mit Haken bestätigen oder mit X abbrechen.
- Oben links stehen Navigationspfeile für die vorherige und nächste App-Ansicht, ähnlich der Browser-Navigation.
- Media-Session-Integration für System-Mediensteuerungen wie Play/Pause, vorheriger/nächster Song und Scrubbing, soweit der verwendete Browser/iPadOS dies bereitstellt.
- Installierbare PWA ohne Backend.

## Zentrale Abläufe

### Musik importieren

1. Nutzer tippt auf „Musik importieren“.
2. Der normale Dateidialog öffnet sich.
3. Eine oder mehrere Audiodateien werden ausgewählt.
4. Josi speichert sie lokal und zeigt sie in der Bibliothek an.

### Musik abspielen

1. Nutzer öffnet Bibliothek oder Playlist.
2. Ein Song wird angetippt und startet.
3. Play/Pause sowie Vor/Zurück steuern die Wiedergabe.
4. Nach Songende startet automatisch der nächste Song.
5. Shuffle und Wiederholung können optional aktiviert werden.
6. Ein Tipp auf „Jetzt“ öffnet die Songdetailansicht ohne Wiedergabeunterbrechung.
7. Ist der Songname im kompakten Player zu lang, läuft er automatisch horizontal durch, damit der vollständige Titel lesbar ist.

### Songdetailansicht

1. Der vollständige Name des Songs steht groß oben.
2. Darunter steht die Playlist-Zugehörigkeit oder „In keiner Playlist“.
3. Der Fortschrittsregler lässt sich frei verschieben.
4. Darunter stehen fünf Bedienelemente: vorheriger tatsächlich abgespielter Song, 10 Sekunden zurück, Play/Pause, 10 Sekunden vor und nächster Song.

### Playlist-Übersicht

1. Nutzer hält „Playlists“ links etwa eine Sekunde gedrückt.
2. Neben „Bearbeiten“ erscheint „Übersicht“.
3. „Übersicht“ öffnet eine bildschirmfüllende Playlist-Galerie.
4. Auf iPad-Größe stehen vier Playlists in einer Reihe mit großzügigem Abstand.
5. Jede Karte zeigt das Playlist-Bild bzw. Icon, den vollständigen Namen und darunter „1 Lied“ bzw. „X Lieder“.
6. Ein Tipp auf eine Karte öffnet die Playlist.

### Songs sortieren

1. In Bibliothek oder Playlist wird „Reihenfolge ändern“ gewählt.
2. Ein Song wird über das Verschiebe-Symbol ausgewählt und bleibt zunächst an seinem ursprünglichen Platz.
3. Der Nutzer scrollt frei zur gewünschten Position.
4. Ein Tipp zwischen zwei Songs setzt dort einen roten Strich.
5. Oben links erscheinen ein grüner Haken und ein rotes X.
6. Der Haken bestätigt die Verschiebung; X verwirft sie.
7. „Fertig“ beendet den Bearbeitungsmodus.

### Playlist-Liste sortieren

1. Nutzer hält „Playlists“ links etwa eine Sekunde gedrückt.
2. Daneben erscheint „Bearbeiten“.
3. Ein Tipp außerhalb schließt diesen Eintrag, ohne eine andere Aktion auszulösen.
4. Nach „Bearbeiten“ wird eine Playlist über das Verschiebe-Symbol ausgewählt.
5. Der Nutzer scrollt zur Zielstelle und tippt zwischen zwei Playlists.
6. Ein roter Strich markiert die Zielposition.
7. Haken bestätigt, X verwirft.
8. „Fertig“ beendet den Bearbeitungsmodus.

### Navigation

- Oben links stehen dauerhaft „Zurück“ und „Vor“.
- Zurück öffnet die zuletzt besuchte App-Ansicht, etwa Bibliothek, Playlist, Playlist-Übersicht oder Songdetail.
- Vor wird aktiv, wenn nach einem Zurück-Schritt wieder eine spätere Ansicht verfügbar ist.
- Haken und X für eine vorgemerkte Verschiebung erscheinen rechts neben diesen Navigationspfeilen.

### System-Mediensteuerung

- Josi meldet den aktuellen Song und den Wiedergabestatus über die Media Session API an den Browser.
- Unterstützte Systemoberflächen können dadurch Play/Pause, vorherigen/nächsten Song und Positionswechsel anbieten, beispielsweise im Control Center oder Sperrbildschirm.
- Die PWA versucht die Wiedergabe beim App-Wechsel fortzuführen. Das tatsächliche Hintergrundverhalten wird jedoch von Safari/iPadOS gesteuert und kann nicht in derselben Weise garantiert oder konfiguriert werden wie bei einer nativen iOS-Musik-App.
- Unterbrechungen durch andere Audioquellen, Systemereignisse oder Browser-Lifecycle-Regeln werden vom Betriebssystem bzw. Browser behandelt.

## Abgrenzung

Noch nicht Teil der Minimum-Version:

- Cloud-Synchronisierung oder Backend,
- Nutzerkonten im Produktablauf,
- automatische Metadaten-/Cover-Erkennung für Songs,
- Suche,
- Musik-Streaming,
- Crossfade/Fading,
- native iOS-Hintergrund-Audio-Berechtigungen außerhalb der Möglichkeiten einer PWA.

## Offene Annahmen

- Die lokale Browser-Speicherkapazität reicht für einen realistischen ersten Test.
- Relevante Audioformate werden von Safari/iPadOS zuverlässig abgespielt.
- Das zweistufige Sortieren ist bei langen Listen schneller und verständlicher als Drag-and-Drop mit automatischem Scrollen.
- Die große Playlist-Übersicht verbessert die Auswahl bei vielen Playlists gegenüber der kompakten linken Liste.
- Media-Session-Steuerungen funktionieren auf den verwendeten iPadOS-/Safari-Versionen ausreichend zuverlässig für den PoC.
- Für eine spätere Produktversion müssen Backup, Speichergrenzen, Datenverlust bei Browser-/Gerätebereinigung und gegebenenfalls eine native App-Hülle für garantierte Hintergrundwiedergabe geprüft werden.
