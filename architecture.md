# Architektur

## Überblick

Die Anwendung ist eine rein clientseitige React-App mit TypeScript und Vite. `src/App.tsx` enthält die Musikoberfläche und Interaktionslogik, `src/musicDb.ts` kapselt IndexedDB, `src/styles.css` enthält das Grundlayout, `src/enhancements.css` Zusatzfunktionen und `src/loopEditor.css` den präzisen Loop-Editor.

Josi bleibt eine lokale Musik-PWA ohne Backend. Audiodateien und Playlists liegen ausschließlich im Browser-Speicher des jeweiligen Geräts.

## Lokale Musikdaten

### Songs

Ein Song enthält unter anderem ID, Name, Audiodatei als Blob, MIME-Typ, Importzeitpunkt, manuelle Bibliotheksposition, Neu-Status, Dauer, vollständig gehörte Wiedergaben sowie Loop-Daten:

- `loopStart`
- `loopEnd`
- `loopEnabled`
- `loopMarkers` für orange Hilfsmarkierungen im Loop-Editor

`deleteSong()` löscht einen Song gezielt aus IndexedDB. Beim Löschen entfernt `App.tsx` die Song-ID zusätzlich aus allen Playlists. Beim Kopieren eines Songs entsteht eine neue Song-ID mit eigenem Bibliothekseintrag; der Audiodaten-Blob wird als Teil des neuen Datensatzes gespeichert.

### Playlists

Playlists enthalten ID, Name, geordnete Song-IDs, optionales Bild, Erstellungs-/Nutzungszeit und manuelle Sortierposition. Eine kopierte Playlist erhält eine neue ID, verweist aber auf dieselben Songs; Audiodateien werden dadurch nicht dupliziert.

## Import und Speicherstabilität

Der Import verwendet ausschließlich `<input type="file" multiple>`. Beim Import werden nur neue Dateien geschrieben. Vorherige Neu-Markierungen werden nur an den betroffenen Songs geändert; die gesamte Bibliothek wird nicht erneut gespeichert.

Die Lieddauer wird erst beim tatsächlichen Laden im HTML-Audio-Element gespeichert. `--:--` bedeutet unbekannte Dauer, `FEHLT` bedeutet, dass der lokale Blob fehlt oder Größe 0 hat.

## Drei-Punkte-Menüs

Langdruck wird nicht verwendet. Zusatzfunktionen liegen in sichtbaren `•••`-Menüs.

### Song-Menü

In dieser Reihenfolge:

1. Umbenennen
2. Kopieren
3. Teilen
4. Loop erstellen bzw. Loop bearbeiten
5. Nur bei blau markierten Songs: „Als gelesen markieren“ in Blau
6. Nur bei blau markierten Songs: „Alle als gelesen markieren“ in Blau
7. Löschen in Rot

Beim Teilen wird aus dem gespeicherten Blob eine `File` erzeugt und über die Web Share API an die Systemfreigabe übergeben, sofern Browser/iPadOS Dateifreigabe unterstützt. Bei fehlender Unterstützung zeigt Josi eine Meldung.

### Playlist-Menü

Einzelne Playlists bieten Umbenennen, Kopieren, Teilen und Löschen. „Teilen“ übergibt eine Textübersicht mit Playlistname und Liedliste an die Systemfreigabe. Der separate Löschknopf in der geöffneten Playlist wurde entfernt; die Bestätigungsabfrage bleibt erhalten.

Das `•••` neben der Überschrift „Playlists“ bleibt für „Bearbeiten“ und „Übersicht“ zuständig.

## Löschen und Undo/Redo

Song- und Playlist-Löschen verwenden Bestätigungsdialoge. Der Snapshot-Verlauf berücksichtigt fehlende Song-IDs und kann bei Undo/Redo deshalb auch kopierte oder gelöschte Songs wiederherstellen bzw. entfernen. Frisch importierte Dateien werden weiterhin nicht automatisch durch Undo gelöscht.

## Mehrfachauswahl und Playlist-Zuordnung

Bibliothek, Playlists, Verlauf und Loops verwenden denselben Auswahlmodus. Die Zuordnung erfolgt ausschließlich über „Alle Playlists“ unten rechts. Die Playlist-Liste ist nach Symbolen, Zahlen und danach Buchstaben gruppiert.

## Sortierung

