# Produktkonzept

## Grundidee

Josi ist eine lokal laufende Musik-App für das iPad. Nutzer importieren eigene Audiodateien, organisieren sie in Playlists, spielen sie ab und bearbeiten ihre Sammlung direkt auf dem Gerät.

Der Proof of Concept validiert vor allem **Importieren → organisieren → zuverlässig abspielen → präzise verwalten**.

## Kernfunktionen

- Mehrere lokale Audiodateien über den normalen Dateidialog importieren.
- Bibliothek, Importverlauf und eigener Loops-Tab.
- Neu importierte Songs blau markieren.
- Songs, Playlists und Tags über sichtbare Drei-Punkte-Menüs verwalten.
- Playlists und Tags in einklappbaren Bereichen der Seitenleiste organisieren.
- Mehrere Songs auswählen und über „Alle Playlists“ einer Playlist zuordnen.
- Songlisten nach Manuell, A–Z Anfang, A–Z Ende, Höranzahl, Dauer oder Chronik sortieren.
- Bibliothek und Playlists per einfacher Zeichenfolgen-Suche durchsuchen.
- Lieddauer anzeigen, sobald sie vom Player ermittelt wurde.
- Vollständig gehörte Wiedergaben zählen.
- Manueller, präziser Loop-Editor statt automatischer Loop-Erkennung.
- Media-Session-Integration für System-Mediensteuerung, soweit iPadOS/Safari sie bereitstellt.

## Drei-Punkte-Menü für Songs

Die Aktionen stehen in dieser Reihenfolge:

1. **Umbenennen**
2. **Kopieren**
3. **Einfügen**
4. **Tags**
5. **Teilen**
6. **Loop erstellen** bzw. **Loop bearbeiten**
7. Bei vorhandenem Loop: **Loop aktivieren** bzw. **Loop deaktivieren**
8. Nur bei blau markierten Songs in blauer Schrift: **Als gelesen markieren**
9. Nur bei blau markierten Songs in blauer Schrift: **Alle als gelesen markieren**
10. In roter Schrift: **Löschen**

„Kopieren“ legt das Objekt in die Josi-Zwischenablage; erst „Einfügen“ erstellt den zweiten Eintrag mit eigener ID. „Teilen“ öffnet nach Möglichkeit die iPad-Systemfreigabe mit der Audiodatei. „Löschen“ fragt vorher nach und entfernt den Song anschließend auch aus Playlists, ohne die Playlists selbst zu löschen.

## Drei-Punkte-Menü für Playlists

Einzelne Playlists bieten:

1. **Bild ändern**
2. **Umbenennen**
3. **Kopieren**
4. **Einfügen**
5. **Tags**
6. **Teilen**
7. **Löschen** in Rot

Eine kopierte Playlist verweist auf dieselben Songs; Audiodateien werden nicht verdoppelt. Beim Teilen wird eine Textübersicht der Playlist mit ihren Liedern an die Systemfreigabe übergeben.

Der bisherige separate Löschknopf in einer geöffneten Playlist entfällt. Die Nachfrage „wirklich löschen?“ bleibt erhalten.

Das `•••` neben der Überschrift „Playlists“ bietet **Auswählen**, **Bearbeiten** und **Übersicht**. Während der Auswahl erscheint der zusätzliche Drei-Punkte-Knopf unten rechts.

## Import und lokale Dateien

Der Import bleibt bewusst leichtgewichtig. Nur neu ausgewählte Dateien werden gespeichert; bestehende Audiodaten werden nicht bei jedem Import erneut geschrieben.

`--:--` bedeutet unbekannte Dauer. `FEHLT` bedeutet, dass der lokale Audioblob nicht mehr vorhanden ist und der Song neu importiert werden muss.

Wichtig für die Datenintegrität: Die eigentliche Audiodatei und spätere Änderungen an einem Song werden getrennt gespeichert. **Loop speichern, Umbenennen, Dauer, Hörzähler, „gelesen“ und Sortierung dürfen die Audiodatei selbst nicht erneut schreiben.** Dadurch kann eine reine Bearbeitung die importierte Datei nicht mehr durch einen erneuten Blob-Schreibvorgang beschädigen.

Dateien, die bereits vor dieser Änderung beschädigt oder leer geworden sind, können von der App nicht wiederhergestellt werden und müssen erneut importiert werden.

