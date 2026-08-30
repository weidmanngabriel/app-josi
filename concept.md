# Produktkonzept

## Grundidee

Josi ist eine kleine, lokal laufende Musik-App für das iPad. Nutzer importieren eigene Audiodateien aus der Dateien-App, organisieren sie in Playlists und spielen sie anschließend direkt in Josi ab.

Der erste Proof of Concept soll vor allem validieren, ob der Ablauf **Importieren → Playlist organisieren → zuverlässig abspielen** einen echten praktischen Nutzen bietet.

## Zielgruppe

Erste Zielgruppe sind Nutzer, die bereits eigene Musikdateien lokal auf ihrem iPad haben und diese ohne Streamingdienst einfach in Playlists organisieren und abspielen möchten.

## Kernfunktionen des Proof of Concept

- Mehrere lokale Audiodateien über den normalen Dateiauswahldialog importieren.
- Audiodateien dauerhaft im lokalen Browser-Speicher der App ablegen.
- Bibliothek aller importierten Songs anzeigen.
- Linke Navigation und Songbereich auf dem iPad unabhängig voneinander scrollen.
- Player mit Play/Pause, vorherigem Song, nächstem Song und Fortschrittsanzeige.
- Nach Ende eines Songs automatisch den nächsten Song der aktuellen Bibliothek oder Playlist abspielen.
- Shuffle für die aktuelle Wiedergabeliste ein- und ausschalten.
- Wiederholung aktivieren, damit nach dem letzten Song wieder der erste Song startet.
- Mehrere Playlists erstellen, umbenennen und nach Bestätigung wieder löschen.
- Für jede Playlist optional ein eigenes Bild hinterlegen.
- Songs Playlists zuordnen, ohne die Audiodatei zu duplizieren.
- Songs direkt in einer Playlist entfernen.
- Die Reihenfolge einer geöffneten Playlist in einem eigenen Bearbeitungsmodus per Finger-Drag ändern.
- Die Reihenfolge der Bibliothek ebenfalls per Finger-Drag ändern; der Bearbeitungsmodus wird durch einen einsekündigen Langdruck auf „Bibliothek“ angeboten.
- Die Reihenfolge der Playlists in der linken Navigation per Finger-Drag ändern; ein einsekündiger Langdruck auf „Playlists“ blendet dafür den kleinen Eintrag „Bearbeiten“ ein.
- Ein Tipp außerhalb dieses eingeblendeten „Bearbeiten“-Eintrags schließt ihn, ohne die darunterliegende Oberfläche mit diesem Tipp auszulösen.
- Im Player Playlists schnell per Plus/Minus verwalten: Playlists, in denen der aktuelle Song bereits enthalten ist, stehen zuerst; danach folgen zuletzt verwendete Playlists.
- Die kompakte „Jetzt“-Anzeige des Players öffnet eine eigene Detailansicht des laufenden Songs.
- In der Songdetailansicht stehen der vollständige Songname, die Playlist-Zugehörigkeit, eine frei verschiebbare Wiedergabeposition sowie fünf Bedienelemente für vorherigen tatsächlich abgespielten Song, 10 Sekunden zurück, Play/Pause, 10 Sekunden vor und nächsten Song zur Verfügung.
- Die Anwendung bleibt als PWA installierbar und funktioniert ohne Backend.

## Zentrale Abläufe

### Musik importieren

1. Nutzer tippt auf „Musik importieren“.
2. Der normale Dateidialog des Geräts öffnet sich.
3. Eine oder mehrere Audiodateien werden ausgewählt.
4. Josi speichert die Dateien lokal und zeigt sie in der Bibliothek an.

### Musik abspielen

1. Nutzer öffnet Bibliothek oder Playlist.
2. Ein Song wird angetippt und startet.
3. Play/Pause sowie Vor/Zurück steuern die Wiedergabe.
4. Shuffle kann die nächste Titelauswahl zufällig bestimmen.
5. Nach Songende startet automatisch der nächste Song der aktuellen Ansicht.
6. Wenn Wiederholung aktiv ist, beginnt die Liste nach dem letzten Song wieder von vorne.
7. Ein Tipp auf die „Jetzt“-Anzeige öffnet die Songdetailansicht, ohne die Wiedergabe zu unterbrechen.

