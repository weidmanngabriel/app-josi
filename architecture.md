# Architektur

## Überblick

Die Anwendung ist eine rein clientseitige React-App mit TypeScript und Vite. Der Einstieg liegt in `src/main.tsx`, die Musikoberfläche in `src/App.tsx` und das globale Styling in `src/styles.css`. Zusätzliche Styles für Playlist-Galerie, Navigationspfeile und laufenden Songtitel liegen in `src/enhancements.css`.

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

Zusätzlich gibt es eine bildschirmfüllende Playlist-Übersicht. Sie ersetzt temporär die zweigeteilte Hauptansicht, bleibt aber unterhalb des festen Headers und oberhalb des festen Players. Auf iPad-Größe verwendet sie ein Vier-Spalten-Raster; auf kleinen Displays reduziert sich die Zahl der Spalten responsiv.

## Navigation

Die App hält einen kleinen Sitzungsverlauf aus Ansichten im React-Zustand. Ein Navigationseintrag enthält:

- geöffnete Bibliothek bzw. Playlist,
- ob die Songdetailansicht offen ist,
- ob die Playlist-Übersicht offen ist.

Die Pfeile oben links bewegen sich durch diesen Verlauf ähnlich der Zurück-/Vor-Navigation eines Browsers. Beim Öffnen einer Playlist, der Playlist-Übersicht oder der Songdetailansicht wird ein neuer Eintrag erzeugt; nach einem Zurück-Schritt kann mit „Vor“ wieder zur späteren Ansicht gewechselt werden.

Der Bearbeitungs-Verlauf für Undo/Redo bleibt intern bestehen, wird aber nicht mehr als dauerhafte Kopfzeilensteuerung angezeigt. Bei einer vorgemerkten Verschiebung erscheinen weiterhin Haken und X rechts neben den Navigationspfeilen.

## Player

Der Player arbeitet mit der aktuell sichtbaren Warteschlange. In der Bibliothek ist das die gespeicherte Bibliotheksreihenfolge, in einer Playlist deren `songIds`-Reihenfolge.

Play/Pause, Vor, Zurück und der Fortschrittsregler verwenden ein einzelnes HTML-Audio-Element. Das `ended`-Ereignis startet automatisch den nächsten Song. Shuffle und Wiederholung bleiben verfügbar.

Im kompakten Player werden Playlists für den aktuellen Song per Plus/Minus verwaltet. Playlists, die den Song bereits enthalten, stehen zuerst.

Der Songtitel im kompakten „Jetzt“-Bereich verwendet eine CSS-Marquee-Animation. Der Text bleibt zunächst stehen, läuft bei langen Titeln langsam nach links, hält am Ende kurz an und beginnt anschließend erneut am Anfang.

Die Anzeige „Jetzt“ öffnet die Songdetailansicht. Sie verwendet denselben Audio-Player und zeigt Songname, Playlist-Zugehörigkeit, frei verschiebbare Wiedergabeposition sowie vorheriger Song, -10 Sekunden, Play/Pause, +10 Sekunden und nächster Song.

Unter jedem Songtitel in Bibliothek und Playlist wird ebenfalls die aktuelle Playlist-Zugehörigkeit angezeigt oder „In keiner Playlist“.

## Media Session und Hintergrundwiedergabe

Wenn `navigator.mediaSession` verfügbar ist, setzt Josi für den aktuellen Song `MediaMetadata` und meldet den Wiedergabestatus. Außerdem registriert die App Handler für:

- Play,
- Pause,
- vorheriger Song,
- nächster Song,
- vor/zurück spulen,
- direkte Positionswahl.

Damit kann der Browser die Wiedergabe an standardisierte System-Medienoberflächen wie Control Center, Sperrbildschirm oder verbundene Mediensteuerungen weiterreichen.

Die Audioquelle bleibt ein normales HTML-Audio-Element. Das ist für eine Web-App die sinnvollste Grundlage für Hintergrundwiedergabe. Eine PWA kann jedoch keine native `AVAudioSession` konfigurieren und keine iOS-Background-Mode-Berechtigung setzen. Ob Audio beim App-Wechsel, Sperren des Geräts oder nach längerer Hintergrundzeit weiterläuft, bleibt deshalb von Safari/WebKit und iPadOS abhängig. Gleiches gilt für Unterbrechungen durch andere Audioquellen.

## Bearbeiten und Sortieren

Songs in Bibliothek und geöffneter Playlist verwenden denselben Sortierablauf. Der Bearbeitungsmodus wird über „Reihenfolge ändern“ gestartet.

Die Playlist-Liste links wird über einen etwa einsekündigen Langdruck auf die Überschrift „Playlists“ freigeschaltet. Danach erscheinen zwei Optionen:

- „Bearbeiten“ für die Reihenfolge,
- „Übersicht“ für die große Playlist-Galerie.

Ein Tipp außerhalb schließt das Menü, ohne die darunterliegende Aktion auszulösen.

Für Songs und Playlists gilt weiterhin das zweistufige Verschieben:

1. Element auswählen.
2. Element bleibt zunächst an der alten Stelle.
3. Frei zur gewünschten Zielstelle scrollen.
4. Zwischenraum antippen und rote Zielmarkierung setzen.
5. Haken bestätigt, X verwirft.

## Playlist-Verwaltung

Playlists können umbenannt, mit einem lokalen Bild versehen und nach Bestätigung gelöscht werden. Beim Löschen bleiben die Songs in der Bibliothek erhalten.

Die Playlist-Galerie zeigt pro Karte Bild/Icon, vollständigen Namen und Liedanzahl. Ein Tipp öffnet die Playlist über denselben Navigationsmechanismus wie die linke Liste.

## PWA

`vite-plugin-pwa` erzeugt beim Produktionsbuild Manifest und Service Worker. Die App verwendet feste App-Icons aus `public/` und ein `apple-touch-icon` für iOS.

Der Vite-Basispfad ist relativ (`./`), damit derselbe Build lokal und als GitHub-Project-Page funktioniert.

## Google Login

Die technische Google-Login-Basis des ursprünglichen Templates bleibt im Repository, wird im Musik-PoC aber nicht verwendet.

## Deployment

`.github/workflows/deploy.yml` baut bei Änderungen auf `main` und veröffentlicht ausschließlich `dist` über GitHub Pages.

## Grenzen

IndexedDB-Speicher wird vom Browser bzw. Betriebssystem verwaltet. Vor einer produktiven Nutzung mit großen Musiksammlungen müssen Speichermenge, Bereinigung, Backup und Wiederherstellung auf iPadOS geprüft werden.

System-Mediensteuerung über die Media Session API ist möglich, garantiert aber nicht dieselbe Hintergrund-Audio-Zuverlässigkeit wie eine native iOS-App mit konfigurierter Audio-Session und Background Mode.

Crossfade ist weiterhin noch nicht implementiert.
