# Architektur

## Überblick

Die Anwendung ist eine rein clientseitige React-App mit TypeScript und Vite. `src/App.tsx` enthält die Musikoberfläche und Interaktionslogik, `src/musicDb.ts` kapselt IndexedDB, `src/styles.css` enthält das Grundlayout, `src/enhancements.css` Zusatzfunktionen und `src/loopEditor.css` den präzisen Loop-Editor.

Josi bleibt eine lokale Musik-PWA ohne Backend. Audiodateien und Playlists liegen ausschließlich im Browser-Speicher des jeweiligen Geräts.

Die PWA registriert ihren Service Worker weiterhin im Auto-Update-Modus. Beim Start wird aktiv nach einer neuen Version gesucht; steht ein neuer Service Worker bereit, wird er übernommen und die App neu geladen. Es gibt bewusst keinen periodischen Zwangs-Reload während einer laufenden Sitzung, weil ein noch nicht abgeschlossener Import nur im Arbeitsspeicher liegt und sonst verloren gehen könnte.

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

Playlists enthalten ID, Name, geordnete Song-IDs, optionales Bild samt Bildausschnitt (Zoom, X-/Y-Versatz und Hintergrundfarbe), Erstellungs-/Nutzungszeit und manuelle Sortierposition. Tags liegen ab IndexedDB-Version 3 in einem eigenen `tags`-Store und enthalten Name, frei wählbare Farbe, optionales Bild mit denselben Ausschnittsdaten, Song-IDs, Playlist-IDs, optionale Gruppen-IDs und eine manuelle Sortierposition. Beim Erstellen und Umbenennen öffnet der Farbring ein frei antippbares Farbspektrum; erst „Fertig“ übernimmt die gewählte Farbe. Tags referenzieren ausschließlich vorhandene Objekte und duplizieren niemals Audiodateien. Eine getaggte Gruppe speichert nur die Gruppen-ID: ihre enthaltenen Lieder, Playlists, Tags oder Untergruppen werden dadurch nicht automatisch getaggt. Beim Auflösen oder Löschen einer Gruppe werden verwaiste Gruppen-Referenzen aus Tags entfernt.

## Import und Speicherstabilität

Der Dateiauswahldialog verwendet weiterhin ausschließlich `<input type="file" multiple>`, schreibt die gewählten Dateien aber **nicht sofort** nach IndexedDB. Stattdessen entsteht zuerst ein Import-Arbeitsbereich im Arbeitsspeicher. Dort stehen alle ausgewählten Dateien gleichzeitig in einer Liste. Erst nach **Fertig → Importieren** werden die Blobs gespeichert. **Abbrechen → Nicht importieren** verwirft den Entwurf ohne neue Song-Datensätze. Beide Abschlüsse verlangen eine Bestätigung.

Die Lieddauer wird erst beim tatsächlichen Laden im HTML-Audio-Element gespeichert. `--:--` bedeutet unbekannte Dauer, `FEHLT` bedeutet, dass der lokale Blob fehlt oder Größe 0 hat.

Bereits vor der Trennung beschädigte oder verlorene Blobs können nicht rekonstruiert werden. Solche Dateien müssen erneut importiert werden. Die neue Speicherstruktur verhindert nur zukünftige unnötige Blob-Schreibvorgänge.

## Import-Arbeitsbereich

Bei einem Mehrfachimport bleibt die ursprüngliche Dateiauswahl als manuelle Reihenfolge erhalten: zuerst ausgewählte Datei oben, danach die weiteren Dateien. Das Importfenster besitzt zusätzlich A–Z Anfang, A–Z Ende und Auswahlreihenfolge als reine Ansichtssortierungen. Über das eigene `•••` stehen **Auswählen**, **Umbenennen**, **Reihenfolge ändern** und **Bewegen** zur Verfügung. **Auswählen** kann die Zielmenge der folgenden Aktionen auf einzelne Importdateien begrenzen. **Reihenfolge ändern** arbeitet mit Pfeilen und verändert die manuelle Importreihenfolge.

**Bewegen** ist dreistufig. Es startet ausdrücklich mit leerer Auswahl; **Alles auswählen** und **Nichts auswählen** stehen nebeneinander. Nach **Bestätigen** erscheint ein eigenes Prüf-Fenster nur mit den ausgewählten Dateien. Dort können Dateien wieder aus dieser Bewegung entfernt und mit Pfeilen untereinander neu angeordnet werden. Nach erneutem **Bestätigen** wird die echte Bibliothek sichtbar; rote Einfügelinien markieren die mögliche Zielposition. **Zurück** führt jeweils eine Stufe zurück, **Bestätigen** übernimmt die aktuelle Stufe und **Abbrechen** öffnet von jeder Stufe aus die Bestätigung zum Abbruch des gesamten Imports. Die gewählte Bibliotheksposition wird erst beim abschließenden Import gespeichert.

Umbenennen wird als ein Undo-Schritt vorbereitet; Positionsänderungen erzeugen jeweils eigene Import-Undo-Schritte. Undo/Redo im Importfenster arbeitet zuerst auf diesem Entwurf. Beim bestätigten Import wird zusätzlich ein normaler App-Snapshot angelegt. Ein direkt anschließendes globales Undo entfernt die importierten Songs wieder aus IndexedDB und öffnet denselben Importentwurf inklusive der noch im Arbeitsspeicher gehaltenen Dateien erneut. Weitere Undo-Schritte können anschließend die vor dem Import vorgenommenen Umbenennungen und Bewegungen rückgängig machen. Redo funktioniert entsprechend in Gegenrichtung.

