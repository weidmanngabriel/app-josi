# Architektur

## Überblick

Die Anwendung ist eine rein clientseitige React-App mit TypeScript und Vite. Der Einstieg liegt in `src/main.tsx`, die Musikoberfläche in `src/App.tsx` und das globale Styling in `src/styles.css`. Zusätzliche Styles für Playlist-Galerie, Navigationspfeile, Import-Verlauf und laufenden Songtitel liegen in `src/enhancements.css`.

Josi ist im aktuellen Proof of Concept eine lokale Musik-App ohne Backend. Audiodateien und Playlists bleiben auf dem jeweiligen Gerät im Browser-Speicher.

## Lokale Musikdaten

`src/musicDb.ts` kapselt die lokale Speicherung über IndexedDB.

Es gibt zwei Datenarten:

- **Songs**: ID, Anzeigename, Audiodatei als Blob, MIME-Typ, Importzeitpunkt, optionaler relativer Quellpfad, optionale manuelle Position in der Bibliothek, optionale Import-Batch-ID und `isNew`-Status.
- **Playlists**: ID, Name, geordnete Song-IDs, optionales Playlist-Bild als Blob, Zeitpunkte für Erstellung und letzte Verwendung sowie optionale manuelle Position in der linken Playlist-Liste.

Audiodateien werden beim Import vollständig in IndexedDB gespeichert. Playlists referenzieren nur Song-IDs; die Audiodatei wird nicht pro Playlist dupliziert.

Die Reihenfolge der Bibliothek wird über `libraryOrder` an den Songs gespeichert. Die Reihenfolge der Playlist-Liste wird über `sortOrder` an den Playlists gespeichert.

### Import-Batches und Neu-Status

Jeder neue Datei- oder Ordnerimport erhält eine gemeinsame `importBatchId`. Die neu importierten Songs bekommen `isNew: true`. Unmittelbar vor einem neuen Import setzt die App bestehende `isNew`-Werte auf `false`. Dadurch ist immer nur der aktuellste Import automatisch blau markiert.

Ein Langdruck-Menü kann `isNew` bei einem einzelnen Song oder bei allen Songs auf `false` setzen. Die Änderung wird über denselben IndexedDB-Schreibweg wie die Songreihenfolge gespeichert.

Der Verlauf ist keine zweite Datenkopie. Er sortiert dieselben Song-Datensätze nach `addedAt` absteigend und zeigt Importzeit sowie – falls vom Browser vorhanden – `sourcePath`.

## Datei- und Ordnerimport

Der normale Import verwendet `<input type="file" multiple>`. Für ganze Ordner gibt es ein zweites verstecktes File-Input, dem beim Start das Attribut `webkitdirectory` gesetzt wird. Safari auf iPadOS unterstützt diese Ordnerauswahl erst in neueren Versionen; ältere Versionen können weiterhin mehrere Dateien über den normalen Dialog importieren.

Nicht-Audiodateien aus einem ausgewählten Ordner werden vor dem Speichern herausgefiltert.

## Layout und Scrollen

Auf iPad-Größen sind die linke Navigation und der rechte Songbereich getrennte Scrollbereiche. Header und Player bleiben stehen. Eine lange Songliste scrollt daher nicht die Playlists mit und umgekehrt.

Zusätzlich gibt es eine bildschirmfüllende Playlist-Übersicht sowie einen bildschirmfüllenden Import-Verlauf. Beide liegen unterhalb des festen Headers und oberhalb des festen Players.

## Navigation

Die App hält einen Sitzungsverlauf aus Ansichten im React-Zustand. Ein Navigationseintrag enthält:

- geöffnete Bibliothek bzw. Playlist,
- Songdetailansicht offen/geschlossen,
- Playlist-Übersicht offen/geschlossen,
- Import-Verlauf offen/geschlossen.

Oben links stehen in dieser Reihenfolge Zurück, Vor, Undo und Redo. Zurück/Vor bewegen sich im Ansichtsverlauf. Undo/Redo bewegen sich im Bearbeitungsverlauf. Bei einer vorgemerkten Verschiebung folgen rechts davon Haken und X.

Der Bearbeitungsverlauf umfasst wesentliche Änderungen an Songs, Playlists, Zuordnungen und Reihenfolgen. Importierte Audiodateien selbst werden weiterhin nicht per Undo aus IndexedDB gelöscht.

