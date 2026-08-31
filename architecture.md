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
- `loopTailEnabled` als optionale Song-Ausnahme für den einsekündigen Loop-Auslauf
- `loopMarkers` für orange Hilfsmarkierungen im Loop-Editor

### Audiodatei und Metadaten sind getrennt geschützt

Seit IndexedDB-Version 2 werden Änderungen an Song-Metadaten **nicht mehr in den Datensatz mit dem Audio-Blob zurückgeschrieben**. Der bestehende Store `songs` bleibt die Basis für die eigentliche importierte Audiodatei. Der zusätzliche Store `songMetadata` enthält nur kleine Werte wie Name, Dauer, Sortierposition, Neu-Status, Hörzähler und Loop-Daten.

`getSongs()` lädt die Basis-Songs und legt die Metadaten darüber. Dabei hat die Audiodatei aus `songs` immer Vorrang und kann nicht durch einen Metadaten-Eintrag ersetzt werden.

`saveSong()` und `saveSongOrder()` schreiben bei bereits vorhandenen Songs nur nach `songMetadata`. Der große Audio-Blob wird dadurch beim Loop-Speichern, Umbenennen, Markieren als gelesen, Aktualisieren der Dauer, Zählen einer Wiedergabe oder Ändern der Reihenfolge nicht mehr erneut serialisiert.

Ein vollständiger Song inklusive Blob wird nur geschrieben, wenn noch kein Basis-Song mit dieser ID existiert, zum Beispiel bei Import, Kopieren oder Wiederherstellen eines gelöschten Songs per Undo. `deleteSong()` entfernt Basis-Song und Metadaten gemeinsam.

Diese Trennung ist eine Datenintegritätsmaßnahme für Safari/iPadOS. Sie verhindert insbesondere, dass eine reine Loop-Änderung die lokal gespeicherte Audiodatei erneut schreiben muss.

### Playlists

Playlists enthalten ID, Name, geordnete Song-IDs, optionales Bild, Erstellungs-/Nutzungszeit und manuelle Sortierposition. Eine kopierte Playlist erhält eine neue ID, verweist aber auf dieselben Songs; Audiodateien werden dadurch nicht dupliziert.

## Import und Speicherstabilität

Der Import verwendet ausschließlich `<input type="file" multiple>`. Beim Import werden nur neue Dateien geschrieben. Vorherige Neu-Markierungen werden nur an den betroffenen Songs geändert; die gesamte Bibliothek wird nicht erneut gespeichert.

Die Lieddauer wird erst beim tatsächlichen Laden im HTML-Audio-Element gespeichert. `--:--` bedeutet unbekannte Dauer, `FEHLT` bedeutet, dass der lokale Blob fehlt oder Größe 0 hat.

Bereits vor der Trennung beschädigte oder verlorene Blobs können nicht rekonstruiert werden. Solche Dateien müssen erneut importiert werden. Die neue Speicherstruktur verhindert nur zukünftige unnötige Blob-Schreibvorgänge.

## Drei-Punkte-Menüs

Langdruck wird grundsätzlich nicht für Objektaktionen verwendet. Zusatzfunktionen liegen in sichtbaren `•••`-Menüs. **Einzige bewusste Ausnahme ist der Wiederholen-Knopf im Player:** Langdruck aktiviert die Wiederholung eines einzelnen bzw. mehrerer zuvor ausgewählter Songs.

### Song-Menü

In dieser Reihenfolge:

1. Umbenennen
2. Kopieren
3. Teilen
4. Loop erstellen bzw. Loop bearbeiten
5. Bei vorhandenem Loop: Loop aktivieren bzw. Loop deaktivieren
6. Nur bei blau markierten Songs: „Als gelesen markieren“ in Blau
7. Nur bei blau markierten Songs: „Alle als gelesen markieren“ in Blau
8. Löschen in Rot

Beim Teilen wird aus dem gespeicherten Blob eine `File` erzeugt und über die Web Share API an die Systemfreigabe übergeben, sofern Browser/iPadOS Dateifreigabe unterstützt. Bei fehlender Unterstützung zeigt Josi eine Meldung.

### Playlist-Menü

Einzelne Playlists bieten Umbenennen, Kopieren, Teilen und Löschen. „Teilen“ übergibt eine Textübersicht mit Playlistname und Liedliste an die Systemfreigabe. Der separate Löschknopf in der geöffneten Playlist wurde entfernt; die Bestätigungsabfrage bleibt erhalten.

Das `•••` neben der Überschrift „Playlists“ bleibt für „Bearbeiten“ und „Übersicht“ zuständig.