## Mehrfachauswahl

„Auswählen“ funktioniert in Bibliothek, Playlist, Importverlauf und Loops. Rechts neben **„Alle Playlists“** erscheint ein runder `•••`-Knopf mit **Gruppieren**, **Bewegen**, **Tags** und **Alle löschen**. Playlists und Tags erhalten einen eigenen Auswahlmodus über ihre Überschrift und ebenfalls einen Drei-Punkte-Knopf unten rechts zum Gruppieren. Tags öffnet die Tag-Auswahl für alle markierten Songs. Bewegen ist nur in Bibliothek bzw. geöffneter Playlist verfügbar und verschiebt die Auswahl als zusammenhängenden Block. Bei einer nicht-manuellen Sortierung fragt Josi, ob auf Manuell umgeschaltet werden soll; Nein bricht die Aktion ab. Alle löschen verlangt eine Sicherheitsabfrage.

## Suche

In Bibliothek und geöffneter Playlist gibt es ein Suchfeld. Es sucht nur nach der tatsächlich vorhandenen Zeichenfolge im Liednamen und ignoriert lediglich Groß-/Kleinschreibung. Es gibt bewusst keine semantischen oder unscharfen Treffer.

## Importverlauf

Der frühere „Verlauf“-Tab heißt **Importverlauf** und zeigt alle aktiven Songs. In der Navigation steht **x/y**: x ist die blau dargestellte Zahl der noch blau markierten neuen Importe, y die Gesamtzahl aller aktiven Songs. Blau markierte Songs bilden in allen Songlisten vorübergehend eine eigene obere Gruppe; normale Songs stehen darunter. Beide Gruppen werden mit derselben gewählten Sortierung sortiert. Nach „Als gelesen markieren“ verlässt ein Song die blaue Gruppe.

## Sortierung

Alle Songlisten bieten:

- **Manuell**
- **A–Z Anfang**
- **A–Z Ende**
- **Anzahl des Hörens**
- **Dauer**
- **Chronik**

Der Pfeil kehrt die Sortierung um. Die manuelle Reihenfolge bleibt separat gespeichert und wird durch andere Sortierungen nicht verändert. Über `•••` neben der Sortierung kann eine aktuelle nicht-manuelle Reihenfolge inklusive Pfeilrichtung nach Bestätigung **einmalig** als neue manuelle Reihenfolge übernommen werden. Danach bleibt sie statisch.

## Papierkorb

Unter Loops gibt es einen Papierkorb. Gelöschte Songs, Playlists, Tags und Loops landen zunächst dort und können einzeln wiederhergestellt werden. Bei Songs bleibt die lokale Audiodatei bis zum endgültigen Leeren erhalten. „Papierkorb leeren“ verlangt eine erneute Sicherheitsabfrage und entfernt die dortigen Einträge endgültig.

## Präziser Loop-Editor

`•••` → **Loop erstellen** öffnet den Schnittplatz als feste Vollbildansicht. Das Interface orientiert sich direkt an der vom Nutzer gezeichneten Skizze.

Oben stehen Zurück/Vor und Editor-Undo/Redo. Zoom ist eine Auswahlliste von **1× bis 15×**. Die Cursor-Geschwindigkeit bietet **5%, 10%, 25%, 50%, 75%, 100%, 150%, 200%, 500%, 1000% und 5000%**. **Fokus folgt Cursor** hat drei Zustände: zentriert folgen, seitenweise weiterblättern oder aus. Loop-Kasten, Cursor-Loop und Markierungen werden mit Schaltern gesteuert. Erläuterungen aus der Skizze, die in Klammern standen, werden nicht als zusätzlicher Text angezeigt.

Die Zeitachse verwendet die bestehende Amplituden-Wellenform und vier klare Farbfamilien: Loop leicht rot, Cursor leicht blau, Fokus leicht grün und Markierungen leicht orange. Direkt an den jeweiligen Strichen werden ihre aktuellen Zeiten angezeigt; diese Zahlen sind reine Anzeigen und nicht bedienbar. Der Cursor wird weiterhin nur am blauen Punkt verschoben.