## Drei-Punkte-Menüs

Langdruck wird nicht für normale Objektaktionen verwendet; diese bleiben in sichtbaren `•••`-Menüs. Bewusste Ausnahmen sind der Wiederholen-Knopf im Player und die benannten Sortier-Saves: Wiederholen öffnet per Langdruck die Wiederholungsbox, ein Save öffnet per Langdruck den Dialog zum Umbenennen. Drei-Punkte-Menüs, deren Auslöser in der linken Playlist-/Tag-Spalte liegt, werden auf der rechten Bildschirmseite geöffnet, damit sie die linke Navigation nicht verdecken.

### Song-Menü

In dieser Reihenfolge stehen die Bearbeitungsaktionen mit **Auswählen** und **Reihenfolge ändern** direkt vor dem Positions-/Kopierbereich: Umbenennen, Auswählen, Reihenfolge ändern, Bewegen, Kopieren, Einfügen, Tags, Teilen, Loop erstellen bzw. bearbeiten, gegebenenfalls Loop aktivieren/deaktivieren, die blauen Gelesen-Aktionen und Löschen in Rot.

Beim Teilen wird aus dem gespeicherten Blob eine `File` erzeugt und über die Web Share API an die Systemfreigabe übergeben, sofern Browser/iPadOS Dateifreigabe unterstützt. Bei fehlender Unterstützung zeigt Josi eine Meldung.

### Playlist-Menü

Einzelne Playlists bieten Bild ändern, Umbenennen und Sortieren; direkt danach stehen **Auswählen**, **Reihenfolge ändern**, **Bewegen** und **Kopieren**, gefolgt von Tags, Einfügen, Teilen und Löschen. „Teilen“ übergibt eine Textübersicht mit Playlistname und Liedliste an die Systemfreigabe. Der separate Löschknopf in der geöffneten Playlist wurde entfernt; die Bestätigungsabfrage bleibt erhalten. Einzelne Tags besitzen zusätzlich **Bild ändern** und entsprechend **Auswählen** sowie **Reihenfolge ändern** vor ihrer Bewegen-Aktion.

Das `•••` neben den Überschriften **Playlists** und **Tags** bietet jeweils **Auswählen**, **Reihenfolge ändern**, direkt vor der Übersicht **Playlist suchen** beziehungsweise **Tag suchen** und **Übersicht**. Die Suchaktion öffnet die jeweilige Übersicht und fokussiert sofort deren Suchfeld. Beide Übersichten zeigen Gruppen und Einzelobjekte als Bildkarten in einem festen Raster mit immer vier Spalten. Direkt unter der Objektanzahl liegt eine Suchleiste wie in der Bibliothek; über **Gruppen** kann die Suche zusätzlich Gruppennamen einbeziehen. Eine einzelne Karte bleibt deshalb genauso breit wie eine Karte in einer vollen Viererreihe. Tag-Karten verwenden dieselbe Bildgröße wie Playlist-Karten; ihr Bild wird mit der eigentlichen Tag-Farbe umrahmt. Nach der Wahl eines Playlist- oder Tag-Bildes öffnet sich vor dem Speichern ein Bildeditor. Das Bild kann im quadratischen Rahmen frei verschoben, über Regler vergrößert/verkleinert und mit einer Hintergrundfarbe aus demselben Farbwähler wie Tags kombiniert werden. Erst **Fertig** speichert Bild und Ausschnitt; **Abbrechen** verwirft den Entwurf. Unten in der Tag-Übersicht steht zusätzlich **Neuer Tag**. Im Auswahlmodus erscheint der schwebende Drei-Punkte-Knopf über der linken Playlist-/Tag-Spalte; seine Funktionsliste öffnet rechts im Bildschirm.

## Direkte Tags für Playlists und Gruppen

Einzelne Playlists besitzen **Tags** direkt unter **Kopieren**. Im Playlist-Mehrfachauswahlmenü steht dieselbe Aktion für alle markierten Playlists. Benannte Gruppen besitzen ebenfalls **Tags** direkt unter **Kopieren**. Gruppen-Tags werden als eigene `groupIds` im Tag gespeichert; das Tag wird nicht auf Gruppeninhalte vererbt. Die Tag-Ansicht zeigt direkt getaggte Gruppen separat von direkt getaggten Playlists und Songs.

## Papierkorb, Löschen und Undo/Redo

Unter Loops liegt ein Papierkorb. Song- und Playlist-Löschen verwenden Bestätigungsdialoge und verschieben die Objekte zunächst nur in diesen lokalen Papierkorb. Der Song-Blob bleibt dabei im bestehenden Song-Store; Playlists werden per `trashedAt` ausgeblendet. Gelöschte Loops bleiben als kleine `trashedLoop`-Metadaten am Song erhalten. Alle drei Typen können einzeln wiederhergestellt werden. Erst „Papierkorb leeren“ entfernt nach erneuter Bestätigung Songs/Blobs und Playlists endgültig bzw. verwirft gelöschte Loop-Metadaten. Normale Löschaktionen werden deshalb nicht zusätzlich in den Undo-Verlauf geschrieben.