## Löschen und Undo/Redo

Song- und Playlist-Löschen verwenden Bestätigungsdialoge. Der Snapshot-Verlauf berücksichtigt fehlende Song-IDs und kann bei Undo/Redo deshalb auch kopierte oder gelöschte Songs wiederherstellen bzw. entfernen. Frisch importierte Dateien werden weiterhin nicht automatisch durch Undo gelöscht.

Die sichere Metadaten-Speicherung prüft bei Undo, ob der Basis-Song noch existiert. Nur wenn er fehlt, wird der Blob aus dem Snapshot einmalig wiederhergestellt; vorhandene Blobs werden nicht überschrieben.

## Mehrfachauswahl und Playlist-Zuordnung

Bibliothek, Playlists, Verlauf und Loops verwenden denselben Auswahlmodus. Rechts neben „Alle Playlists“ liegt im Auswahlmodus ein runder `•••`-Knopf. Er zeigt die reservierten Aktionen Gruppieren und Tags sowie Bewegen und Alle löschen. Gruppieren/Tags bleiben im Prototyp deaktiviert. Bewegen arbeitet nur in Bibliothek bzw. geöffneter Playlist und verschiebt die Auswahl als Block innerhalb der manuellen Reihenfolge. Ist eine andere Sortierung aktiv, fragt Josi vorab nach dem Wechsel auf Manuell; bei Nein wird abgebrochen. Alle löschen verlangt eine Sicherheitsabfrage und entfernt die ausgewählten lokalen Dateien aus allen Playlists.

## Sortierung

Alle Songlisten unterstützen `Manuell`, `A–Z Anfang`, `A–Z Ende`, `Anzahl des Hörens`, `Dauer` und `Chronik`. Die Sortieransicht verändert die manuelle Reihenfolge nicht. Die gewählte Ansicht und Richtung werden in `localStorage` gespeichert.

## Präziser Loop-Editor

Die Loop-Ansicht folgt dem vom Nutzer skizzierten Schnittplatz-Layout. Sie ist eine feste Vollbildansicht mit eigener vertikaler Scrollfläche; die normale App-Seite wird dabei nicht verschoben.

Oben liegt eine kompakte, beim Scrollen sichtbare Steuerleiste mit Zurück/Vor sowie **lokalem Editor-Undo/Redo**. Zoom wird über eine Liste von 1× bis 15× gewählt. Die Cursor-Geschwindigkeit wird über 5%, 10%, 25%, 50%, 75%, 100%, 150%, 200%, 500%, 1000% oder 5000% gewählt. `Fokus folgt Cursor` ist dreistufig: Zentrieren, seitenweises Umblättern oder aus. Loop-Kasten, Cursor-Loop und Markierungen werden als Schalter dargestellt. Die erläuternden Begriffe aus der Skizze in Klammern erscheinen nicht als sichtbarer UI-Text.

Die Hauptzeitachse zeigt weiterhin die lokal berechnete Amplituden-Wellenform. Alle visuellen Bereiche sind farblich nach Funktion getrennt:

- Loop-Kasten, Loop-Start/Ende und zugehörige Kontrollen: leicht rot.
- Cursor, Cursor-Geschwindigkeit und Cursor-Kontrollen: leicht blau.
- Fokuslinie und Fokus-Kontrollen: leicht grün.
- Markierungen und Markierungs-Kontrollen: leicht orange.

Cursor, Loop-Start, Loop-Ende, Fokus und Markierungen zeigen direkt an ihren Strichen eine nicht interaktive Zeitangabe. Der blaue Cursor bleibt ausschließlich über seinen Punkt greifbar. Der grüne Fokus ist nur bei ausgeschaltetem automatischem Folgen direkt verschiebbar.

Unter der Zeitachse liegen kompakte Präzisionsbereiche. Fokus und Cursor stehen links, der Loop-Block direkt rechts daneben; Markierungen liegen darunter über die ganze Breite. Direkt hinter jedem Standort steht die Position bis auf Millisekunden. Freie Zahleneingaben wurden durch kompakte Auswahllisten für Schrittweiten ersetzt. Auch Vorlaufwerte sind positive Auswahlen und bedeuten ausschließlich eine Position **vor** Start bzw. Ende.

Markierungen werden als A, B, C usw. angezeigt. Über den globalen Löschknopf steht ein eigener **Markierung setzen**-Knopf. Eine ausgewählte Markierung kann über `•••` zum Zoom-Fokus, zum Loop-Anfang oder zum Loop-Ende übertragen oder einzeln gelöscht werden. Das Löschen aller Markierungen verlangt eine Bestätigung.

