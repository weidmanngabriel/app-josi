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

### Audiodatei und Metadaten sind getrennt geschützt

Seit IndexedDB-Version 2 werden Änderungen an Song-Metadaten **nicht mehr in den Datensatz mit dem Audio-Blob zurückgeschrieben**. Der bestehende Store `songs` bleibt die Basis für die eigentliche importierte Audiodatei. Der zusätzliche Store `songMetadata` enthält nur kleine Werte wie Name, Dauer, Sortierposition, Neu-Status, Hörzähler und Loop-Daten.

`getSongs()` lädt die Basis-Songs und legt die Metadaten darüber. Dabei hat die Audiodatei aus `songs` immer Vorrang und kann nicht durch einen Metadaten-Eintrag ersetzt werden.

`saveSong()` und `saveSongOrder()` schreiben bei bereits vorhandenen Songs nur nach `songMetadata`. Der große Audio-Blob wird dadurch beim Loop-Speichern, Umbenennen, Markieren als gelesen, Aktualisieren der Dauer, Zählen einer Wiedergabe oder Ändern der Reihenfolge nicht mehr erneut serialisiert.

Ein vollständiger Song inklusive Blob wird nur geschrieben, wenn noch kein Basis-Song mit dieser ID existiert, zum Beispiel bei Import, Kopieren oder Wiederherstellen eines gelöschten Songs per Undo. `deleteSong()` entfernt Basis-Song und Metadaten gemeinsam.

Diese Trennung ist eine Datenintegritätsmaßnahme für Safari/iPadOS. Sie verhindert insbesondere, dass eine reine Loop-Änderung die lokal gespeicherte Audiodatei erneut schreiben muss.

### Playlists und Tags

Playlists enthalten ID, Name, geordnete Song-IDs, optionales Bild, Erstellungs-/Nutzungszeit und manuelle Sortierposition. Tags liegen ab IndexedDB-Version 3 in einem eigenen `tags`-Store und enthalten Name, frei wählbare Farbe, Song-IDs, Playlist-IDs und eine manuelle Sortierposition. Beim Erstellen und Umbenennen öffnet der Farbring ein frei antippbares Farbspektrum; erst „Fertig“ übernimmt die gewählte Farbe. Tags referenzieren ausschließlich vorhandene Objekte und duplizieren niemals Audiodateien. Ein Song oder eine Playlist kann mehrere Tags besitzen; Tags selbst können nicht Mitglied einer Playlist sein.

## Import und Speicherstabilität

Der Import verwendet ausschließlich `<input type="file" multiple>`. Beim Import werden nur neue Dateien geschrieben. Vorherige Neu-Markierungen werden nur an den betroffenen Songs geändert; die gesamte Bibliothek wird nicht erneut gespeichert.

Die Lieddauer wird erst beim tatsächlichen Laden im HTML-Audio-Element gespeichert. `--:--` bedeutet unbekannte Dauer, `FEHLT` bedeutet, dass der lokale Blob fehlt oder Größe 0 hat.

Bereits vor der Trennung beschädigte oder verlorene Blobs können nicht rekonstruiert werden. Solche Dateien müssen erneut importiert werden. Die neue Speicherstruktur verhindert nur zukünftige unnötige Blob-Schreibvorgänge.

## Drei-Punkte-Menüs

Langdruck wird grundsätzlich nicht für Objektaktionen verwendet. Zusatzfunktionen liegen in sichtbaren `•••`-Menüs. **Einzige bewusste Ausnahme ist der Wiederholen-Knopf im Player:** Langdruck öffnet eine Wiederholungsbox mit `∞` oder einer frei wählbaren Anzahl.

### Song-Menü

In dieser Reihenfolge:

1. Umbenennen
2. Kopieren
3. Einfügen
4. Tags
5. Teilen
6. Loop erstellen bzw. Loop bearbeiten
7. Bei vorhandenem Loop: Loop aktivieren bzw. Loop deaktivieren
8. Nur bei blau markierten Songs: „Als gelesen markieren“ in Blau
9. Nur bei blau markierten Songs: „Alle als gelesen markieren“ in Blau
10. Löschen in Rot