Undo/Redo bleibt für normale Bearbeitungen, Kopieren und Reihenfolgeänderungen zuständig. Löschvorgänge werden dagegen über den Papierkorb wiederhergestellt und nicht zusätzlich als Undo-Schritt geführt. Ein bestätigter Import bildet dagegen bewusst einen Undo-Schritt: direktes Undo entfernt die neu importierten Songs wieder und öffnet den Importentwurf erneut. Weitere Import-Undo-Schritte können unter anderem eine vorgemerkte Bibliotheksposition zurücknehmen.

Die sichere Metadaten-Speicherung prüft bei Undo, ob der Basis-Song noch existiert. Nur wenn er fehlt, wird der Blob aus dem Snapshot einmalig wiederhergestellt; vorhandene Blobs werden nicht überschrieben.

## Mehrfachauswahl und Playlist-Zuordnung

Bibliothek, Playlists, Importverlauf und Loops verwenden denselben Song-Auswahlmodus. Im Player-Bereich ersetzt ein großer Bibliotheks-`•••`-Knopf den früheren sichtbaren „Alle Playlists“-Knopf. Seine Funktionsliste wird nicht innerhalb des scrollbaren Players gerendert, sondern als bildschirmfestes Menü links oben – an derselben Position wie Lied- und Gruppenmenüs. Direkt unter **Auswählen** stehen **Alles aus Gruppe auswählen**, **Alles aus Playlist auswählen** und **Alles aus Tag auswählen**; danach folgt **Reihenfolge ändern**. Diese drei Funktionen öffnen kein eigenes Fenster mehr. Stattdessen wird die vorhandene Seite zum Auswahlmodus: Bei Gruppen wird die Bibliothek als Quelle gezeigt, bei Playlists beziehungsweise Tags wird direkt in der linken Liste gewählt. Ein einfacher Klick übernimmt die gewählte Gruppe/Playlist/den Tag sofort; während dieses Modus öffnet oder schließt ein Doppelklick Gruppen. Die vorherige Ansicht wird danach wiederhergestellt. **Einer Playlist hinzufügen** ersetzt nur den bisherigen Namen **Alle Playlists** und bleibt nur bei vorhandener Song-Auswahl aktiv. Im Song-Auswahlmodus steht **Kopieren** direkt über **Gruppieren**; es erzeugt echte Kopien der ausgewählten Audiodateien und fügt sie bei einer geöffneten Playlist zusätzlich dort ein.

Playlists und Tags besitzen weiterhin ihren eigenen Auswahlmodus. Der dazugehörige schwebende `•••`-Knopf liegt über der linken Playlist-/Tag-Spalte statt über der Bibliothek; sein Aktionsmenü öffnet rechts im Bildschirm. Auch normale Drei-Punkte-Menüs, die aus dieser linken Spalte gestartet werden, werden explizit am rechten Bildschirmrand positioniert. Kopieren erzeugt neue Objekte desselben Typs, Löschen verschiebt die Auswahl in den Papierkorb. Alle löschen verlangt eine Sicherheitsabfrage und entfernt die ausgewählten lokalen Dateien aus allen Playlists.

**Bewegen** steht bei mindestens zwei ausgewählten Songs direkt im Mehrfachauswahl-Menü. Beim Start wird die aktuell sichtbare Reihenfolge der betroffenen Ebene festgehalten und anschließend auf Manuell umgeschaltet. Die ausgewählten Lieder werden als zusammenhängender Block verschoben; ihre interne Reihenfolge richtet sich immer nach ihrer Position in der sichtbaren Liste: das oberste ausgewählte Lied zuerst, danach das nächsttiefere usw. Das gilt sowohl für rote Zielstriche als auch beim direkten Bewegen in eine Gruppe. Zusätzlich ist ein passender Gruppenkopf selbst ein Ziel: Ein einfacher Klick bewegt die Auswahl direkt in diese Gruppe, danach bleibt der Modus aktiv und rote Zielstriche innerhalb der Gruppe erlauben die genaue Positionierung. Ein Doppelklick auf einen Gruppenkopf öffnet oder schließt die Gruppe, ohne die Auswahl hinein zu bewegen. Liegen ausgewählte Lieder vor dem Start auf verschiedenen Ebenen oder hat ein Lied mehrere direkte Gruppenzuordnungen, wird der Block weiterhin nicht gestartet.

## Ausgewählte Lieder im Playlist-Bereich

Oberhalb des unteren Bibliotheks-`•••` steht die aktuelle Song-Auswahl. Ohne Auswahl erklärt der kurze Hinweis **„Mit ‚Auswählen‘ Dateien wählen“** den nächsten Schritt. Bei genau einem ausgewählten Lied wird dessen Name angezeigt, bei mehreren die Anzahl. Ein Tipp öffnet das Auswahlfenster mit Suche und eigener Sortierleiste.

Das `•••` dieses Auswahlfensters enthält in dieser Reihenfolge **Auswählen**, **Bewegen**, **Reihenfolge verändern (Pfeil)**, **Reihenfolge verändern (Strich)**, **Objekte hinzufügen**, **Objekte entfernen**, **Abbrechen** und **Fertig**. Innerhalb der Box ist immer höchstens ein Lied als aktives Arbeitsobjekt markiert: Ein Tipp aktiviert es, ein Tipp auf ein anderes Lied verschiebt die aktive Markierung. Die positionsbezogenen `•••`-Aktionen arbeiten anschließend nur auf diesem aktiven Lied. Das Funktionsmenü wird bildschirmfest gerendert, damit kein Dialog-Overlay seine Bedienung blockiert. Auswählen kehrt zum normalen Markieren in der Liste zurück. Objekte hinzufügen/entfernen sind vorläufige Mehrfachauswahlen und übernehmen erst mit **Fertig**. Während des normalen Auswählens stehen ebenfalls **Abbrechen** und **Fertig** dauerhaft zur Verfügung.

