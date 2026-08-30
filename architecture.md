# Architektur

## Überblick

Die Anwendung ist eine rein clientseitige React-App mit TypeScript und Vite. Der Einstieg liegt in `src/main.tsx`, die Musikoberfläche in `src/App.tsx`, die lokale Musikdatenbank in `src/musicDb.ts` und das globale Styling in `src/styles.css`. Zusätzliche Styles für Playlist-Galerie, Import-Markierung, Loop-Funktionen, Auswahlmodus, Drei-Punkte-Menüs, Sortierung und Playlist-Dialog liegen in `src/enhancements.css`.

Josi ist im aktuellen Proof of Concept eine lokale Musik-App ohne Backend. Audiodateien und Playlists bleiben auf dem jeweiligen Gerät im Browser-Speicher.

## Lokale Musikdaten

### Songs

Ein Song enthält ID, Anzeigename, Audiodatei als Blob, MIME-Typ, Importzeitpunkt, optionale Bibliotheksposition, Import-Batch-ID, Neu-Status sowie optionale Wiedergabe- und Loop-Daten:

- `duration`: Lieddauer in Sekunden,
- `completedPlays`: Anzahl vollständig beendeter Wiedergaben,
- `loopStart`, `loopEnd`, `loopEnabled`, `loopConfidence`.

Die Dauer wird beim Import soweit möglich lokal über `AudioContext.decodeAudioData()` ermittelt. Falls das scheitert, wird sie spätestens beim Laden des Songs im HTML-Audio-Element gespeichert.

`completedPlays` wird ausschließlich beim normalen `ended`-Ereignis erhöht. Manuelles Vor-/Zurückspringen oder Wechseln zum nächsten Song zählt nicht als vollständig gehört.

`saveSong()` speichert einzelne Song-Änderungen. `saveSongOrder()` speichert Sammeländerungen und die manuelle Bibliotheksreihenfolge.

### Playlists

Playlists enthalten ID, Name, geordnete Song-IDs, optionales Bild, Erstellungs-/Nutzungszeit und optionale manuelle Sortierposition. Audiodateien werden nicht pro Playlist dupliziert.

## Dateiimport und Verlauf

Der Import verwendet ausschließlich `<input type="file" multiple>`. Der experimentelle Ordnerimport bleibt entfernt.

Jeder neue Import erhält eine `importBatchId`. Neue Songs bekommen `isNew: true`; vor einem neuen Import werden bestehende Neu-Markierungen entfernt. Der Verlauf ist keine zweite Datenkopie, sondern eine Ansicht derselben Songs.

## Ansichten und Navigation

Die Hauptansichten sind Bibliothek bzw. geöffnete Playlist, Verlauf, Loops, Playlist-Übersicht und Songdetail. Zurück/Vor bewegen sich im Sitzungsverlauf. Undo/Redo bleibt davon getrennt und arbeitet mit Snapshots von Songs und Playlists.

Oben links stehen Zurück, Vor, Undo und Redo. Bei einer vorgemerkten manuellen Verschiebung folgen Haken und X.

## Drei-Punkte-Menüs statt Langdruck

Langdruck-Gesten werden nicht mehr für Funktionen verwendet. Das reduziert Konflikte mit Scrollen, Auswahl und iPad-Gesten.

Stattdessen gibt es sichtbare `•••`-Knöpfe:

- neben der Überschrift „Playlists“ für Bearbeiten und Übersicht,
- an Playlist-Einträgen für Playlist-bezogene Aktionen,
- an Songzeilen für Song-Aktionen wie „Als gesehen markieren“ und „Loop erstellen“.

Die Menüs sind der vorgesehene Erweiterungspunkt für weitere Aktionen. Es gibt keine einsekündigen Pointer-Timer mehr.

## Songlisten und Mehrfachauswahl

Bibliothek, geöffnete Playlist, Verlauf und Loops verwenden denselben Auswahlmechanismus. „Auswählen“ aktiviert den Modus, „Alle“ markiert die aktuell sichtbare Liste.

Der frühere zusätzliche Knopf „Zu Playlist“ in der Kopfzeile ist entfernt. Stattdessen bleibt der bestehende Kasten „Alle Playlists“ unten rechts auch im Auswahlmodus verfügbar. Dann öffnet er den Playlist-Dialog für die gesamte Auswahl.

