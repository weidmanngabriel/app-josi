# Architektur

## Überblick

Die Anwendung ist eine rein clientseitige React-App mit TypeScript und Vite. Der Einstieg liegt in `src/main.tsx`, die Musikoberfläche in `src/App.tsx` und das globale Styling in `src/styles.css`.

Josi ist im aktuellen Proof of Concept eine lokale Musik-App ohne Backend. Audiodateien und Playlists bleiben auf dem jeweiligen Gerät im Browser-Speicher.

## Lokale Musikdaten

`src/musicDb.ts` kapselt die lokale Speicherung über IndexedDB.

Es gibt zwei Datenarten:

- **Songs**: ID, Anzeigename, Audiodatei als Blob, MIME-Typ, Importzeitpunkt, optionaler relativer Quellpfad und optionale manuelle Position in der Bibliothek.
- **Playlists**: ID, Name, geordnete Song-IDs, optionales Playlist-Bild als Blob, Zeitpunkte für Erstellung und letzte Verwendung sowie optionale manuelle Position in der linken Playlist-Liste.

Audiodateien werden beim Import vollständig in IndexedDB gespeichert. Playlists referenzieren nur Song-IDs; die Audiodatei wird nicht pro Playlist dupliziert.

Die Reihenfolge der Bibliothek wird über `libraryOrder` an den Songs gespeichert. Die Reihenfolge der Playlist-Liste wird über `sortOrder` an den Playlists gespeichert.

## Layout und Scrollen

Auf iPad-Größen sind die linke Navigation und der rechte Songbereich getrennte Scrollbereiche. Header und Player bleiben stehen. Eine lange Songliste scrollt daher nicht die Playlists mit und umgekehrt.

## Player

Der Player arbeitet mit der aktuell sichtbaren Warteschlange. In der Bibliothek ist das die gespeicherte Bibliotheksreihenfolge, in einer Playlist deren `songIds`-Reihenfolge.

Play/Pause, Vor, Zurück und der Fortschrittsregler verwenden ein einzelnes HTML-Audio-Element. Das `ended`-Ereignis startet automatisch den nächsten Song. Shuffle und Wiederholung bleiben verfügbar.

Im kompakten Player werden Playlists für den aktuellen Song per Plus/Minus verwaltet. Playlists, die den Song bereits enthalten, stehen zuerst.

Die Anzeige „Jetzt“ öffnet die Songdetailansicht. Sie verwendet denselben Audio-Player und zeigt Songname, Playlist-Zugehörigkeit, frei verschiebbare Wiedergabeposition sowie vorheriger Song, -10 Sekunden, Play/Pause, +10 Sekunden und nächster Song.

Unter jedem Songtitel in Bibliothek und Playlist wird ebenfalls die aktuelle Playlist-Zugehörigkeit angezeigt oder „In keiner Playlist“.

## Bearbeiten und Sortieren

Songs in Bibliothek und geöffneter Playlist verwenden denselben Sortierablauf. Der Bearbeitungsmodus wird über „Reihenfolge ändern“ gestartet.

Die Playlist-Liste links wird über einen etwa einsekündigen Langdruck auf die Überschrift „Playlists“ freigeschaltet. Danach erscheint der kleine Eintrag „Bearbeiten“. Ein Tipp außerhalb schließt ihn, ohne die darunterliegende Aktion auszulösen.

Die frühere Drag-and-Drop-Logik wurde entfernt. Stattdessen gilt für Songs und Playlists:

1. Im Bearbeitungsmodus wird ein Element über das Verschiebe-Symbol ausgewählt.
2. Das Element bleibt zunächst sichtbar an seiner ursprünglichen Position.
3. Der Nutzer kann unabhängig bis zur gewünschten Stelle scrollen.
4. Ein Tipp in den Zwischenraum zwischen zwei Einträgen setzt dort eine rote Zielmarkierung.
5. Oben links erscheinen rechts neben Undo/Redo ein grüner Haken und ein rotes X.
6. Erst der Haken schreibt die neue Reihenfolge nach IndexedDB; X verwirft die vorgemerkte Änderung.

Dadurch entfällt langsames automatisches Scrollen beim Ziehen über lange Listen.

## Undo und Redo

Oben links befinden sich dauerhaft Undo und Redo. Der Verlauf wird für die laufende Sitzung im Arbeitsspeicher gehalten. Er umfasst die wesentlichen Bibliotheks- und Playlist-Änderungen wie Reihenfolge, Playlist-Zuordnung, Erstellen, Umbenennen, Cover-Änderung und Löschen von Playlists. Beim Wiederherstellen werden die betroffenen Zustände wieder nach IndexedDB geschrieben.

Importierte Audiodateien selbst werden aktuell nicht per Undo aus IndexedDB gelöscht.

## Playlist-Verwaltung

Playlists können umbenannt, mit einem lokalen Bild versehen und nach Bestätigung gelöscht werden. Beim Löschen bleiben die Songs in der Bibliothek erhalten.

## PWA

`vite-plugin-pwa` erzeugt beim Produktionsbuild Manifest und Service Worker. Die App verwendet feste App-Icons aus `public/` und ein `apple-touch-icon` für iOS.

Der Vite-Basispfad ist relativ (`./`), damit derselbe Build lokal und als GitHub-Project-Page funktioniert.

## Google Login

Die technische Google-Login-Basis des ursprünglichen Templates bleibt im Repository, wird im Musik-PoC aber nicht verwendet.

## Deployment

`.github/workflows/deploy.yml` baut bei Änderungen auf `main` und veröffentlicht ausschließlich `dist` über GitHub Pages.

## Grenzen

IndexedDB-Speicher wird vom Browser bzw. Betriebssystem verwaltet. Vor einer produktiven Nutzung mit großen Musiksammlungen müssen Speichermenge, Bereinigung, Backup und Wiederherstellung auf iPadOS geprüft werden.

Crossfade ist weiterhin noch nicht implementiert.