## Suche

Bibliothek und geöffnete Playlists besitzen eine lokale Textsuche. Ein eigener **Gruppen**-Schalter legt fest, ob neben Dateinamen auch Namen direkter oder übergeordneter Gruppen als Treffer gelten. Die Suche ist tolerant gegenüber Groß-/Kleinschreibung, Leerzeichen, Trennzeichen und einfachen unvollständigen Eingaben. Dadurch findet zum Beispiel „Miniboss“ auch „Mini Boss“. Eine aktive Suche verändert weder manuelle Reihenfolge noch Songdaten.

Auswahlfenster für Songs, Playlists, Tags und Gruppen besitzen ebenfalls eine Suchleiste und eine eigene Sortierleiste. Wo neben Objekten auch deren Gruppenzugehörigkeit sinnvoll suchbar ist, steht derselbe **Gruppen**-Schalter zur Verfügung. Dazu gehören insbesondere Playlist-/Tag-Zuordnung, „Weitere Gruppen abspielen“, „Gruppe hinzufügen/entfernen“ und „Objekte hinzufügen/entfernen“. Die oberste Sortieroption entspricht der manuellen Reihenfolge, trägt aber den Namen des aktuell aktiven Saves des jeweiligen Listentyps. Darunter stehen die automatischen Sortierungen mit Richtungspfeil. Die Auswahlfenster verändern die eigentliche Hauptsortierung nicht.

Dialoge mit eigenen Abschlussaktionen halten diese Aktionen oben im Fenster sichtbar, damit dafür nicht bis ans Listenende gescrollt werden muss. **Gruppe hinzufügen**, **Gruppe entfernen**, **Objekte hinzufügen**, **Objekte entfernen** und Playlist-Zuordnungen arbeiten vollständig als Entwurf. Mehrere Einträge können über `+` beziehungsweise `−` vorgemerkt und durch erneutes Antippen wieder zurückgenommen werden. Während dieses Fensters wird die eigentliche Gruppenstruktur nicht verändert. Nur **Fertig** übernimmt alle vorgemerkten Änderungen gemeinsam; **Abbrechen** verwirft den gesamten Entwurf. Das Fenster besitzt dafür keinen zusätzlichen Schließen-Knopf und ein Tipp außerhalb beendet es nicht. Bei **Gruppe hinzufügen** werden auch **Neue leere Gruppe** und **Einfügen** nur vorgemerkt; eine neue leere Gruppe wird bei **Fertig** als **Unbenannt** erstellt und eine kopierte Gruppe erst dann eingefügt. Die Tag-Zuordnung behält ihre Prüfung auf gleichnamige Ziele; Änderungen innerhalb dieses Fensters können bis **Fertig** gemeinsam mit **Abbrechen** auf den Zustand vor dem Öffnen zurückgesetzt werden.

## Importverlauf

Der frühere Tab „Verlauf“ heißt „Importverlauf“. Er zeigt alle aktiven Songs. Die Navigation zeigt `x/y`: x sind aktuell blau markierte neue Importe, y ist die Gesamtzahl aller aktiven Songs. Die Zahl x ist blau. In allen Songlisten werden blau markierte Songs als temporäre obere Gruppe von normalen Songs getrennt; innerhalb beider Gruppen gilt dieselbe gewählte Sortierung. Nach „Als gelesen markieren“ fällt der Song zurück in die normale Gruppe.

## Sortierung

Songlisten bieten die automatischen Modi `A–Z Anfang`, `A–Z Ende`, `Anzahl des Hörens`, `Dauer` und `Chronik`. Die frühere sichtbare Option `Manuell` wurde durch benannte **Saves** ersetzt. Bestehende manuelle Reihenfolgen werden beim Umstieg als **Save 1** weitergeführt, damit keine vorhandene Reihenfolge verloren geht.

Über **Aktuelle Sortierung speichern** kann die aktuell sichtbare Reihenfolge als neuer Save gesichert und optional benannt werden. Bleibt der Name leer, verwendet Josi die erste freie Bezeichnung `Save N`. Saves stehen in der Auswahl immer unter den automatischen Modi und werden untereinander nach Namen sortiert. Ein Save speichert die gemischte Reihenfolge aus normalen Objekten und Gruppen; beim Bearbeiten über **Reihenfolge ändern** wird der aktive Save fortgeschrieben. Für Songlisten gelten die Save-Reihenfolgen auch für den jeweiligen Bibliotheks-/Playlist-Kontext.

In der Bibliothek ist die Sortierauswahl kein natives Select mehr, sondern ein eigenes Menü: automatische Sortierungen stehen oben, Saves darunter. Dadurch kann ein Save direkt in der Sortierauswahl etwa 650 ms gedrückt gehalten werden, um ihn umzubenennen. Das frühere Sortier-`•••` neben dieser Leiste wurde entfernt; die Bibliotheksaktionen liegen gesammelt unten im Player-Bereich.

Playlists und Tags besitzen dieselbe Save-Logik in ihrem **Sortieren**-Dialog. Neben Richtungspfeil bzw. Gedankenstrich steht dort **Aktuelle Sortierung speichern**. Die Save-Daten und die aktive Auswahl liegen lokal in `localStorage`.