## Playlist-Dialog

Der kompakte Player zeigt unten rechts „Alle Playlists“. Im normalen Modus verwaltet der Dialog den aktuellen Song, im Auswahlmodus ordnet er alle ausgewählten Songs zu.

Playlists werden numerisch/alphabetisch sortiert und nach erstem Zeichen gruppiert: Symbole (`#`), Zahlen (`0–9`) und danach Buchstaben.

## Sortierung

Alle Songlisten verwenden dieselbe Sortiersteuerung:

- `Manuell`
- `A–Z Anfang`
- `A–Z Ende`
- `Anzahl des Hörens`
- `Dauer`
- `Chronik`

`A–Z Ende` vergleicht den Namen vom letzten Zeichen nach vorne. Für alle Modi außer `Manuell` kann die Reihenfolge mit einem Pfeil umgekehrt werden. Pfeil nach unten entspricht der normalen Richtung des jeweiligen Vergleichs; Pfeil nach oben kehrt sie um.

Die gewählte Sortierart und Richtung werden in `localStorage` gespeichert. Sie verändern niemals `libraryOrder` oder `playlist.songIds`. Dadurch bleibt die selbst erstellte manuelle Reihenfolge dauerhaft erhalten und kann jederzeit mit `Manuell` wieder angezeigt werden.

Manuelles Verschieben setzt die aktuelle Ansicht auf `Manuell`, bevor die gespeicherte Reihenfolge verändert wird.

## Loop-Analyse

Die Loop-Funktion läuft vollständig lokal. `AudioContext.decodeAudioData()` dekodiert die Audiodatei. Die Heuristik vergleicht kurze normalisierte Audiofenster, bevorzugt sinnvolle Mindestlängen und speichert den besten Kandidaten als Start, Ende und Vertrauenswert.

Diese Analyse erkennt klangliche Ähnlichkeit und ist ausdrücklich experimentell. Wenn ein Loop aktiv ist, setzt das vorhandene HTML-Audio-Element beim Erreichen von `loopEnd` auf `loopStart` zurück.

Songs mit gespeicherten Loop-Punkten werden mit einer roten Schleife markiert und erscheinen zusätzlich in „Loops“.

## Player und Media Session

Der Player verwendet ein einzelnes HTML-Audio-Element für Play/Pause, Fortschritt, Vor/Zurück, Autoplay, Shuffle und Wiederholung. Wenn `navigator.mediaSession` verfügbar ist, werden Metadaten und Systemaktionen registriert.

Eine PWA kann keine native `AVAudioSession` oder iOS-Background-Mode-Berechtigung konfigurieren; tatsächliche Hintergrundwiedergabe bleibt von Safari/WebKit und iPadOS abhängig.

## Manuelles Sortieren und Playlist-Verwaltung

Songs in Bibliothek und Playlist sowie Playlists in der linken Leiste behalten das zweistufige manuelle Verschieben: Element auswählen, Zielzwischenraum markieren, anschließend mit Haken bestätigen oder X abbrechen.

Der Einstieg für die Playlist-Reihenfolge liegt nun im `•••`-Menü neben „Playlists“, nicht mehr auf einem Langdruck.

Playlists können erstellt, umbenannt, bebildert und gelöscht werden. Beim Löschen bleiben Songdateien erhalten.

## PWA und Deployment

`vite-plugin-pwa` erzeugt Manifest und Service Worker. Der Vite-Basispfad bleibt relativ (`./`). `.github/workflows/deploy.yml` baut Änderungen auf `main` und veröffentlicht `dist` über GitHub Pages.

## Grenzen

IndexedDB-Speicher wird vom Browser bzw. Betriebssystem verwaltet. Vor einer produktiven Nutzung müssen Speichergrenzen, Bereinigung, Backup und Wiederherstellung auf iPadOS geprüft werden.

Die Loop-Heuristik sowie die Messung großer Musikbibliotheken beim Import sollten mit realen Sammlungen getestet werden. Bei sehr vielen großen Dateien kann die lokale Daueranalyse beim Import spürbar Rechenzeit benötigen.