Die Audiodatei bleibt beim gesamten Bearbeiten unverändert. `Loop speichern` persistiert weiterhin ausschließlich Start, Ende, Aktivstatus und Marker als Metadaten. Sowohl **Loop speichern** als auch **Loop löschen** verlangen vor der Änderung eine Bestätigung.

## Player-Stabilität bei Song-Metadaten

Der Player verwendet für die aktuelle Audiodatei eine Objekt-URL. Diese URL darf nicht bei jeder Änderung des Song-Objekts neu erzeugt werden, weil Änderungen wie Loop speichern, Loop an/aus, Dauer ergänzen oder Umbenennen sonst das Audio-Element neu laden und die Wiedergabe unterbrechen können.

Deshalb hängt die Objekt-URL nur noch von der **Song-ID und dem tatsächlichen Blob** ab. Reine Metadatenänderungen lassen die Audioquelle unverändert. Zusätzlich werden diese Metadatenänderungen nun auch in IndexedDB getrennt vom Blob gespeichert.

## Player, Wiederholung und Media Session

Ein kurzer Druck auf `↻` schaltet weiterhin die Wiederholung der aktuellen Liste um. Ein Langdruck auf denselben Knopf aktiviert einen Sondermodus mit `↻1`: Ohne Mehrfachauswahl wird der aktuell gewählte Song wiederholt. Mit aktiver Mehrfachauswahl werden die ausgewählten Songs als feste Wiederholgruppe übernommen und anschließend grün in den Listen markiert. Die Gruppe läuft in ihrer Reihenfolge zyklisch weiter; das Symbol bleibt auch bei mehreren Songs `↻1`. Ein normaler kurzer Druck beendet den Sondermodus zunächst vollständig; ein weiterer kurzer Druck kann danach wieder die normale Listenwiederholung einschalten.

Ein einzelnes HTML-Audio-Element übernimmt Wiedergabe, Fortschritt, Systemsteuerung und Loop-Vorschau. Loop-Grenzen werden während laufender Wiedergabe zusätzlich per `requestAnimationFrame` überwacht, statt nur auf das deutlich seltenere `timeupdate` zu warten. Das reduziert die hörbare Verzögerung beim Zurückspringen erheblich, kann auf Safari/iPadOS aber kein sample-genaues Gapless-Segment-Looping garantieren. Als Fallback existiert ein globaler Loop-Auslauf-Master in den Einstellungen: Ist er aktiv, kann ein Song bis eine Sekunde nach dem gesetzten Loop-Ende weiterlaufen, bevor zum Loop-Start gesprungen wird. Pro Song kann dieser Auslauf deaktiviert werden. Vollständig gehörte Songs werden nur beim natürlichen `ended`-Ereignis gezählt. Media Session wird genutzt, soweit Safari/iPadOS sie bereitstellt.

Im Kopfbereich stehen Home und Einstellungen links vor Zurück/Vor. Home öffnet immer die Bibliothek. Die Einstellungen enthalten zunächst die globale Spulweite (5/10/15/30/60 Sekunden) und den Master-Schalter für den Loop-Auslauf. Der Hauptplayer verwendet die konfigurierte Spulweite als ⏪ / Play-Pause / ⏩-Gruppe. Die Song-Detailansicht zeigt Shuffle und Wiederholen außen um ihre bisherigen Transportknöpfe; derselbe Langdruck auf Wiederholen aktiviert dort ebenfalls `↻1`.

## PWA und Deployment

`vite-plugin-pwa` erzeugt Manifest und Service Worker. Der Vite-Basispfad bleibt relativ (`./`). `.github/workflows/deploy.yml` baut `main` und veröffentlicht `dist` auf GitHub Pages. Der frühere eigene Pull-to-Refresh-Wrapper ist entfernt; `main.tsx` rendert `App` direkt. Dadurch kann vertikales Ziehen/Scrollen nicht mehr absichtlich `window.location.reload()` auslösen. Zusätzlich unterbindet die Oberfläche Scroll-Chaining per `overscroll-behavior`.

## Grenzen

IndexedDB und Web Share werden vom Browser/iPadOS kontrolliert. Verlorene lokale Audiodaten können ohne erneuten Import nicht rekonstruiert werden. Dateifreigabe kann je nach Safari-/PWA-Version eingeschränkt sein. Die Wellenform benötigt lokale Dekodierunterstützung für das jeweilige Audioformat. Für eine Produktversion bleiben Backup, Wiederherstellung und gegebenenfalls eine native App-Hülle wichtige Themen.