Alle Songlisten unterstützen `Manuell`, `A–Z Anfang`, `A–Z Ende`, `Anzahl des Hörens`, `Dauer` und `Chronik`. Die Sortieransicht verändert die manuelle Reihenfolge nicht. Die gewählte Ansicht und Richtung werden in `localStorage` gespeichert.

## Präziser Loop-Editor

Die automatische Loop-Erkennung bleibt entfernt. Der Editor arbeitet mit dem bestehenden HTML-Audio-Element und einer zoombaren Zeitachse.

Funktionen:

- Zoom von 1× bis 16×; bei Zoom wird die Zeitachse horizontal scrollbar.
- Klassische Audio-Wellenform als **Amplitude über Zeit**. Dafür wird die Datei beim Öffnen des Editors einmal mit `AudioContext.decodeAudioData()` dekodiert und auf eine begrenzte Zahl von Spitzenwerten reduziert.
- Die Wellenform ist nur eine Anzeigehilfe. Wenn das Dekodieren für ein Format fehlschlägt, bleibt die normale Wiedergabe vollständig verfügbar; der Editor zeigt dann lediglich keine Wellenform.
- Roter Loop-Bereich mit verschiebbarem Gesamtfenster und getrennten Start-/Endgriffen.
- Der zuletzt berührte rote Rand wird hervorgehoben.
- Die Schrittweite für die Feinkorrektur ist frei in Sekunden eingebbar, z. B. `0,01` für 10 ms, `0,1` für 100 ms oder `1` für eine Sekunde.
- Der rote Bereich kann gesperrt werden. Dann wird er transparenter und reagiert nicht auf Pointer-Eingaben, damit der Abspielcursor ohne Konflikt bewegt werden kann.
- Blauer Abspielcursor, der unabhängig vom roten Bereich durch Tippen/Ziehen oder Wiedergabe bewegt wird.
- Transport im Editor: −5 Sekunden, Play/Pause, +5 Sekunden.
- Orange Markierungen können am blauen Cursor gesetzt werden. Markierungen sind anklickbar und springen den Cursor an ihre Position. Die Markierungsfunktion kann ein-/ausgeschaltet werden; gespeicherte Markierungen bleiben im Song erhalten.
- Ein frei eingebbarer Vorlaufwert in Sekunden (Komma oder Punkt möglich) steuert „vor Start abspielen“ und „vor Ende abspielen“.
- Beim Erreichen des aktuellen Loop-Endes springt die Wiedergabe im Editor zum Loop-Start zurück.
- „Loop speichern“ persistiert Start, Ende, Aktivstatus und Marker.

## Player-Stabilität bei Song-Metadaten

Der Player verwendet für die aktuelle Audiodatei eine Objekt-URL. Diese URL darf nicht bei jeder Änderung des Song-Objekts neu erzeugt werden, weil Änderungen wie Loop speichern, Loop an/aus, Dauer ergänzen oder Umbenennen sonst das Audio-Element neu laden und die Wiedergabe unterbrechen können.

Deshalb hängt die Objekt-URL nur noch von der **Song-ID und dem tatsächlichen Blob** ab. Reine Metadatenänderungen lassen die Audioquelle unverändert. Das behebt insbesondere das Problem, dass ein Song nach dem Speichern eines Loops nicht mehr zuverlässig startete.

## Player und Media Session

Ein einzelnes HTML-Audio-Element übernimmt Wiedergabe, Fortschritt, Systemsteuerung und Loop-Vorschau. Vollständig gehörte Songs werden nur beim natürlichen `ended`-Ereignis gezählt. Media Session wird genutzt, soweit Safari/iPadOS sie bereitstellt.

## PWA und Deployment

`vite-plugin-pwa` erzeugt Manifest und Service Worker. Der Vite-Basispfad bleibt relativ (`./`). `.github/workflows/deploy.yml` baut `main` und veröffentlicht `dist` auf GitHub Pages.

## Grenzen

IndexedDB und Web Share werden vom Browser/iPadOS kontrolliert. Verlorene lokale Audiodaten können ohne erneuten Import nicht rekonstruiert werden. Dateifreigabe kann je nach Safari-/PWA-Version eingeschränkt sein. Die Wellenform benötigt lokale Dekodierunterstützung für das jeweilige Audioformat. Für eine Produktversion bleiben Backup, Wiederherstellung und gegebenenfalls eine native App-Hülle wichtige Themen.