## Player

Der Player arbeitet mit der aktuell sichtbaren Warteschlange. In der Bibliothek ist das die gespeicherte Bibliotheksreihenfolge, in einer Playlist deren `songIds`-Reihenfolge.

Play/Pause, Vor, Zurück und der Fortschrittsregler verwenden ein einzelnes HTML-Audio-Element. Das `ended`-Ereignis startet automatisch den nächsten Song. Shuffle und Wiederholung bleiben verfügbar.

Im kompakten Player werden Playlists für den aktuellen Song per Plus/Minus verwaltet. Playlists, die den Song bereits enthalten, stehen zuerst.

Der Songtitel im kompakten „Jetzt“-Bereich verwendet eine CSS-Marquee-Animation. Der Text bleibt zunächst stehen, läuft bei langen Titeln langsam nach links, hält am Ende kurz an und beginnt anschließend erneut am Anfang.

Unter jedem Songtitel in Bibliothek und Playlist wird die aktuelle Playlist-Zugehörigkeit angezeigt oder „In keiner Playlist“.

## Media Session und Hintergrundwiedergabe

Wenn `navigator.mediaSession` verfügbar ist, setzt Josi für den aktuellen Song `MediaMetadata` und meldet den Wiedergabestatus. Außerdem registriert die App Handler für Play, Pause, vorherigen/nächsten Song, Vor-/Zurückspulen und direkte Positionswahl.

Die Audioquelle bleibt ein normales HTML-Audio-Element. Eine PWA kann jedoch keine native `AVAudioSession` konfigurieren und keine iOS-Background-Mode-Berechtigung setzen. Ob Audio beim App-Wechsel, Sperren des Geräts oder nach längerer Hintergrundzeit weiterläuft, bleibt deshalb von Safari/WebKit und iPadOS abhängig.

## Bearbeiten und Sortieren

Songs in Bibliothek und geöffneter Playlist verwenden denselben Sortierablauf. Die Playlist-Liste links wird über einen etwa einsekündigen Langdruck auf „Playlists“ freigeschaltet; dort stehen „Bearbeiten“ und „Übersicht“ zur Auswahl.

Für Songs und Playlists gilt das zweistufige Verschieben: Element auswählen, frei scrollen, Zwischenraum als Ziel markieren und anschließend mit Haken bestätigen oder mit X verwerfen.

## Playlist-Verwaltung

Playlists können umbenannt, mit einem lokalen Bild versehen und nach Bestätigung gelöscht werden. Beim Löschen bleiben die Songs in der Bibliothek erhalten.

Die Playlist-Galerie zeigt pro Karte Bild/Icon, vollständigen Namen und Liedanzahl.

## Loop-Erkennung

Automatische musikalische Loop-Erkennung ist nicht implementiert. Sie würde eine zusätzliche Audioanalyse benötigen, beispielsweise Vergleich ähnlicher Audioabschnitte, Rhythmus-/Beat-Schätzung und Bewertung eines möglichst unauffälligen Übergangs. Das ist deutlich komplexer als die bestehende Listen-Wiederholung und sollte getrennt als experimentelle Funktion entwickelt werden.

## PWA

`vite-plugin-pwa` erzeugt beim Produktionsbuild Manifest und Service Worker. Die App verwendet feste App-Icons aus `public/` und ein `apple-touch-icon` für iOS.

Der Vite-Basispfad ist relativ (`./`), damit derselbe Build lokal und als GitHub-Project-Page funktioniert.

## Deployment

`.github/workflows/deploy.yml` baut bei Änderungen auf `main` und veröffentlicht ausschließlich `dist` über GitHub Pages.

## Grenzen

IndexedDB-Speicher wird vom Browser bzw. Betriebssystem verwaltet. Vor einer produktiven Nutzung mit großen Musiksammlungen müssen Speichermenge, Bereinigung, Backup und Wiederherstellung auf iPadOS geprüft werden.

System-Mediensteuerung über die Media Session API ist möglich, garantiert aber nicht dieselbe Hintergrund-Audio-Zuverlässigkeit wie eine native iOS-App.

Crossfade und automatische Loop-Punkt-Erkennung sind weiterhin noch nicht implementiert.
