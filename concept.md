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
- Player mit Play/Pause, vorherigem Song, nächstem Song und Fortschrittsanzeige.
- Nach Ende eines Songs automatisch den nächsten Song der aktuellen Bibliothek oder Playlist abspielen.
- Shuffle für die aktuelle Wiedergabeliste ein- und ausschalten.
- Wiederholung aktivieren, damit nach dem letzten Song wieder der erste Song startet.
- Mehrere Playlists erstellen, umbenennen und nach Bestätigung wieder löschen.
- Für jede Playlist optional ein eigenes Bild hinterlegen.
- Songs Playlists zuordnen, ohne die Audiodatei zu duplizieren.
- Songs direkt in einer Playlist entfernen.
- Die Reihenfolge einer Playlist per Drag-and-Drop ändern.
- Im Player Playlists schnell per Plus/Minus verwalten: Playlists, in denen der aktuelle Song bereits enthalten ist, stehen zuerst; danach folgen zuletzt verwendete Playlists.
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

### Playlist verwalten

1. Nutzer öffnet eine Playlist.
2. Name und Playlist-Bild können direkt geändert werden.
3. Songs können aus der Playlist entfernt und per Drag-and-Drop neu sortiert werden.
4. Beim Löschen der Playlist fragt Josi vor dem endgültigen Löschen nach.
5. Gelöschte Playlists entfernen keine Audiodateien aus der Bibliothek.

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
- Drag-and-Drop funktioniert auf den für den Test verwendeten iPadOS-/Safari-Versionen ausreichend zuverlässig.
- Für eine spätere Produktversion muss geprüft werden, wie Backups, Speichergrenzen und Datenverlust bei Browser-/Gerätebereinigung behandelt werden.
