# Architektur

## Überblick

Die Anwendung ist eine rein clientseitige React-App mit TypeScript und Vite. Der Einstieg liegt in `src/main.tsx`, die Musikoberfläche in `src/App.tsx` und das globale Styling in `src/styles.css`. Zusätzliche Styles für Playlist-Galerie, Import-Markierung, Loop-Funktionen, Auswahlmodus und Playlist-Dialog liegen in `src/enhancements.css`.

Josi ist im aktuellen Proof of Concept eine lokale Musik-App ohne Backend. Audiodateien und Playlists bleiben auf dem jeweiligen Gerät im Browser-Speicher.

## Lokale Musikdaten

`src/musicDb.ts` kapselt die lokale Speicherung über IndexedDB.

### Songs

Ein Song enthält ID, Anzeigename, Audiodatei als Blob, MIME-Typ, Importzeitpunkt, optionale Bibliotheksposition, optionale Import-Batch-ID, `isNew` sowie optionale Loop-Daten:

- `loopStart`
- `loopEnd`
- `loopEnabled`
- `loopConfidence`

`saveSong()` speichert einzelne Song-Änderungen, beispielsweise einen neuen Loop-Vorschlag. `saveSongOrder()` schreibt die vollständige Songliste und wird weiterhin für Reihenfolge sowie Sammeländerungen wie „als gesehen markieren“ verwendet.

### Playlists

Playlists enthalten ID, Name, geordnete Song-IDs, optionales Bild, Erstellungs-/Nutzungszeit und optionale manuelle Sortierposition.

Audiodateien werden nicht pro Playlist dupliziert; Playlists referenzieren ausschließlich Song-IDs.

## Dateiimport und Verlauf

Der normale Import verwendet `<input type="file" multiple>`. Der zuvor getestete Ordnerimport wurde entfernt, da er auf dem Zielgerät nicht zuverlässig funktioniert hat.

Jeder neue Import erhält eine gemeinsame `importBatchId`. Neue Songs bekommen `isNew: true`; unmittelbar vor einem neuen Import werden bestehende Neu-Markierungen auf `false` gesetzt.

Der Verlauf ist keine separate Datenkopie, sondern dieselbe Songliste nach `addedAt` absteigend sortiert.

## Ansichten und Navigation

Die App kennt die Hauptansichten:

- Bibliothek bzw. geöffnete Playlist,
- Verlauf,
- Loops,
- Playlist-Übersicht,
- Songdetail als Overlay.

Ein kleiner React-Sitzungsverlauf speichert Ansicht, aktive Playlist und Detailstatus. Zurück/Vor bewegen sich darin. Undo/Redo bleibt davon getrennt und arbeitet mit Snapshots von Songs und Playlists.

Oben links stehen in der Reihenfolge Zurück, Vor, Undo und Redo. Bei einer vorgemerkten Sortieränderung folgen Haken und X.

## Songlisten und Mehrfachauswahl

Bibliothek, geöffnete Playlist, Verlauf und Loops verwenden denselben Auswahlmechanismus:

1. „Auswählen“ aktiviert den Modus.
2. Song-IDs werden in einem `Set` im React-Zustand gehalten.
3. „Alle“ übernimmt alle IDs der aktuell sichtbaren Liste.
4. „Zu Playlist“ öffnet den gemeinsamen Playlist-Dialog.
5. Beim Bestätigen werden die ausgewählten IDs einmalig an `songIds` der Zielplaylist angehängt.

Der Modus erzeugt keine zweite Audiodatei und verändert nicht die Reihenfolge der Bibliothek.

## Playlist-Dialog

Der kompakte Player zeigt unten rechts nur noch „Alle Playlists“. Derselbe Dialog wird auch für die Mehrfachauswahl genutzt.

Playlists werden mit `localeCompare(..., { numeric: true })` sortiert und anschließend nach erstem Zeichen gruppiert:

- `#` für Symbole,
- `0–9` für Zahlen,
- danach Buchstaben.

Im Player-Modus zeigt jeder Eintrag Plus/Minus für den aktuellen Song. Im Mehrfachauswahl-Modus ordnet ein Tipp die gesamte Auswahl der Zielplaylist zu.

## Loop-Analyse

Die Loop-Funktion läuft vollständig lokal im Browser. `AudioContext.decodeAudioData()` dekodiert die importierte Audiodatei. Die Analyse:

1. betrachtet mögliche Startpunkte im vorderen/mittleren Teil und Endpunkte im späteren Teil des Songs,
2. bildet aus kurzen Audiofenstern normalisierte Signaturen,
3. vergleicht diese Fenster über eine einfache quadratische Fehlerfunktion,
4. bevorzugt Kandidaten mit sinnvoller Mindestlänge,
5. speichert den besten Kandidaten als `loopStart`, `loopEnd` und einen heuristischen `loopConfidence`-Wert.

Diese Analyse ist bewusst eine experimentelle Heuristik. Sie erkennt klangliche Ähnlichkeit, nicht zuverlässig musikalische Takte oder Kompositionsstruktur.

Wenn `loopEnabled` aktiv ist, überwacht das vorhandene HTML-Audio-Element `currentTime`. Beim Erreichen von `loopEnd` setzt die App die Position auf `loopStart` zurück. Dadurch bleibt der bestehende Player erhalten; es wird kein zweiter Audio-Player benötigt.

Songs mit gespeicherten Loop-Punkten werden in allen Songlisten mit einer roten Schleife markiert. Die Ansicht „Loops“ filtert dieselben Songdaten auf Einträge mit `loopStart` und `loopEnd`.

## Player und Media Session

Der Player verwendet weiterhin ein einzelnes HTML-Audio-Element für Play/Pause, Fortschritt, Vor/Zurück, Autoplay, Shuffle und Wiederholung.

Wenn `navigator.mediaSession` verfügbar ist, setzt Josi `MediaMetadata` und Handler für Play, Pause, vorherigen/nächsten Song, Spulen und Positionswechsel.

Eine PWA kann keine native `AVAudioSession` oder iOS-Background-Mode-Berechtigung konfigurieren; tatsächliche Hintergrundwiedergabe bleibt daher von Safari/WebKit und iPadOS abhängig.

## Sortieren und Playlist-Verwaltung

Songs in Bibliothek und geöffneter Playlist sowie Playlists in der linken Leiste verwenden weiterhin das zweistufige Verschieben: Element auswählen, Zielzwischenraum markieren, anschließend mit Haken bestätigen oder mit X abbrechen.

Der Langdruck auf „Playlists“ bietet weiterhin „Bearbeiten“ und „Übersicht“.

Playlists können erstellt, umbenannt, bebildert und gelöscht werden. Beim Löschen bleiben Songdateien erhalten.

## PWA und Deployment

`vite-plugin-pwa` erzeugt Manifest und Service Worker. Der Vite-Basispfad bleibt relativ (`./`). `.github/workflows/deploy.yml` baut Änderungen auf `main` und veröffentlicht `dist` über GitHub Pages.

## Grenzen

IndexedDB-Speicher wird vom Browser bzw. Betriebssystem verwaltet. Vor einer produktiven Nutzung müssen Speichergrenzen, Bereinigung, Backup und Wiederherstellung auf iPadOS geprüft werden.

Die aktuelle Loop-Heuristik sollte mit echten Songs getestet werden. Ein späterer Ausbau kann Beat-Erkennung, manuelles Verschieben der vorgeschlagenen Grenzen und weiche Übergänge/Crossfade ergänzen.