Unter der Zeitachse stehen **Fokus**, **Cursor** und **Loop** in einer kompakten Reihe; der Loop-Block liegt rechts neben Fokus und Cursor. Die Markierungen liegen darunter. Direkt hinter jedem Wort „Standort“ steht die aktuelle Position bis auf Millisekunden. Die bisherigen freien Zahleneingaben sind durch kleine Schritt-Auswahllisten ersetzt. Beim Cursor sind zusätzlich 30 s und 60 s auswählbar. Auch die Vorlaufwerte werden ausgewählt und bedeuten immer nur „x Sekunden vor Start“ bzw. „x Sekunden vor Ende“.

Markierungen heißen A, B, C usw. Oberhalb von „Alle Markierungen löschen“ steht ein eigener **Markierung setzen**-Knopf. Das `•••` enthält „Cursor hinbewegen“, „Zoom hinbewegen“, „Loop-Anfang hinbewegen“, „Loop-Ende hinbewegen“ und „Markierung löschen“.

Loop-Kasten sperren, Cursor-Loop, Marker an/aus, Fokus-Modus, Zoom und Geschwindigkeit verändern nur den Editorzustand. **Loop speichern** schreibt weiterhin nur Metadaten und niemals den Audio-Blob. Vor **Loop speichern**, **Loop löschen** und **Alle Markierungen löschen** erscheint jeweils eine Sicherheitsabfrage.

Der Editor besitzt eine eigene Scrollfläche und die App verwendet keinen selbst gebauten Pull-to-Refresh mehr. Nach oben oder unten scrollen darf deshalb keinen App-Reload auslösen.

## Wiederholen: Liste oder ausgewählte Songs

Kurzer Druck auf den Wiederholen-Knopf schaltet die normale Listenwiederholung. **Langdruck ist hier bewusst die einzige Ausnahme zur sonst abgeschafften Langdruck-Bedienung:** Er öffnet eine Box mit `∞` oder einer frei eingebbaren Wiederholungszahl. `∞` bzw. die verbleibende Zahl wird neben dem Wiederholen-Symbol gezeigt. Bei einem aktiven Loop zählt die Zahl bei jedem Loop-Durchlauf herunter; bei 0 läuft das Lied ohne weiteren Loop weiter und kann danach zum nächsten Song wechseln. Ohne aktiven Loop zählt die Zahl vollständige Song-Wiederholungen.

## Wiedergabe nach Loop-Bearbeitung

Das Speichern oder Umschalten eines Loops darf die zugrunde liegende Audiodatei weder neu laden noch neu in IndexedDB schreiben. Die Audioquelle wird nur dann neu erzeugt, wenn sich der ausgewählte Song oder dessen tatsächlicher Datei-Blob ändert.

Änderungen wie Loop speichern, Loop an/aus, Marker, Dauer oder Umbenennen verändern nur Metadaten. Dadurch bleibt die importierte Datei geschützt. Für den eigentlichen Übergang versucht Josi eine kurze Doppelwiedergabe: Kurz vor dem Loop-Ende beginnt ein zweiter unsichtbarer Wiedergabekanal bereits am Loop-Anfang, sodass Ende und Anfang ungefähr 0,18 Sekunden überlappen. Wenn Lautstärkesteuerung unterstützt wird, werden beide Kanäle gegeneinander überblendet. Scheitert der zweite Kanal technisch, sucht Josi lokal in einem kleinen Bereich um die gesetzten Grenzen nach einem möglichst ähnlichen Signal-Verbindungspunkt. Dieser Fallback verändert die gespeicherten Loop-Punkte nicht und kann musikalisch falsch liegen.

## Teilen

Songs werden, soweit die Web Share API und iPadOS es erlauben, als tatsächliche Audiodatei geteilt. Wenn der Browser Dateifreigabe nicht unterstützt, zeigt Josi eine verständliche Meldung statt still zu scheitern.

Playlists sind keine einzelne Datei. Deshalb teilt Josi bei Playlists eine Textübersicht mit Playlistname und Liedliste.

## Navigation und Bearbeitungsverlauf

Ganz links stehen **Home** und **Einstellungen**, danach Zurück/Vor sowie Undo/Redo. Home öffnet von jedem Tab direkt die Bibliothek. Die Einstellungen sind zunächst ein Prototyp für die Spulweite (5/10/15/30/60 Sekunden) und erklären den automatischen Loop-Übergang. Im Hauptplayer liegt Play/Pause ganz innen; daneben stehen Spulen, dann Liedwechsel und ganz außen Shuffle bzw. Wiederholen. In der näheren Song-Ansicht sitzen Shuffle und Wiederholen außen um die bisherigen Transportknöpfe; Langdruck auf Wiederholen öffnet dort ebenfalls `∞` oder eine frei wählbare Wiederholungszahl.