Beim Teilen wird aus dem gespeicherten Blob eine `File` erzeugt und über die Web Share API an die Systemfreigabe übergeben, sofern Browser/iPadOS Dateifreigabe unterstützt. Bei fehlender Unterstützung zeigt Josi eine Meldung.

### Playlist-Menü

Einzelne Playlists bieten Bild ändern, Umbenennen, Kopieren, Einfügen, Tags, Teilen und Löschen. „Teilen“ übergibt eine Textübersicht mit Playlistname und Liedliste an die Systemfreigabe. Der separate Löschknopf in der geöffneten Playlist wurde entfernt; die Bestätigungsabfrage bleibt erhalten.

Das `•••` neben der Überschrift „Playlists“ bietet „Auswählen“, „Bearbeiten“ und „Übersicht“. Im Auswahlmodus erscheint zusätzlich der schwebende Drei-Punkte-Knopf unten rechts.

## Papierkorb, Löschen und Undo/Redo

Unter Loops liegt ein Papierkorb. Song- und Playlist-Löschen verwenden Bestätigungsdialoge und verschieben die Objekte zunächst nur in diesen lokalen Papierkorb. Der Song-Blob bleibt dabei im bestehenden Song-Store; Playlists werden per `trashedAt` ausgeblendet. Gelöschte Loops bleiben als kleine `trashedLoop`-Metadaten am Song erhalten. Alle drei Typen können einzeln wiederhergestellt werden. Erst „Papierkorb leeren“ entfernt nach erneuter Bestätigung Songs/Blobs und Playlists endgültig bzw. verwirft gelöschte Loop-Metadaten. Normale Löschaktionen werden deshalb nicht zusätzlich in den Undo-Verlauf geschrieben.

Undo/Redo bleibt für normale Bearbeitungen, Kopieren und Reihenfolgeänderungen zuständig. Löschvorgänge werden dagegen über den Papierkorb wiederhergestellt und nicht zusätzlich als Undo-Schritt geführt. Frisch importierte Dateien werden weiterhin nicht automatisch durch Undo gelöscht.

Die sichere Metadaten-Speicherung prüft bei Undo, ob der Basis-Song noch existiert. Nur wenn er fehlt, wird der Blob aus dem Snapshot einmalig wiederhergestellt; vorhandene Blobs werden nicht überschrieben.

## Mehrfachauswahl und Playlist-Zuordnung

Bibliothek, Playlists, Importverlauf und Loops verwenden denselben Song-Auswahlmodus. Rechts neben „Alle Playlists“ liegt im Auswahlmodus ein runder `•••`-Knopf. Er bietet unter anderem Gruppieren, Bewegen, Tags und Alle löschen. Playlists und Tags besitzen einen entsprechenden eigenen Auswahlmodus mit einem schwebenden `•••` unten rechts; dort kann die Auswahl gruppiert werden. Bewegen arbeitet nur in Bibliothek bzw. geöffneter Playlist und verschiebt die Auswahl als Block innerhalb der manuellen Reihenfolge. Ist eine andere Sortierung aktiv, fragt Josi vorab nach dem Wechsel auf Manuell; bei Nein wird abgebrochen. Alle löschen verlangt eine Sicherheitsabfrage und entfernt die ausgewählten lokalen Dateien aus allen Playlists.

## Suche

Bibliothek und geöffnete Playlists besitzen eine lokale Textsuche. Sie arbeitet nur mit der tatsächlich eingegebenen Zeichenfolge im Songnamen: Groß-/Kleinschreibung wird ignoriert, es gibt aber keine semantische oder unscharfe Suche. Eine aktive Suche verändert weder manuelle Reihenfolge noch Songdaten.

## Importverlauf

Der frühere Tab „Verlauf“ heißt „Importverlauf“. Er zeigt alle aktiven Songs. Die Navigation zeigt `x/y`: x sind aktuell blau markierte neue Importe, y ist die Gesamtzahl aller aktiven Songs. Die Zahl x ist blau. In allen Songlisten werden blau markierte Songs als temporäre obere Gruppe von normalen Songs getrennt; innerhalb beider Gruppen gilt dieselbe gewählte Sortierung. Nach „Als gelesen markieren“ fällt der Song zurück in die normale Gruppe.

## Sortierung