## Reihenfolge ändern und Sortierbünde

Im Modus **Reihenfolge ändern** werden benannte Gruppen und einzelne Objekte nicht mehr getrennt behandelt. Auf derselben Ebene können Gruppen, Lieder, Playlists oder Tags gemeinsam mit Pfeilen nach oben und unten verschoben werden. Das gilt auch innerhalb einer benannten Obergruppe und auch dann, wenn **Reihenfolge ändern** direkt im Menü dieser Gruppe gestartet wurde. Die Funktion ändert dabei niemals die Gruppenzugehörigkeit: Ein Objekt innerhalb einer Gruppe bleibt in genau dieser Gruppe, ein äußeres Objekt bleibt außerhalb und Untergruppen bleiben Kinder derselben Obergruppe. Die gemischte Reihenfolge wird lokal separat gespeichert; die bestehenden Objekt- und Gruppenreihenfolgen werden soweit möglich parallel aktualisiert.

Jeder Eintrag erhält im Bearbeitungsmodus zusätzlich ein Schloss. Offen bedeutet ungebunden. Geschlossene, direkt benachbarte Einträge bilden einen namenlosen **Sortierbund**. Ein solcher Bund kann aus normalen Objekten und benannten Gruppen bestehen. Er wird beim Verschieben als Einheit behandelt; die interne Reihenfolge bleibt dabei unverändert. Bei zwei oder mehr benachbarten geschlossenen Einträgen erscheint je Eintrag ein Kreis. Der rot markierte Kreis bestimmt den Sortieranker des Bundes für automatische Sortierungen. Ohne gewählten Anker dient der erste Eintrag als Anker.

Sortierbünde sind keine Objektgruppen: Sie haben keinen Namen, kein Gruppenmenü und können nur im Modus **Reihenfolge ändern** bearbeitet werden. Außerhalb des Modus zeigt jedes Bund-Mitglied ein kleines geschlossenes Schloss neben `•••` und eine sehr dezente helle Umrandung. Einzelne geschlossene Schlösser ohne direkt benachbartes weiteres geschlossenes Element werden beim Klick auf **Fertig** automatisch wieder geöffnet.

## Einzelobjekt-Bewegen und Erstellungsposition

Lieder, Playlists, Tags und benannte Gruppen besitzen im jeweiligen Drei-Punkte-Menü die Aktion **Bewegen**; bei Menüs mit **Kopieren** steht Bewegen direkt darüber. Die Aktion wechselt für diesen Typ auf den aktiven Save und zeigt auf derselben Hierarchieebene rote Zielstriche zwischen den sichtbaren Objekten und Gruppen. Ein einfacher Klick markiert einen Zielstrich, ein Doppelklick bestätigt. Gruppen werden dabei als ein Token verschoben; Untergruppen und direkte Inhalte bleiben intern unverändert. Objekte innerhalb einer benannten Gruppe bleiben beim Bewegen in dieser Obergruppe. Nach einer Positionierung bleibt der Bewegen-Modus aktiv und setzt nur die Zielmarkierung zurück; erst **Abbrechen** oben beendet ihn. Dadurch kann dasselbe Objekt bzw. eine bereits aktive Auswahl nacheinander an weitere Positionen gesetzt werden.

Neue leere Gruppen und aus einer Auswahl gebildete Gruppen werden normalerweise nicht sofort eingefügt. Zuerst erscheint ein Namensdialog mit **Unbenannt** als Vorgabe. Über `•••` direkt neben dem Namen kann **Bewegen** vorgemerkt werden. Ohne Bewegen wird die Gruppe bei automatischer Sortierung sofort passend einsortiert; in einem aktiven Save steht sie zunächst ganz oben. Mit Bewegen folgt nach dem Erstellen die rote Zielstrich-Auswahl. Ausnahme: Wird **Neue leere Gruppe** innerhalb von **Gruppe hinzufügen** vorgemerkt, entsteht sie erst mit **Fertig** direkt als **Unbenannt**, damit der Hinzufügen-Entwurf nicht durch einen zweiten Dialog unterbrochen wird.

Neu importierte Lieder sowie neu erstellte Playlists und Tags erhalten direkt nach ihrer Erstellung einen kompakten Namensdialog. Der Name kann sofort geändert werden; `••• → Bewegen` öffnet anschließend dieselbe Einzelobjekt-Positionierung. Bei einem Mehrfachimport werden diese Schritte nacheinander pro Lied angeboten.

## Bildschirmgrenzen für Dialoge und Menüs

Dialoge, Auswahlfenster, Drei-Punkte-Menüs, Sortiermenüs und Farbauswahlen werden auf die aktuelle Viewport-Größe inklusive Safe-Area begrenzt. Solange ihr Inhalt hineinpasst, entsteht keine zusätzliche Scrollfläche. Erst wenn Breite oder Höhe nicht ausreichen, wird innerhalb des betroffenen Kastens gescrollt.

Auch die Hauptoberfläche passt sich jetzt vor einem Überlauf an: Header, Bibliotheksaufteilung, Player und Playlist-Übersicht verwenden CSS-Variablen bzw. responsive Spalten statt nicht überschreibbarer Inline-Spalten. Auf schmalen Ansichten werden Player und Bedienelemente gestapelt oder umgebrochen. Falls ein untergeordnetes Element trotzdem breiter bleibt, besitzen Header, Player, Playlist-Übersicht sowie die beiden Bibliotheksbereiche einen horizontalen Pan-/Scroll-Fallback. Dadurch kann der Nutzer einen seitlich abgeschnittenen Bereich durch Ziehen wieder ins Bild holen.