## Abgrenzung

Noch nicht Teil der aktuellen Version:

- Cloud-Synchronisierung oder Backend,
- Nutzerkonten im Produktablauf,
- automatische Metadaten-/Cover-Erkennung,
- Musik-Streaming,
- automatische Loop-Erkennung,
- Frequenz-Spektrogramm,
- Crossfade/Fading zwischen unterschiedlichen Liedern,
- native iOS-Hintergrund-Audio-Berechtigungen außerhalb der Möglichkeiten einer PWA.

Der experimentelle Ordnerimport bleibt entfernt.

## Offene Annahmen

- Die lokale Browser-Speicherkapazität reicht für einen realistischen Test.
- Systemfreigabe von Audiodateien funktioniert auf den tatsächlich verwendeten iPadOS-/Safari-Versionen ausreichend zuverlässig.
- Die klassische Amplituden-Wellenform ist auf realen Musikdateien schnell genug berechenbar und hilft bei der Loop-Auswahl.
- Die vergrößerten Trefferflächen und die getrennte Fokus-Leiste machen den Editor auf Touch-Geräten zuverlässiger bedienbar.
- Die getrennte Speicherung von Audiodatei und Metadaten verhindert, dass reine Bearbeitungsschritte bestehende Audiodaten erneut schreiben.
- Für eine spätere Produktversion müssen Backup, Speichergrenzen, Wiederherstellung verlorener Audiodaten und eventuell eine native App-Hülle geprüft werden.


## Tags und Einfügen

Tags sind eine zweite Organisationsschicht neben Playlists. Jeder Tag hat einen farbigen Punkt und kann beliebig viele Songs und Playlists enthalten; Tags selbst gehören nie zu Playlists. Beim Erstellen und Umbenennen wird die Farbe über ein frei antippbares Farbspektrum gewählt. Ein nicht greifbarer Punkt zeigt die Auswahl; erst **Fertig** übernimmt sie. In normalen Songzeilen werden aus Platzgründen nur die Punkte angezeigt. In der näheren Songansicht stehen Punkt und Tagname zusammen.

Der Tags-Bereich und der Playlists-Bereich lassen sich durch Antippen ihrer freien Überschrift ein- und ausklappen. Die Sortiersteuerung steht nicht dauerhaft unter der Überschrift, sondern im `•••` des jeweiligen Tags bzw. der Playlist als **Sortieren** direkt unter **Umbenennen**. Tags und Playlists speichern ihren Sortiermodus und die Richtung getrennt. Für Tags stehen Manuell, A–Z Anfang, A–Z Ende, summierte Höranzahl, Anzahl der Lieder und Chronik bereit; Playlists verwenden dieselben passenden Kriterien.

Beim Taggen oder Einfügen eines Objekts mit einem Namen, der am Ziel bereits vorkommt, fragt Josi nach `Ersetzen`, `Beide einfügen` oder `Abbrechen`. Nach Abbrechen kann der Redo-Pfeil denselben Versuch wiederholen und öffnet die Konfliktfrage erneut.


## Detailansicht und kleine Bedienkorrekturen

Die nähere Songansicht besitzt ein eigenes `•••` mit songbezogenen Aktionen wie Umbenennen, Kopieren/Einfügen, Tags, Teilen und Loop-Funktionen. Listenweite Aktionen wie das Sortieren von Tags oder Playlists werden dort bewusst nicht gezeigt. In der Tag-Zuordnung bedeutet `+` hinzufügen und `−` entfernen; eine teilweise Mehrfachzuordnung bleibt als `±` sichtbar. Home schließt auch aus dem Loop-Editor zuverlässig den Editor und öffnet die Bibliothek.


## Gruppen

Mehrere ausgewählte Lieder, Playlists oder Tags können über `••• → Gruppieren` zu einer eigenen Gruppe zusammengefasst werden. Die drei Typen werden nie vermischt. Ein Objekt darf in mehreren Gruppen desselben Typs vorkommen; Gruppen speichern dabei nur Verweise und duplizieren keine Audiodateien. Neue Gruppen heißen zunächst **Unbenannt**. Gruppen stehen vor allen ungruppierten Objekten; untereinander folgen sie der Sortierung der Gesamtliste.