Alle Songlisten unterstützen `Manuell`, `A–Z Anfang`, `A–Z Ende`, `Anzahl des Hörens`, `Dauer` und `Chronik`. Die Sortieransicht verändert die manuelle Reihenfolge nicht. Die gewählte Ansicht und Richtung werden in `localStorage` gespeichert. Neben Sortierbox und Richtungspfeil liegt ein `•••`. In Bibliothek bzw. geöffneter Playlist kann die aktuelle nicht-manuelle Sortierung inklusive Pfeilrichtung nach Bestätigung einmalig als neue manuelle Reihenfolge gespeichert werden; danach wird auf Manuell gewechselt und es gibt keine automatische Nachsortierung.

## Präziser Loop-Editor

Die Loop-Ansicht folgt dem vom Nutzer skizzierten Schnittplatz-Layout. Sie ist eine feste Vollbildansicht mit eigener vertikaler Scrollfläche; die normale App-Seite wird dabei nicht verschoben.

Oben liegt eine kompakte, beim Scrollen sichtbare Steuerleiste mit Zurück/Vor sowie **lokalem Editor-Undo/Redo**. Zoom wird über eine Liste von 1× bis 15× gewählt. Die Cursor-Geschwindigkeit wird über 5%, 10%, 25%, 50%, 75%, 100%, 150%, 200%, 500%, 1000% oder 5000% gewählt. `Fokus folgt Cursor` ist dreistufig: Zentrieren, seitenweises Umblättern oder aus. Loop-Kasten, Cursor-Loop und Markierungen werden als Schalter dargestellt. Die erläuternden Begriffe aus der Skizze in Klammern erscheinen nicht als sichtbarer UI-Text.

Die Hauptzeitachse zeigt weiterhin die lokal berechnete Amplituden-Wellenform. Alle visuellen Bereiche sind farblich nach Funktion getrennt:

- Loop-Kasten, Loop-Start/Ende und zugehörige Kontrollen: leicht rot.
- Cursor, Cursor-Geschwindigkeit und Cursor-Kontrollen: leicht blau.
- Fokuslinie und Fokus-Kontrollen: leicht grün.
- Markierungen und Markierungs-Kontrollen: leicht orange.

Cursor, Loop-Start, Loop-Ende, Fokus und Markierungen zeigen direkt an ihren Strichen eine nicht interaktive Zeitangabe. Der blaue Cursor bleibt ausschließlich über seinen Punkt greifbar. Der grüne Fokus ist nur bei ausgeschaltetem automatischem Folgen direkt verschiebbar.

Unter der Zeitachse liegen kompakte Präzisionsbereiche. Fokus und Cursor stehen links, der Loop-Block direkt rechts daneben; Markierungen liegen darunter über die ganze Breite. Direkt hinter jedem Standort steht die Position bis auf Millisekunden. Freie Zahleneingaben wurden durch kompakte Auswahllisten für Schrittweiten ersetzt. Beim Cursor stehen zusätzlich 30 und 60 Sekunden zur Verfügung. Auch Vorlaufwerte sind positive Auswahlen und bedeuten ausschließlich eine Position **vor** Start bzw. Ende.

Markierungen werden als A, B, C usw. angezeigt. Über den globalen Löschknopf steht ein eigener **Markierung setzen**-Knopf. Eine ausgewählte Markierung kann über `•••` direkt zum Cursor, zum Zoom-Fokus, zum Loop-Anfang oder zum Loop-Ende übertragen oder einzeln gelöscht werden. Das Löschen aller Markierungen verlangt eine Bestätigung.

Die Audiodatei bleibt beim gesamten Bearbeiten unverändert. `Loop speichern` persistiert weiterhin ausschließlich Start, Ende, Aktivstatus und Marker als Metadaten. Sowohl **Loop speichern** als auch **Loop löschen** verlangen vor der Änderung eine Bestätigung.

## Player-Stabilität bei Song-Metadaten

Der Player verwendet für die aktuelle Audiodatei eine Objekt-URL. Diese URL darf nicht bei jeder Änderung des Song-Objekts neu erzeugt werden, weil Änderungen wie Loop speichern, Loop an/aus, Dauer ergänzen oder Umbenennen sonst das Audio-Element neu laden und die Wiedergabe unterbrechen können.