Die linke Seitenleiste und der rechte Bibliotheksbereich besitzen zusätzlich eigenständiges vertikales Touch-Scrolling. In **Einstellungen → Seitliche Bereiche sperren** kann dieses vertikale unabhängige Scrollen deaktiviert werden; der horizontale Pan-Fallback für nicht verkleinerbare Inhalte bleibt verfügbar. Die Einstellung wird lokal gespeichert.

Der Modus **Leisten verschieben** merkt sich beim Start die aktuelle Sidebar-Breite und beide Player-Trennwerte als Ausgangszustand. Auf der Seite erscheint eine frei verschiebbare Abschlussbox mit kurzer Bedienhilfe sowie **Abbrechen** und **Fertig**. Die Box wird an ihrer oberen Leiste gezogen und innerhalb des sichtbaren Browserfensters gehalten. Beide Abschlussaktionen öffnen zuerst eine Nachfrage. **Fertig** speichert die aktuellen Werte und beendet den Bearbeitungsmodus; **Abbrechen** stellt nach Bestätigung den beim Start gemerkten Zustand wieder her. React setzt nur die drei gespeicherten Layout-Werte als CSS-Variablen; die `custom-layout`-Regeln verwenden diese Variablen mit Vorrang vor responsiven Ersatzspalten. Nur **Standard** in den Einstellungen setzt die Werte bewusst auf die persönliche Standardbasis zurück.

## Undo/Redo in Fenstern

Solange ein modales Fenster oder ein Auswahlfenster geöffnet ist, wird eine feste Undo/Redo-Leiste über dem jeweiligen Overlay angezeigt. Sie verwendet den normalen App-Verlauf; im Import-Arbeitsbereich wird zuerst dessen lokaler Entwurfsverlauf verwendet. Die Leiste liegt auch über verschachtelten Bestätigungsfenstern, damit Undo/Redo dort erreichbar bleibt.

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

## Abgeschlossene Gruppenwiedergabe

`Gruppe abspielen` erzeugt eine eigene Song-ID-Queue ausschließlich aus der gewählten Liedgruppe und ihren echten Untergruppen. Die Queue folgt der gemischten Reihenfolge aus direkten Liedern und Untergruppen innerhalb dieser Gruppe. Eine aktive Gruppenwiedergabe wird durch `groupPlaybackIds !== null` erkannt und zusätzlich synchron in `groupPlaybackIdsRef` gespiegelt. Liedwechsel lesen bei aktiver Gruppenwiedergabe direkt aus dieser abgeschlossenen ID-Liste, damit auch zwischen zwei React-Renders kein Rückfall auf Bibliothek, Playlist oder Tag-Queue möglich ist. Vor/Zurück, Shuffle und Listen-Wiederholung verwenden währenddessen ausschließlich diese Gruppenqueue.

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

Die Sortierfelder für Tags und Playlists stehen nicht dauerhaft in der Seitenleiste. Bei einem einzelnen Tag bzw. einer Playlist liegt direkt unter `Umbenennen` die Aktion `Sortieren`; sie öffnet einen kompakten Dialog mit automatischen Modi, Richtung, **Aktuelle Sortierung speichern** und den alphabetisch darunter gelisteten Saves. Beide Listen speichern ihre Auswahl separat. Die Song-Detailansicht besitzt ein eigenes `•••` mit nur songbezogenen Aktionen inklusive Tags; globale Listen-Sortierung erscheint dort nicht. `Home` schließt den Loop-Editor explizit, bevor zur Bibliothek navigiert wird, damit ein bereits aktiver Bibliotheks-Navigationseintrag den Editor nicht offen hält.


## Objektgruppen und Farbfeld

Lieder, Playlists und Tags können jeweils innerhalb ihres eigenen Typs zu persistenten Objektgruppen zusammengefasst werden. Gruppen sind reine lokale Metadaten in `localStorage` und enthalten ID, Typ, Namen, Objekt-IDs, manuelle Gruppenposition sowie eine interne Sortierung. Audiodateien, Playlist-Inhalte und Tag-Zuordnungen werden dadurch nicht dupliziert. Ein Objekt darf in mehreren Gruppen desselben Typs referenziert werden; Lieder, Playlists und Tags werden dabei niemals typübergreifend gemischt. Gruppen stehen in der jeweiligen Liste immer vor ungruppierten Objekten und werden untereinander nach der Sortierung der Gesamtliste angeordnet. Innerhalb der Gruppe kann `Allgemeine Sortierung` verwendet werden oder eine eigene Sortierung inklusive manueller Reihenfolge. Das Gruppenmenü besitzt zusätzlich Kopieren und Einfügen direkt vor `Gruppe bewegen`: Kopieren merkt sich ausschließlich die Objekt-IDs der Gruppe, Einfügen ergänzt sie nur in einer Gruppe desselben Typs und dupliziert keine Audiodateien oder Playlist-/Tag-Daten.

