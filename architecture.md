# Architektur

## Überblick

Die Anwendung ist eine rein clientseitige React-App mit TypeScript und Vite. Der Einstieg liegt in `src/main.tsx`, die Musikoberfläche in `src/App.tsx`, die lokale Musikdatenbank in `src/musicDb.ts` und das globale Styling in `src/styles.css`. Zusätzliche Styles liegen in `src/enhancements.css`; der manuelle Loop-Editor hat eigene Styles in `src/loopEditor.css`.

Josi ist im aktuellen Proof of Concept eine lokale Musik-App ohne Backend. Audiodateien und Playlists bleiben auf dem jeweiligen Gerät im Browser-Speicher.

## Lokale Musikdaten

### Songs

Ein Song enthält ID, Anzeigename, Audiodatei als Blob, MIME-Typ, Importzeitpunkt, optionale Bibliotheksposition, Import-Batch-ID, Neu-Status sowie optionale Wiedergabe- und Loop-Daten:

- `duration`: Lieddauer in Sekunden,
- `completedPlays`: Anzahl vollständig beendeter Wiedergaben,
- `loopStart`, `loopEnd`, `loopEnabled`.

`loopConfidence` kann in älteren Datensätzen noch vorkommen, wird vom aktuellen manuellen Loop-Editor aber nicht mehr verwendet.

Die Dauer wird nicht mehr beim Import über `AudioContext` analysiert. Sie wird erst gespeichert, wenn das normale HTML-Audio-Element die Datei tatsächlich lädt und `loadedmetadata` liefert. Dadurch bleibt der Import möglichst leichtgewichtig.

`completedPlays` wird ausschließlich beim normalen `ended`-Ereignis erhöht. Manuelles Überspringen zählt nicht als vollständig gehört.

### Playlists

Playlists enthalten ID, Name, geordnete Song-IDs, optionales Bild, Erstellungs-/Nutzungszeit und optionale manuelle Sortierposition. Audiodateien werden nicht pro Playlist dupliziert.

## Dateiimport und Speicherstabilität

Der Import verwendet ausschließlich `<input type="file" multiple>`. Vor dem Öffnen wird der Wert des File-Inputs geleert, damit auch eine erneute Auswahl derselben Datei zuverlässig ein neues `change`-Ereignis auslösen kann.

Beim Import werden nur die tatsächlich neu ausgewählten Dateien in IndexedDB geschrieben. Die frühere Implementierung schrieb vor jedem Import die gesamte vorhandene Bibliothek erneut, um den Neu-Status zu ändern. Das wurde entfernt, weil große Audio-Blobs dabei unnötig erneut geschrieben wurden und auf iPadOS zusätzlichen Speicher- und Quota-Druck erzeugen konnten.

Vorherige Neu-Markierungen werden nur noch bei den tatsächlich als neu markierten Songs einzeln aktualisiert. Neue Dateien werden anschließend direkt gespeichert. Eine Daueranalyse blockiert den Import nicht mehr.

`--:--` bedeutet ausschließlich, dass die Dauer noch nicht bekannt ist. Wenn der gespeicherte Blob fehlt oder Größe `0` hat, zeigt die Oberfläche stattdessen `FEHLT`. Ein solcher Blob kann technisch nicht aus Metadaten rekonstruiert werden und muss neu importiert werden.

Der Browser bzw. iPadOS verwaltet IndexedDB-Speicher. Bei Speicherknappheit kann Web-Speicher begrenzt oder entfernt werden; Josi kann verlorene Audiodaten ohne erneuten Zugriff auf die Originaldatei nicht wiederherstellen.

## Ansichten und Navigation

Die Hauptansichten sind Bibliothek bzw. geöffnete Playlist, Verlauf, Loops, Playlist-Übersicht, Songdetail und der bildschirmfüllende Loop-Editor. Zurück/Vor bewegen sich im Sitzungsverlauf; beim offenen Loop-Editor schließt Zurück zunächst den Editor.

Undo/Redo bleibt davon getrennt und arbeitet mit Snapshots von Songs und Playlists. Bei einer vorgemerkten manuellen Verschiebung folgen Haken und X.

## Drei-Punkte-Menüs

Langdruck-Gesten werden nicht mehr für Funktionen verwendet. Stattdessen gibt es sichtbare `•••`-Knöpfe bei Songs, Playlists und neben der Überschrift „Playlists“.