Deshalb hängt die Objekt-URL nur noch von der **Song-ID und dem tatsächlichen Blob** ab. Reine Metadatenänderungen lassen die Audioquelle unverändert. Zusätzlich werden diese Metadatenänderungen nun auch in IndexedDB getrennt vom Blob gespeichert.

## Player, Wiederholung und Media Session

Ein kurzer Druck auf `↻` schaltet weiterhin die Wiederholung der aktuellen Liste um. Ein Langdruck öffnet stattdessen eine Box mit zwei Sonderoptionen: `∞` oder eine frei eingegebene Anzahl. Das aktive Sonderziel wird als `∞` bzw. als verbleibende Zahl direkt am Wiederholen-Symbol gezeigt. Bei einem aktivierten gespeicherten Loop wird die Zahl nach jedem Loop-Durchlauf heruntergezählt; bei 0 wird der Loop für diese Wiedergabe nicht mehr zurückgesetzt und der Song kann normal bis zum nächsten Lied weiterlaufen. Bei Songs ohne aktiven Loop gilt dieselbe Sonderzahl für vollständige Song-Wiederholungen. Die Einstellung ist nur Wiedergabezustand und wird nicht in Song-Metadaten gespeichert.

Für normale Wiedergabe bleibt ein HTML-Audio-Element der aktive Player. Bei einem gespeicherten Loop steht ein zweites unsichtbares Audio-Element mit derselben lokalen Quelle bereit. Kurz vor dem Loop-Ende startet der zweite Kanal bereits am Loop-Anfang; beide laufen ungefähr 0,18 Sekunden gleichzeitig. Wenn der Browser Lautstärkeänderungen erlaubt, werden sie dabei gegeneinander überblendet. Danach wird der neue Kanal zum aktiven Player und der bisherige pausiert. So muss der hörbare Ton beim Zurückspringen nicht vollständig abreißen.

Falls iPadOS/Safari den zweiten Wiedergabekanal technisch nicht starten lässt, wechselt Josi für diesen Song auf einen lokalen Fallback: Die Audiodatei wird im AudioContext dekodiert und in einem kleinen Bereich um die vom Nutzer gesetzten Loop-Grenzen nach zwei möglichst ähnlich verlaufenden Signalabschnitten durchsucht. Dieser automatisch gefundene Verbindungspunkt wird nur für die Wiedergabe verwendet und überschreibt die gespeicherten manuellen Loop-Punkte nicht. Die Heuristik kann musikalisch falsch liegen. Vollständig gehörte Songs werden nur beim natürlichen `ended`-Ereignis gezählt. Media Session wird genutzt, soweit Safari/iPadOS sie bereitstellt.

Im Kopfbereich stehen Home und Einstellungen links vor Zurück/Vor. Home öffnet immer die Bibliothek. Die Einstellungen enthalten zunächst die globale Spulweite (5/10/15/30/60 Sekunden) und eine kurze Erklärung des automatischen Loop-Übergangs. Der Hauptplayer ordnet die Steuerung symmetrisch von innen nach außen: Play/Pause, Spulen, Liedwechsel und außen Shuffle bzw. Wiederholen. Die Song-Detailansicht zeigt Shuffle und Wiederholen außen um ihre bisherigen Transportknöpfe; derselbe Langdruck auf Wiederholen öffnet dort ebenfalls die Auswahl zwischen `∞` und einer endlichen Wiederholungszahl.

## PWA und Deployment

`vite-plugin-pwa` erzeugt Manifest und Service Worker. Der Vite-Basispfad bleibt relativ (`./`). `.github/workflows/deploy.yml` baut `main` und veröffentlicht `dist` auf GitHub Pages. Der frühere eigene Pull-to-Refresh-Wrapper ist entfernt; `main.tsx` rendert `App` direkt. Dadurch kann vertikales Ziehen/Scrollen nicht mehr absichtlich `window.location.reload()` auslösen. Zusätzlich unterbindet die Oberfläche Scroll-Chaining per `overscroll-behavior`.

## Grenzen

