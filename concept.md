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
- Mehrere Playlists erstellen, umbenennen, bebildern und löschen.
- Songs Playlists per Plus/Minus zuordnen.
- Unter jedem Songtitel anzeigen, in welchen Playlists der Song enthalten ist; sonst „In keiner Playlist“.
- Songdetailansicht mit Titel, Playlist-Zugehörigkeit, Scrubbing, vorherigem tatsächlich abgespieltem Song, ±10 Sekunden und nächstem Song.
- Reihenfolge von Songs in Bibliothek und Playlist bearbeiten.
- Reihenfolge der Playlists links bearbeiten; der Modus wird durch einen einsekündigen Langdruck auf „Playlists“ angeboten.
- Sortieren ohne langes Ziehen: Element auswählen, zur Zielstelle scrollen, Zwischenraum antippen, rote Zielmarkierung sehen und mit Haken bestätigen oder mit X abbrechen.
- Dauerhafte Undo-/Redo-Knöpfe oben links für die wesentlichen Bearbeitungen der laufenden Sitzung.
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

### Songdetailansicht

1. Der vollständige Name des Songs steht groß oben.
2. Darunter steht die Playlist-Zugehörigkeit oder „In keiner Playlist“.
3. Der Fortschrittsregler lässt sich frei verschieben.
4. Darunter stehen fünf Bedienelemente: vorheriger tatsächlich abgespielter Song, 10 Sekunden zurück, Play/Pause, 10 Sekunden vor und nächster Song.

### Songs sortieren

1. In Bibliothek oder Playlist wird „Reihenfolge ändern“ gewählt.
2. Ein Song wird über das Verschiebe-Symbol ausgewählt und bleibt zunächst an seinem ursprünglichen Platz.
3. Der Nutzer scrollt frei zur gewünschten Position.
4. Ein Tipp zwischen zwei Songs setzt dort einen roten Strich.
5. Oben links erscheinen rechts neben Undo/Redo ein grüner Haken und ein rotes X.
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

### Undo und Redo

- Undo und Redo stehen dauerhaft oben links an der früheren Stelle des Josi-Namens.
- Haken und X erscheinen bei einer vorgemerkten Verschiebung immer rechts daneben.
- Der Verlauf deckt die wesentlichen Bearbeitungen an Playlists, Zuordnungen und Reihenfolgen ab.
- Das Entfernen frisch importierter Audiodateien per Undo ist im aktuellen PoC nicht vorgesehen.

## Abgrenzung

Noch nicht Teil der Minimum-Version:

- Cloud-Synchronisierung oder Backend,
- Nutzerkonten im Produktablauf,
- automatische Metadaten-/Cover-Erkennung für Songs,
- Suche,
- Musik-Streaming,
- Crossfade/Fading.

## Offene Annahmen

- Die lokale Browser-Speicherkapazität reicht für einen realistischen ersten Test.
- Relevante Audioformate werden von Safari/iPadOS zuverlässig abgespielt.
- Das neue zweistufige Sortieren ist bei langen Listen schneller und verständlicher als Drag-and-Drop mit automatischem Scrollen.
- Undo/Redo innerhalb einer laufenden Sitzung reduziert Fehler beim Organisieren ausreichend.
- Für eine spätere Produktversion müssen Backup, Speichergrenzen und Datenverlust bei Browser-/Gerätebereinigung geprüft werden.