Die Gruppenzeile zeigt Name, Anzahl der aktuell dargestellten Objekte und deren Gesamtdauer. Gruppen für Songs können als temporäre Player-Queue abgespielt werden. Weitere Gruppenaktionen sind Umbenennen, Sortieren, Reihenfolge ändern, Gruppe bewegen, Objekte hinzufügen/entfernen und Auflösen. Playlists und Tags besitzen dafür einen eigenen Mehrfachauswahlmodus mit einem schwebenden `•••` über der linken Playlist-/Tag-Spalte.

Die Tag-Farbauswahl verwendet keine feste Palette mehr. Ein zweidimensionales Spektrum wird rein im Frontend dargestellt; ein Tippen setzt einen nicht interaktiven Zielpunkt. Erst `Fertig` übernimmt die Farbe unter diesem Punkt, `Abbrechen` verwirft sie.

Die endliche Wiederholung verwendet zusätzlich einen synchronen Restzähler in einem Ref. Dadurch liest insbesondere das native `ended`-Ereignis bei normalen, nicht geloopten Songs immer den aktuellen Wert und startet das Audio zuverlässig neu, bevor nach Erreichen von 0 zum nächsten Song gewechselt wird.


Beim Dialog `Objekte hinzufügen` wird eine Auswahl zunächst nur vorgemerkt: `+` wechselt zu `−`, ohne die Gruppe sofort zu verändern. `−` nimmt die vorgemerkte Auswahl wieder zurück. Erst `Fertig` übernimmt alle vorgemerkten Objekte gemeinsam; `Abbrechen` verwirft sie.


## Globale Loop-Aktivierung

In den Einstellungen gibt es eine gespeicherte globale Loop-Regel mit drei Zuständen: `Aktiviert`, `Deaktiviert` und `Manuell`. Ohne bestehende Einstellung startet Josi mit `Deaktiviert`. Die automatischen Zustände verändern keine Song-Metadaten: `Aktiviert` behandelt jeden Song mit gesetztem Loop bei Wiedergabe und Anzeige als aktiv, `Deaktiviert` behandelt jeden vorhandenen Loop als inaktiv. Nur `Manuell` verwendet `song.loopEnabled`.

Wenn eine einzelne Loop-Aktivierung in Song-Menü oder Detailansicht bzw. eine Mehrfachaktion auf ausgewählten Loop-Songs in einem automatischen Modus angefordert wird, fragt Josi vorab nach dem Wechsel zu `Manuell`. Bei Ablehnung wird die Aktion vollständig verworfen. Bei Zustimmung wechselt die globale Regel auf `Manuell` und schreibt erst danach die individuellen `loopEnabled`-Werte als Metadaten. Im Song-Auswahlmenü erscheinen `Alle Loops aktivieren` und `Alle Loops deaktivieren` nur dann, wenn sämtliche ausgewählten Songs einen gespeicherten Loop besitzen.


## Gruppen

Gruppen sind eine zusätzliche lokale Organisationsschicht für Songs, Playlists oder Tags. Die drei Typen werden weiterhin nicht vermischt. Gruppen speichern nur Verweise und duplizieren keine Audiodateien. Ein Objekt darf weiterhin in mehreren Gruppen desselben Typs vorkommen. Eine Gruppe speichert direkte Objekt-IDs sowie optional eine übergeordnete Gruppen-ID; dadurch können Gruppen desselben Typs ineinander verschachtelt werden.

Eine normale Gruppe entsteht weiterhin aus mindestens zwei ausgewählten Objekten und heißt zunächst **Unbenannt**. Werden mehrere direkte Objekte derselben bereits bestehenden Gruppe erneut gruppiert, wird die neue Gruppe als Untergruppe genau dieser Obergruppe angelegt. Die ausgewählten Objekte werden nur aus der direkten Ebene der Obergruppe entfernt und bleiben über die neue Untergruppe darin enthalten. Andere Gruppenzuordnungen derselben Objekte bleiben unverändert.

Untergruppen stehen standardmäßig vor den direkten Objekten ihrer Obergruppe. Über **Gruppe bewegen** kann eine Untergruppe manuell innerhalb der Gruppenreihenfolge verschoben und auch hinter die direkten Objekte gesetzt werden. Die Position relativ zu den direkten Objekten wird als optionale Gruppenmetadaten gespeichert.

Eine Gruppe darf leer sein. Leere Gruppen können direkt über das Drei-Punkte-Menü neben der jeweiligen Sortierung bzw. bei Playlists und Tags über deren Überschriftsmenü erstellt werden. Auch **Objekte entfernen** und **Alle Lieder entfernen/Alle Objekte entfernen** dürfen eine Gruppe vollständig leeren; die Gruppe und ihre Untergruppen bleiben bestehen.

Das Gruppenmenü enthält neben den bisherigen Funktionen nach „Gruppe bewegen“:
- **Gruppe gruppieren**: legt die aktuelle Gruppe in eine neu erzeugte übergeordnete Gruppe.
- **Gruppe hinzufügen**: öffnet eine Liste vorhandener passender Gruppen. Ganz oben steht **Neue leere Gruppe**, darunter **Einfügen**. Einfügen ist nur aktiv, wenn zuvor eine Gruppe desselben Typs kopiert wurde. Die kopierte Gruppe wird inklusive ihrer verschachtelten Untergruppen als neue Kopie eingefügt.
- **Gruppe entfernen**: entfernt eine verschachtelte Gruppe wieder aus ihrer übergeordneten Gruppe bzw. löst direkte Untergruppen aus der aktuellen Gruppe heraus.