IndexedDB und Web Share werden vom Browser/iPadOS kontrolliert. Verlorene lokale Audiodaten können ohne erneuten Import nicht rekonstruiert werden. Dateifreigabe kann je nach Safari-/PWA-Version eingeschränkt sein. Die Wellenform benötigt lokale Dekodierunterstützung für das jeweilige Audioformat. Für eine Produktversion bleiben Backup, Wiederherstellung und gegebenenfalls eine native App-Hülle wichtige Themen.


## Josi-Zwischenablage und Namenskonflikte

`Kopieren` legt Songs oder Playlists zunächst nur in eine app-interne Zwischenablage; die eigentliche Kopie entsteht erst über `Einfügen`. Beim Einfügen in die Bibliothek bzw. eine Playlist wird ein neuer Song-Datensatz mit neuer ID angelegt, ohne bestehende Audiodaten neu zu schreiben. Gleichnamige Ziele lösen eine Auswahl `Ersetzen`, `Beide einfügen` oder `Abbrechen` aus. Bei Abbrechen wird der Konflikt als wiederholbare Aktion vorgemerkt; der globale Redo-Pfeil öffnet dieselbe Konfliktprüfung erneut.

## Tags

Playlists und Tags sind getrennte, einklappbare Bereiche in der Seitenleiste. Ein Klick auf die freie Überschriftsfläche klappt den Bereich ein oder aus; interaktive Knöpfe stoppen diese Aktion. Tags besitzen eine eigene in `localStorage` gespeicherte Sortierung mit denselben Modi wie Songlisten; `Dauer` heißt bei Tags `Anzahl der Lieder`, und `Anzahl des Hörens` summiert die vollständigen Wiedergaben der verknüpften Songs. Die manuelle Tag-Reihenfolge kann wie bei Playlists verschoben werden.

Songzeilen zeigen Tags platzsparend nur als farbige Punkte vor der Playlist-Zuordnung. In der Song-Detailansicht erscheinen Punkt und Tagname gemeinsam. Playlists zeigen ihre Tag-Punkte ebenfalls in Navigation und Übersicht. Das Tag-`•••` bei Songs, Playlists und Mehrfachauswahl öffnet eine Mehrfachauswahl der vorhandenen Tags. Wenn innerhalb eines Tags bereits ein gleichnamiger Song bzw. eine gleichnamige Playlist existiert, gilt ebenfalls `Ersetzen`, `Beide einfügen` oder `Abbrechen`. Gelöschte Tags landen wie Songs, Playlists und Loops im Papierkorb.


## Seitenleisten-Sortierung, Detailmenü und Navigation

Die Sortierfelder für Tags und Playlists stehen nicht dauerhaft in der Seitenleiste. Bei einem einzelnen Tag bzw. einer Playlist liegt direkt unter `Umbenennen` die Aktion `Sortieren`; sie öffnet einen kompakten Dialog für Sortiermodus und Richtung. Beide Listen speichern ihre Auswahl separat. Die Song-Detailansicht besitzt ein eigenes `•••` mit nur songbezogenen Aktionen inklusive Tags; globale Listen-Sortierung erscheint dort nicht. `Home` schließt den Loop-Editor explizit, bevor zur Bibliothek navigiert wird, damit ein bereits aktiver Bibliotheks-Navigationseintrag den Editor nicht offen hält.


## Objektgruppen und Farbfeld

Lieder, Playlists und Tags können jeweils innerhalb ihres eigenen Typs zu persistenten Objektgruppen zusammengefasst werden. Gruppen sind reine lokale Metadaten in `localStorage` und enthalten ID, Typ, Namen, Objekt-IDs, manuelle Gruppenposition sowie eine interne Sortierung. Audiodateien, Playlist-Inhalte und Tag-Zuordnungen werden dadurch nicht dupliziert. Ein Objekt darf in mehreren Gruppen desselben Typs referenziert werden; Lieder, Playlists und Tags werden dabei niemals typübergreifend gemischt. Gruppen stehen in der jeweiligen Liste immer vor ungruppierten Objekten und werden untereinander nach der Sortierung der Gesamtliste angeordnet. Innerhalb der Gruppe kann `Allgemeine Sortierung` verwendet werden oder eine eigene Sortierung inklusive manueller Reihenfolge. Das Gruppenmenü besitzt zusätzlich Kopieren und Einfügen direkt vor `Gruppe bewegen`: Kopieren merkt sich ausschließlich die Objekt-IDs der Gruppe, Einfügen ergänzt sie nur in einer Gruppe desselben Typs und dupliziert keine Audiodateien oder Playlist-/Tag-Daten.