Das Song-Menü enthält unter anderem „Als gesehen markieren“ und „Loop erstellen“ bzw. „Loop bearbeiten“. „Loop erstellen“ öffnet direkt den manuellen Loop-Editor und führt keine automatische Audioanalyse mehr aus.

## Songlisten und Mehrfachauswahl

Bibliothek, geöffnete Playlist, Verlauf und Loops verwenden denselben Auswahlmechanismus. „Auswählen“ aktiviert den Modus, „Alle“ markiert die aktuell sichtbare Liste.

Die Playlist-Zuordnung erfolgt ausschließlich über „Alle Playlists“ unten rechts. Im Auswahlmodus wird damit die gesamte Auswahl einer Playlist zugeordnet.

## Playlist-Dialog

Playlists werden numerisch/alphabetisch sortiert und nach erstem Zeichen gruppiert: Symbole (`#`), Zahlen (`0–9`) und danach Buchstaben.

## Sortierung

Alle Songlisten verwenden dieselbe Sortiersteuerung:

- `Manuell`
- `A–Z Anfang`
- `A–Z Ende`
- `Anzahl des Hörens`
- `Dauer`
- `Chronik`

Für alle Modi außer `Manuell` kann die Richtung umgekehrt werden. Die Sortieransicht verändert niemals `libraryOrder` oder `playlist.songIds`; die manuelle Reihenfolge bleibt separat erhalten.

## Manueller Loop-Editor

Die automatische Loop-Heuristik wurde entfernt, weil sie auf realen Dateien nicht zuverlässig genug war.

Der neue Loop-Editor arbeitet ausschließlich mit dem vorhandenen HTML-Audio-Element:

1. „Loop erstellen“ oder „Loop bearbeiten“ öffnet eine eigene Vollbildansicht.
2. Ein roter Auswahlkasten liegt auf dem kompletten Zeitstrahl.
3. Der Kasten kann als Ganzes horizontal verschoben werden.
4. Linke und rechte Kante können getrennt gezogen werden, um Start und Ende zu verändern.
5. „Loop testen“ setzt die Wiedergabe an den Startpunkt; während der Editor offen ist springt der Player beim Endpunkt zurück zum aktuellen Entwurf.
6. „Loop speichern“ schreibt `loopStart`, `loopEnd` und `loopEnabled: true` in den Song.
7. Erst gespeicherte Loops bekommen die rote Schleife in Songlisten und erscheinen im Tab „Loops“.

## Player und Media Session

Der Player verwendet ein einzelnes HTML-Audio-Element für Play/Pause, Fortschritt, Vor/Zurück, Autoplay, Shuffle, Wiederholung und Loop-Vorschau.

Beim `loadedmetadata`-Ereignis wird eine bisher unbekannte Lieddauer gespeichert. Beim `error`-Ereignis zeigt die App einen Hinweis, dass die lokale Audiodatei nicht geladen werden konnte und neu importiert werden muss.

Wenn `navigator.mediaSession` verfügbar ist, werden Metadaten und Systemaktionen registriert. Eine PWA kann keine native `AVAudioSession` oder iOS-Background-Mode-Berechtigung konfigurieren; tatsächliche Hintergrundwiedergabe bleibt von Safari/WebKit und iPadOS abhängig.

## Manuelles Sortieren und Playlist-Verwaltung

Songs in Bibliothek und Playlist sowie Playlists in der linken Leiste behalten das zweistufige manuelle Verschieben: Element auswählen, Zielzwischenraum markieren, anschließend mit Haken bestätigen oder X abbrechen.

Playlists können erstellt, umbenannt, bebildert und gelöscht werden. Beim Löschen bleiben Songdateien erhalten.

## PWA und Deployment

`vite-plugin-pwa` erzeugt Manifest und Service Worker. Der Vite-Basispfad bleibt relativ (`./`). `.github/workflows/deploy.yml` baut Änderungen auf `main` und veröffentlicht `dist` über GitHub Pages.

## Grenzen

Die lokale Browser-Speicherkapazität und Speicherbereinigung durch iPadOS bleiben ein wesentliches Produktrisiko. Eine reine PWA kann keine bereits aus IndexedDB verlorene Audiodatei wiederherstellen. Für eine produktive Version müssen Backup, Wiederherstellung und gegebenenfalls eine native App-Hülle geprüft werden.