„Kopieren“ im Gruppenmenü kopiert die Gruppe selbst samt Untergruppenstruktur in die Josi-Zwischenablage. Beim Einfügen werden neue Gruppen-IDs erzeugt. Kreisbeziehungen werden verhindert: Eine Gruppe kann nicht in sich selbst oder in eine eigene Untergruppe verschoben werden. Jede Gruppe hat höchstens eine übergeordnete Gruppe.

Die Darstellung erfolgt rekursiv. Untergruppen werden eingerückt unter ihrer übergeordneten Gruppe angezeigt. Die Gruppen-Kopfzeile bleibt direkt ein- und ausklappbar; der Einklappstatus wird lokal gespeichert. Objektanzahl und Dauer einer Gruppe berücksichtigen auch enthaltene Untergruppen. Die interne Gruppensortierung unterstützt weiterhin **Allgemeine Sortierung** sowie die objektspezifischen Sortiermodi.

Song-Gruppen können einzeln oder als frei zusammengestellte Gruppen-Queue abgespielt werden. **Gruppe abspielen** setzt eine abgeschlossene Queue aus dieser Gruppe inklusive Untergruppen. Shuffle, Listen-Wiederholung und das natürliche Ende beziehen sich dann ausschließlich auf diese Queue. Über das Drei-Punkte-Menü neben der Song-Sortierung öffnet **Weitere Gruppen abspielen** eine Mehrfachauswahl mit eigener Reihenfolge. Wird eine Untergruppe separat und zusätzlich über eine ausgewählte Obergruppe erreicht, wird sie bewusst erneut abgespielt; doppelte Songs werden nicht automatisch entfernt.

`Gruppe auflösen` entfernt nur die Gruppenhülle und behält die enthaltenen Objekte; direkte Untergruppen rücken auf die Ebene der aufgelösten Gruppe. Diese Aktion bleibt Teil von Undo/Redo. **Gruppe löschen** ist getrennt und destruktiv: Nach Bestätigung werden die komplette Gruppe samt Untergruppen sowie die enthaltenen Objekte in den Papierkorb verschoben. Bei Playlist-Gruppen werden die Playlists gelöscht, nicht deren Musikdateien; bei Tag-Gruppen die Tags.

Im Playlist-Auswahlmodus erscheint direkt neben dem Drei-Punkte-Menü der Überschrift **Alle auswählen**. Es markiert auch Playlists, die bereits in Gruppen oder Untergruppen liegen.

## Farbflächen, Palette und anpassbares Bibliotheks-Layout

Neben der inhaltlichen Tag-Farbe existiert eine reine Darstellungsfarbe für Songs, Playlists und Tags sowie eine optionale Farbe direkt an Objektgruppen. `Farbe ändern` steht im jeweiligen `•••` über Umbenennen (bei Playlists nach `Bild ändern`) und öffnet denselben lokalen Farbwähler. Diese Darstellungsfarben werden getrennt in `localStorage` gehalten und verändern weder Audio-Blobs noch Tag-Zuordnungen. Gruppenfarben liegen direkt im persistenten Gruppenobjekt. Die Undo/Redo-Snapshots enthalten Gruppen- und Darstellungsfarben.

Der Farbwähler kombiniert das frei antippbare Spektrum mit festen Schnellpaletten: helle Regenbogenfarben, knallige Standardfarben, dunkle Regenbogenfarben sowie Weiß, Grau und Schwarz. Derselbe Wähler wird bei der Tag-Erstellung und beim Umbenennen verwendet.

`Einstellungen → Bibliotheks-Interface → Leisten verschieben` aktiviert einen expliziten Layout-Bearbeitungsmodus. Nur in diesem Modus sind die vertikalen Trennleisten der linken Bibliotheksspalte und der drei Playerbereiche greifbar. Zusätzlich liegt eine verschiebbare Abschlussbox über der Seite. Ihre Standardposition wird lokal gespeichert und kann über **Abbrechen/Fertig verschieben** unter demselben Einstellungsbereich unabhängig vom eigentlichen Layout festgelegt werden. Auch während der Layout-Bearbeitung kann die Box an ihrer Kopfzeile aus dem Weg gezogen werden. **Abbrechen** und **Fertig** verlangen vor dem Verlassen jeweils eine Bestätigung. Abbrechen setzt das Layout auf den Zustand vor Beginn der Bearbeitung zurück, Fertig übernimmt die aktuelle Aufteilung. Außerhalb des Modus besitzen die Trennleisten keine Interaktion. Textcontainer verwenden konsequent `min-width: 0` und Ellipsen, damit Namen auch bei engen selbst gewählten Breiten nicht aus dem Layout herauslaufen.

Die Abschnitts-`•••` von Playlists und Tags enthalten zusätzlich `Sortieren`. Diese globale Sortierung verändert nicht die Liedreihenfolge innerhalb einer Playlist und überschreibt auch keine separat gewählte Gruppensortierung außer bei Gruppen im Modus `Allgemeine Sortierung`.


## Gruppenangaben in Detail- und Kartenansichten

Die nähere Songansicht zeigt zusätzlich **IN GRUPPEN**. Geöffnete Playlists und Tags zeigen ihre Gruppenzugehörigkeit direkt unter den Kopfdaten. Auch die Karten in Playlist- und Tag-Übersichten nennen die Gruppe. Bei Verschachtelungen wird der Pfad als **Obergruppe › Untergruppe** dargestellt; ohne Zuordnung steht **Keine Gruppe** beziehungsweise **In keiner Gruppe**.