Die Gruppenzeile zeigt Name, Anzahl der aktuell dargestellten Objekte und deren Gesamtdauer. Gruppen für Songs können als temporäre Player-Queue abgespielt werden. Weitere Gruppenaktionen sind Umbenennen, Sortieren, Reihenfolge ändern, Gruppe bewegen, Objekte hinzufügen/entfernen und Auflösen. Playlists und Tags besitzen dafür einen eigenen Mehrfachauswahlmodus mit einem schwebenden `•••` unten rechts.

Die Tag-Farbauswahl verwendet keine feste Palette mehr. Ein zweidimensionales Spektrum wird rein im Frontend dargestellt; ein Tippen setzt einen nicht interaktiven Zielpunkt. Erst `Fertig` übernimmt die Farbe unter diesem Punkt, `Abbrechen` verwirft sie.

Die endliche Wiederholung verwendet zusätzlich einen synchronen Restzähler in einem Ref. Dadurch liest insbesondere das native `ended`-Ereignis bei normalen, nicht geloopten Songs immer den aktuellen Wert und startet das Audio zuverlässig neu, bevor nach Erreichen von 0 zum nächsten Song gewechselt wird.


Beim Dialog `Objekte hinzufügen` wird eine Auswahl zunächst nur vorgemerkt: `+` wechselt zu `−`, ohne die Gruppe sofort zu verändern. `−` nimmt die vorgemerkte Auswahl wieder zurück. Erst `Fertig` übernimmt alle vorgemerkten Objekte gemeinsam; `Abbrechen` verwirft sie.


## Globale Loop-Aktivierung

In den Einstellungen gibt es eine gespeicherte globale Loop-Regel mit drei Zuständen: `Aktiviert`, `Deaktiviert` und `Manuell`. Ohne bestehende Einstellung startet Josi mit `Deaktiviert`. Die automatischen Zustände verändern keine Song-Metadaten: `Aktiviert` behandelt jeden Song mit gesetztem Loop bei Wiedergabe und Anzeige als aktiv, `Deaktiviert` behandelt jeden vorhandenen Loop als inaktiv. Nur `Manuell` verwendet `song.loopEnabled`.

Wenn eine einzelne Loop-Aktivierung in Song-Menü oder Detailansicht bzw. eine Mehrfachaktion auf ausgewählten Loop-Songs in einem automatischen Modus angefordert wird, fragt Josi vorab nach dem Wechsel zu `Manuell`. Bei Ablehnung wird die Aktion vollständig verworfen. Bei Zustimmung wechselt die globale Regel auf `Manuell` und schreibt erst danach die individuellen `loopEnabled`-Werte als Metadaten. Im Song-Auswahlmenü erscheinen `Alle Loops aktivieren` und `Alle Loops deaktivieren` nur dann, wenn sämtliche ausgewählten Songs einen gespeicherten Loop besitzen.


## Gruppen einklappen und Undo

Die globale Undo/Redo-Snapshot-Struktur enthält neben Songs, Playlists und Tags auch die persistenten Objektgruppen. `Gruppe auflösen` legt vor dem Entfernen einen Snapshot an; Undo stellt die Gruppe inklusive Name, Typ, Objekt-IDs, Position und Gruppensortierung wieder her, Redo löst sie erneut auf. Audiodateien oder andere Objekte werden dabei nicht kopiert.

Jede Gruppen-Kopfzeile ist selbst ein einklappbarer Bereich. Ein Klick auf die fast weiße Zeile mit Name, Objektanzahl und Dauer blendet ausschließlich die enthaltenen Objekte ein oder aus; `•••` und die Gruppen-Werkzeuge stoppen dieses Ereignis und bleiben unabhängig bedienbar. Der Einklappstatus wird lokal gespeichert und gilt für Lied-, Playlist- und Taggruppen. Playlist- und Taggruppen werden direkt in ihren Bereichen der linken Seitenleiste dargestellt und können dort genauso ein- und ausgeklappt werden wie Liedgruppen in der Hauptliste.