Die fast weiße Gruppenzeile zeigt Gruppenname, Objektanzahl und Gesamtdauer. Die enthaltenen Objekte liegen auf einem hellgrauen Hintergrund. Das `•••` der Gruppe bietet bei Liedern **Gruppe abspielen** sowie für alle Typen **Gruppe umbenennen**, **Sortieren**, **Reihenfolge ändern**, **Kopieren**, **Einfügen**, **Gruppe bewegen**, **Objekte hinzufügen**, **Objekte entfernen** und **Gruppe auflösen**. Kopieren/Einfügen überträgt ausschließlich Gruppeninhalte zwischen Gruppen desselben Typs; Lied-, Playlist- und Taggruppen können nicht ineinander eingefügt werden. Die interne Sortierung besitzt zusätzlich **Allgemeine Sortierung**, wodurch die Gruppe automatisch die Sortierung der gesamten Liste übernimmt.

Playlists und Tags erhalten über das `•••` ihrer Überschrift einen Auswahlmodus. Während dieser Auswahl erscheint wie bei Liedern ein eigener Drei-Punkte-Knopf unten rechts, über den gruppiert werden kann.

## Freie Tag-Farbe

Die frühere Palette entfällt. Der Farbkreis öffnet ein großes Spektrum mit praktisch allen Farbtönen von hell bis dunkel. Ein Tippen setzt einen rein visuellen, nicht greifbaren Punkt. **Fertig** übernimmt die Farbe unter dem Punkt in den Kreis; **Abbrechen** verwirft die Auswahl.

## Endliche Wiederholung ohne Loop

Die eingegebene Wiederholungszahl zählt auch bei unbearbeiteten Liedern zuverlässig pro vollständigem Durchlauf herunter. Solange der Restwert größer als 0 ist, startet dasselbe Lied erneut. Erst bei 0 wird zum nächsten Lied gewechselt. Für gespeicherte Loops bleibt dasselbe Prinzip pro Loop-Durchlauf bestehen.


Bei **Objekte hinzufügen** ist die Auswahl vorläufig: Ein `+` wird nach dem Antippen zu `−`, sodass die Wahl vor dem Speichern zurückgenommen werden kann. Erst **Fertig** fügt die vorgemerkten Objekte hinzu; **Abbrechen** lässt die Gruppe unverändert.


## Globale Loop-Regel

In **Einstellungen → Loops** stehen drei Optionen: **Aktiviert**, **Deaktiviert** und **Manuell**. Standard ist **Deaktiviert**. Aktiviert/Deaktiviert gelten automatisch für alle Lieder mit vorhandenem Loop, ohne deren individuelle Schalter umzuschreiben. **Manuell** verwendet wieder die pro Lied gespeicherte Aktivierung.

Versucht man in einem automatischen Modus einen einzelnen Loop in der näheren Songansicht oder im `•••` umzuschalten, fragt Josi zuerst, ob auf **Manuell** gewechselt werden soll. **Nein** bricht die Änderung ab. Dasselbe gilt bei Mehrfachauswahl. Wenn ausschließlich Songs mit vorhandenen Loops ausgewählt sind, stehen im Auswahl-`•••` direkt über **Alle löschen** die Aktionen **Alle Loops aktivieren** und **Alle Loops deaktivieren**.


## Gruppen einklappen und wiederherstellen

Die fast weiße Kopfzeile einer Gruppe kann direkt angetippt werden. Dadurch werden alle Objekte der Gruppe eingeklappt, sodass nur Name, Anzahl, Dauer und `•••` sichtbar bleiben. Ein weiterer Klick fährt die Gruppe wieder aus. Die Bedienelemente innerhalb der Kopfzeile lösen das Einklappen nicht versehentlich aus. Dieses Verhalten gilt für Lieder sowie für Playlist- und Taggruppen direkt in der linken Spalte.

**Gruppe auflösen** ist Teil des normalen Undo/Redo-Verlaufs. Direkt nach dem Auflösen stellt Undo dieselbe Gruppe mit ihren bisherigen Inhalten und Einstellungen wieder her; Redo löst sie erneut auf.