### Songdetailansicht

1. Oben steht der vollständige Name des laufenden Songs.
2. Darunter steht, in welchen Playlists der Song enthalten ist; ohne Zuordnung wird „In keiner Playlist“ angezeigt.
3. Der Nutzer kann die Wiedergabeposition über einen Schieberegler direkt verändern.
4. Darunter stehen fünf große Bedienelemente: vorheriger tatsächlich abgespielter Song, 10 Sekunden zurück, Play/Pause, 10 Sekunden vor und nächster Song.
5. Der Zurück-Button ist deaktiviert, solange in der aktuellen Sitzung kein vorheriger Song abgespielt wurde.

### Playlist verwalten

1. Nutzer öffnet eine Playlist.
2. Name und Playlist-Bild können direkt geändert werden.
3. Songs können aus der Playlist entfernt werden.
4. Für die Reihenfolge tippt der Nutzer auf „Reihenfolge ändern“ und zieht Songs am Griff mit dem Finger an die gewünschte Position.
5. Mit „Fertig“ verlässt der Nutzer den Sortiermodus wieder.
6. Beim Löschen der Playlist fragt Josi vor dem endgültigen Löschen nach.
7. Gelöschte Playlists entfernen keine Audiodateien aus der Bibliothek.

### Bibliothek sortieren

1. Nutzer hält die Überschrift „Bibliothek“ etwa eine Sekunde gedrückt.
2. Ein kleiner Eintrag „Bearbeiten“ erscheint.
3. Nach Auswahl von „Bearbeiten“ erscheinen Griffe an den Songs.
4. Songs können per Finger-Drag neu angeordnet werden.
5. „Fertig“ beendet den Sortiermodus; die Reihenfolge bleibt lokal gespeichert.

### Playlist-Liste sortieren

1. Nutzer hält die Überschrift „Playlists“ in der linken Navigation etwa eine Sekunde gedrückt.
2. Ein kleiner Eintrag „Bearbeiten“ erscheint direkt daneben.
3. Ein Tipp außerhalb schließt den Eintrag und löst dabei keine darunterliegende Aktion aus.
4. Nach Auswahl von „Bearbeiten“ erscheinen Griffe an den Playlists.
5. Playlists können per Finger-Drag neu angeordnet werden.
6. „Fertig“ beendet den Sortiermodus; die Reihenfolge bleibt lokal gespeichert.

### Song schnell einer Playlist zuordnen

1. Während ein Song im Player aktiv ist, zeigt der Player die Playlists an.
2. Playlists, die den Song bereits enthalten, stehen oben und zeigen ein Minus.
3. Ein Klick auf Minus entfernt den Song.
4. Andere Playlists folgen nach letzter Verwendung und zeigen ein Plus.
5. Ein Klick auf Plus fügt den Song sofort hinzu.

## Abgrenzung des ersten Proof of Concept

Bewusst noch nicht Teil der Minimum-Version:

- Cloud-Synchronisierung oder Backend,
- Nutzerkonten oder Google Login im Produktablauf,
- automatische Metadaten-/Cover-Erkennung für Songs,
- Suche,
- Musik-Streaming,
- Crossfade/Fading zwischen Songs.

Crossfade ist als mögliche nächste Erweiterung vorgesehen, sobald Import, Playlist-Verwaltung und Autoplay auf dem iPad stabil funktionieren.

## Offene Annahmen

- Die vom Browser bereitgestellte lokale Speicherkapazität reicht für einen realistischen ersten Test mit der persönlichen Musiksammlung aus.
- Die relevanten Audioformate werden von Safari/iPadOS zuverlässig abgespielt.
- Die eigenen Touch-Sortiermodi funktionieren auf den für den Test verwendeten iPadOS-/Safari-Versionen zuverlässig genug, auch bei längeren Listen.
- Unabhängiges Scrollen von Navigation und Songbereich fühlt sich auf dem Ziel-iPad natürlicher an als das bisherige gemeinsame Seitenscrollen.
- Für eine spätere Produktversion muss geprüft werden, wie Backups, Speichergrenzen und Datenverlust bei Browser-/Gerätebereinigung behandelt werden.
