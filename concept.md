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

Das `•••` neben der Überschrift „Playlists“ bietet **Auswählen**, **Reihenfolge ändern** und **Übersicht**. Während der Auswahl erscheint der zusätzliche Drei-Punkte-Knopf über der linken Playlist-/Tag-Spalte; seine Funktionsliste öffnet rechts im Bildschirm.

## Import und lokale Dateien

Der Import bleibt bewusst leichtgewichtig. Nur neu ausgewählte Dateien werden gespeichert; bestehende Audiodaten werden nicht bei jedem Import erneut geschrieben.

`--:--` bedeutet unbekannte Dauer. `FEHLT` bedeutet, dass der lokale Audioblob nicht mehr vorhanden ist und der Song neu importiert werden muss.

Wichtig für die Datenintegrität: Die eigentliche Audiodatei und spätere Änderungen an einem Song werden getrennt gespeichert. **Loop speichern, Umbenennen, Dauer, Hörzähler, „gelesen“ und Sortierung dürfen die Audiodatei selbst nicht erneut schreiben.** Dadurch kann eine reine Bearbeitung die importierte Datei nicht mehr durch einen erneuten Blob-Schreibvorgang beschädigen.

Dateien, die bereits vor dieser Änderung beschädigt oder leer geworden sind, können von der App nicht wiederhergestellt werden und müssen erneut importiert werden.

## Mehrfachauswahl

„Auswählen“ funktioniert in Bibliothek, Playlist, Importverlauf und Loops. Die Auswahl kann außerdem direkt aus einer **Gruppe**, **Playlist** oder einem **Tag** übernommen werden. Dazu stehen unter **Auswählen** die drei Aktionen **Alles aus Gruppe auswählen**, **Alles aus Playlist auswählen** und **Alles aus Tag auswählen**. Eine Quelle wird erst mit **Fertig** übernommen; dabei werden alle noch vorhandenen Lieder dieser Quelle markiert, auch wenn sie in der momentan geöffneten Liste nicht sichtbar sind.

Playlists und Tags erhalten weiterhin ihren eigenen Auswahlmodus. Der schwebende Auswahlknopf liegt über der linken Playlist-/Tag-Spalte; Aktionslisten von dort öffnen auf der rechten Bildschirmseite und verdecken dadurch nicht die linke Navigation.

Eine Song-Auswahl kann als Block bewegt werden. Dabei wird die betroffene Ebene automatisch auf **Manuell** gestellt, die relative Reihenfolge der ausgewählten Lieder bleibt erhalten und rote Zielstriche zeigen die möglichen Positionen. Der Block darf keine Gruppengrenze überschreiten: Liegen die ausgewählten Lieder auf unterschiedlichen Ebenen, wird der gemeinsame Strich nicht gestartet. Alle löschen verlangt weiterhin eine Sicherheitsabfrage.

## Suche

In Bibliothek und geöffneter Playlist gibt es ein Suchfeld. Die Suche toleriert Groß-/Kleinschreibung, Leerzeichen, Trennzeichen und einfache unvollständige Eingaben. „Miniboss“ findet deshalb auch „Mini Boss“.

Auch Auswahlfenster für Lieder, Playlists, Tags und Gruppen besitzen eine Suchleiste. Die Ergebnisse bleiben soweit möglich in derselben Sortierung wie die entsprechende Hauptliste.

## Importverlauf

Der frühere „Verlauf“-Tab heißt **Importverlauf** und zeigt alle aktiven Songs. In der Navigation steht **x/y**: x ist die blau dargestellte Zahl der noch blau markierten neuen Importe, y die Gesamtzahl aller aktiven Songs. Blau markierte Songs bilden in allen Songlisten vorübergehend eine eigene obere Gruppe; normale Songs stehen darunter. Beide Gruppen werden mit derselben gewählten Sortierung sortiert. Nach „Als gelesen markieren“ verlässt ein Song die blaue Gruppe.

## Import vor dem Speichern bearbeiten

Werden über **Musik importieren** mehrere Dateien gewählt, erscheinen sie zunächst gemeinsam in einem Importfenster und sind noch nicht gespeichert. Die erste Datei steht in der manuellen Reihenfolge ganz oben, danach folgen die weiteren Dateien in der Auswahlreihenfolge. Im `•••` dieses Fensters stehen **Auswählen**, **Umbenennen**, **Reihenfolge ändern** und **Bewegen**.

Bei **Bewegen** ist zunächst keine Datei markiert. Neben **Alles auswählen** steht **Nichts auswählen**. Nach der ersten Bestätigung erscheint ein eigenes Fenster nur mit der gewählten Teilmenge; dort kann man Dateien wieder herausnehmen und ihre interne Reihenfolge mit Pfeilen ändern. Die nächste Bestätigung zeigt die Bibliothek mit roten Zielstrichen. **Zurück** führt in die vorherige Stufe, **Bestätigen** übernimmt die Stufe und **Abbrechen** öffnet in jeder Stufe die Bestätigung zum Abbruch des gesamten Imports. Erst beim abschließenden Import wird die vorgemerkte Position gespeichert.

**Fertig** und **Abbrechen** schließen den Import niemals sofort, sondern verlangen eine Bestätigung. Nur bestätigtes Fertig speichert die Dateien. Bestätigtes Abbrechen importiert nichts. Undo/Redo ist auch hier verfügbar: Undo nach einem abgeschlossenen Import entfernt den Import wieder und öffnet den Entwurf erneut; weitere Undo-Schritte können die Bearbeitung dieses Entwurfs zurücknehmen.

## Bibliotheksaktionen unten

Der frühere sichtbare Knopf **Alle Playlists** wird im Player-Bereich durch einen großen `•••`-Knopf ersetzt. Im Menü stehen **Auswählen**, danach **Alles aus Gruppe auswählen**, **Alles aus Playlist auswählen**, **Alles aus Tag auswählen** und anschließend **Reihenfolge ändern**. Danach folgen die übrigen Bibliotheksaktionen; **Alle Playlists** ist nur bei vorhandener Song-Auswahl aktiv.

Direkt über diesem Knopf zeigt Josi die aktuelle Auswahl. Ohne Auswahl steht dort kurz **„Mit ‚Auswählen‘ Dateien wählen“**. Bei einem oder mehreren ausgewählten Liedern öffnet ein Tipp die Auswahlbox. Ihr `•••` enthält **Auswählen**, **Bewegen**, **Reihenfolge verändern (Pfeil)**, **Reihenfolge verändern (Strich)**, **Objekte hinzufügen**, **Objekte entfernen**, **Abbrechen** und **Fertig**. Hinzufügen und Entfernen sind Entwürfe; erst **Fertig** übernimmt die vorgemerkten Änderungen. Die Auswahlbox selbst sowie der normale Auswahlmodus besitzen ebenfalls **Abbrechen** und **Fertig**. Der Pfeil-Reihenfolge-Modus zeigt diese beiden Abschlüsse ebenfalls dauerhaft.

## Sortierung

Die automatischen Sortierungen bleiben **A–Z Anfang**, **A–Z Ende**, **Anzahl des Hörens**, **Dauer** und **Chronik**. Die frühere Auswahl **Manuell** wird durch benannte **Saves** ersetzt. Eine bestehende manuelle Reihenfolge bleibt als **Save 1** erhalten.

Über **Aktuelle Sortierung speichern** lässt sich die sichtbare Reihenfolge sichern. Der Save kann benannt werden; ohne Eingabe verwendet Josi die erste freie Nummer wie **Save 1**, **Save 2** usw. Automatische Sortierungen stehen zuerst, alle Saves darunter alphabetisch. Wird ein Save ausgewählt und anschließend über **Reihenfolge ändern** bearbeitet, bleibt diese neue Reihenfolge in diesem Save erhalten. In der Bibliothek werden Saves direkt in der Sortierauswahl angezeigt; dort öffnet Langdruck auf einen Save das Fenster zum Umbenennen.

Playlists und Tags erhalten dieselbe Funktion in **Sortieren**. Dort steht **Aktuelle Sortierung speichern** direkt neben den Sortier-Steuerelementen.

Auswahlfenster wie **Gruppe hinzufügen**, **Gruppe entfernen**, **Objekte hinzufügen**, Playlist-/Tag-Auswahl und **Weitere Gruppen abspielen** besitzen eine eigene Sortierleiste. Ganz oben steht die manuelle Option unter dem Namen des aktuell aktiven Saves der betreffenden Liste. Die anderen Sortiermodi folgen darunter; diese Auswahl verändert die Sortierung der Hauptliste nicht.

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


## Bildschirmfeste Bedienelemente

Menüs und Dialoge dürfen nicht aus dem sichtbaren Bildschirm hinausragen. Drei-Punkte-Menüs aus der linken Playlist-/Tag-Spalte öffnen ihre Funktionsliste rechts im Bildschirm; der schwebende Playlist-/Tag-Auswahlknopf selbst bleibt über der linken Spalte. Der frei eingestellte Bibliotheks-/Player-Schnitt bleibt auch nach **Layout fertig** bestehen; dieser Knopf speichert die aktuellen Werte und beendet nur die Bearbeitung. Die fertige Ansicht verwendet dieselben Nutzer-Spalten mit Vorrang vor responsiven Ersatzspalten, sodass sich das Layout beim Beenden optisch nicht zurückstellt. Ein Rücksprung zur persönlichen Standardbasis erfolgt ausschließlich über **Standard** in den Einstellungen. Linker Seitenbereich und Bibliotheksbereich können unabhängig vertikal gescrollt werden; **Seitliche Bereiche sperren** schaltet dieses vertikale Scrollen ab, nicht den horizontalen Notfall-Pan.

## Reihenfolge ändern und Sortierbünde

Bei Playlists und Tags heißt die bisherige Aktion **Bearbeiten** jetzt **Reihenfolge ändern**. In diesem Modus können benannte Gruppen und einzelne Lieder, Playlists oder Tags auf derselben Ebene gemeinsam nach oben oder unten verschoben werden, auch innerhalb einer Obergruppe. Dasselbe gilt für **Reihenfolge ändern** direkt in einer Gruppe: Direkte Objekte und direkte Untergruppen können unabhängig gegeneinander verschoben werden. Dabei wird niemals die Ebene gewechselt; ein Objekt kann so weder aus seiner Gruppe heraus noch von außen in eine Gruppe hinein verschoben werden.

Neben den Pfeilen hat jeder Eintrag ein Schloss. Standardmäßig ist es offen. Wird es geschlossen, erscheint es rot. Zwei oder mehr direkt benachbarte geschlossene Einträge bilden einen namenlosen Sortierbund. Der Bund wird beim Verschieben zusammen bewegt, ohne seine interne Reihenfolge zu verändern. Bei einem gültigen Bund erscheint zusätzlich ein weißer Kreis je Eintrag; der ausgewählte Kreis wird rot und legt fest, nach welchem Eintrag der Bund bei automatischer Sortierung eingeordnet wird.

Sortierbünde existieren nur als Sortierhilfe und können nur in **Reihenfolge ändern** bearbeitet werden. Außerhalb dieses Modus bleibt ein kleines geschlossenes Schloss neben `•••` sichtbar und die Mitglieder erhalten eine sehr dezente helle Umrandung. Ein einzelnes geschlossenes Schloss ohne direkt benachbarten Partner wird beim Beenden des Modus automatisch aufgehoben.

## Einzelnes Bewegen und neue Objekte

**Bewegen** steht im Drei-Punkte-Menü und bei Menüs mit **Kopieren** direkt darüber. Nach **Bewegen** erscheinen rote Zielstriche bzw. Zielpositionen der betreffenden Ebene. Eine Positionierung beendet den Modus nicht mehr automatisch; erst **Abbrechen** beendet ihn. Beim Import wird die Bewegung zusätzlich in Auswahl, Prüf-Fenster und Bibliotheks-Zielposition aufgeteilt. Dadurch können Objekte oder eine bereits aktive Auswahl wiederholt neu positioniert werden. Eine Gruppe nimmt ihre Untergruppen und Inhalte unverändert mit; ein Objekt innerhalb einer Gruppe bleibt in dieser Obergruppe. Im Importfenster kann **Auswählen** die zu bewegende Dateimenge auf einzelne neue Lieder begrenzen.

Vor dem Erstellen einer neuen Gruppe erscheint normalerweise ein Namensfeld mit **Unbenannt**. Über die drei Punkte daneben kann schon **Bewegen** ausgewählt werden. In einem Save landet eine neue Gruppe ohne diese Option zuerst ganz oben; bei automatischer Sortierung wird sie direkt passend einsortiert. Die vorgemerkte **Neue leere Gruppe** in **Gruppe hinzufügen** ist die Ausnahme: Sie wird erst mit **Fertig** direkt als **Unbenannt** erstellt, ohne einen zweiten Dialog zu öffnen.

Neue Playlists und Tags sowie frisch importierte Lieder können unmittelbar nach der Erstellung umbenannt und über `••• → Bewegen` positioniert werden. Mehrere importierte Lieder werden dabei nacheinander bearbeitet.

## Gruppen

Mehrere ausgewählte Lieder, Playlists oder Tags können weiterhin über **Gruppieren** zu einer Gruppe zusammengefasst werden. Neue Auswahlgruppen heißen zunächst **Unbenannt**. Songs, Playlists und Tags werden nie miteinander vermischt; ein Objekt darf aber weiterhin in mehreren Gruppen desselben Typs vorkommen. Gruppen speichern nur Verweise und verdoppeln keine Audiodateien.

Bereits gruppierte Objekte können erneut gruppiert werden. Wenn die ausgewählten Objekte direkt in derselben Gruppe liegen, entsteht daraus eine Untergruppe innerhalb dieser Gruppe. Die Objekte bleiben damit in ihrer bisherigen Obergruppe, statt auf die oberste Ebene verschoben zu werden. Andere vorhandene Gruppenzuordnungen bleiben bestehen.

Untergruppen stehen standardmäßig oberhalb der direkten Lieder, Playlists oder Tags ihrer Obergruppe. Mit **Gruppe bewegen** kann eine Untergruppe manuell verschoben und auch unter die direkten Objekte gesetzt werden.

Im Drei-Punkte-Menü einer Gruppe stehen nach **Gruppe bewegen**:
1. **Gruppe gruppieren** – erstellt eine neue übergeordnete Gruppe und legt die aktuelle Gruppe hinein.
2. **Gruppe hinzufügen** – zeigt passende vorhandene Gruppen. Ganz oben stehen weiterhin **Neue leere Gruppe** und **Einfügen**. Alle `+`-Auswahlen sind zunächst nur vorgemerkt; auch eine neue leere Gruppe oder eine kopierte Gruppe wird erst mit **Fertig** tatsächlich hinzugefügt. Eine neue leere Gruppe erhält dabei zunächst den Namen **Unbenannt**.
3. **Gruppe entfernen** – zeigt die aktuelle Untergruppenstruktur mit `−`. Mehrere Untergruppen beziehungsweise die aktuelle Gruppe selbst können vorgemerkt werden; entfernt wird erst mit **Fertig**.

Leere Gruppen können direkt erstellt werden und bleiben auch leer bestehen. **Alle Lieder entfernen** beziehungsweise **Alle Objekte entfernen** leert die ausgewählte Gruppe inklusive ihrer Untergruppen, löscht aber keine Gruppenhülle. Eine Gruppe verschwindet nur über **Gruppe auflösen** oder **Gruppe löschen**.

**Gruppe auflösen** behält die enthaltenen Objekte und verschiebt Untergruppen eine Ebene nach oben. **Gruppe löschen** steht direkt darunter und verlangt eine Bestätigung. Danach werden die Gruppe, ihre Untergruppen und die enthaltenen Objekte in den Papierkorb verschoben. Bei Playlist-Gruppen bleiben die Musikdateien der Playlists erhalten.

Bei Liedgruppen gilt **Gruppe abspielen** als strikt abgeschlossene Wiedergabe: Nur direkte Lieder dieser Gruppe und Lieder ihrer echten Untergruppen bilden die Queue. Dateien außerhalb dieses Teilbaums dürfen auch am Listenende nicht als Fallback erscheinen. Shuffle, Vor/Zurück und Listen-Wiederholung arbeiten ausschließlich innerhalb dieser Gruppenqueue. Über **Weitere Gruppen abspielen** direkt unter **Leere Gruppe erstellen** im Drei-Punkte-Menü neben der Sortierung können mehrere Gruppen ausgewählt und in eine eigene Reihenfolge gebracht werden. Eine Untergruppe darf dabei zusätzlich separat ausgewählt sein; sie wird dann zuerst separat und später innerhalb ihrer Obergruppe erneut abgespielt.

Im Playlist-Auswahlmodus steht neben dem Drei-Punkte-Knopf der Überschrift **Alle auswählen**. Dabei werden auch Playlists markiert, die bereits in Gruppen oder Untergruppen liegen.

## Gruppen und Playlists direkt taggen

Bei einer Playlist und bei einer benannten Gruppe steht **Tags** direkt unter **Kopieren**. Mehrere ausgewählte Playlists können ebenfalls gemeinsam getaggt werden; die Song-Mehrfachauswahl behält ihre bestehende Tag-Aktion. Ein Gruppen-Tag gehört ausschließlich zur Gruppe selbst. Die darin enthaltenen Lieder, Playlists, Tags oder Untergruppen erhalten dieses Tag nicht automatisch.

## Freie Tag-Farbe

Die frühere Palette entfällt. Der Farbkreis öffnet ein großes Spektrum mit praktisch allen Farbtönen von hell bis dunkel. Ein Tippen setzt einen rein visuellen, nicht greifbaren Punkt. **Fertig** übernimmt die Farbe unter dem Punkt in den Kreis; **Abbrechen** verwirft die Auswahl.

## Endliche Wiederholung ohne Loop

Die eingegebene Wiederholungszahl zählt auch bei unbearbeiteten Liedern zuverlässig pro vollständigem Durchlauf herunter. Solange der Restwert größer als 0 ist, startet dasselbe Lied erneut. Erst bei 0 wird zum nächsten Lied gewechselt. Für gespeicherte Loops bleibt dasselbe Prinzip pro Loop-Durchlauf bestehen.


Bei **Objekte hinzufügen**, **Objekte entfernen**, **Gruppe hinzufügen** und **Gruppe entfernen** ist die gesamte Auswahl vorläufig. Mehrere Einträge können nacheinander mit `+` oder `−` markiert und vor dem Abschluss wieder zurückgenommen werden. **Abbrechen** verwirft den gesamten Entwurf, **Fertig** übernimmt ihn gesammelt und schließt danach das Fenster. Diese beiden Schaltflächen sind die einzigen Abschlussmöglichkeiten; weder ein zusätzlicher Schließen-Knopf noch ein Tipp außerhalb des Fensters beendet den Vorgang.


## Globale Loop-Regel

In **Einstellungen → Loops** stehen drei Optionen: **Aktiviert**, **Deaktiviert** und **Manuell**. Standard ist **Deaktiviert**. Aktiviert/Deaktiviert gelten automatisch für alle Lieder mit vorhandenem Loop, ohne deren individuelle Schalter umzuschreiben. **Manuell** verwendet wieder die pro Lied gespeicherte Aktivierung.

Versucht man in einem automatischen Modus einen einzelnen Loop in der näheren Songansicht oder im `•••` umzuschalten, fragt Josi zuerst, ob auf **Manuell** gewechselt werden soll. **Nein** bricht die Änderung ab. Dasselbe gilt bei Mehrfachauswahl. Wenn ausschließlich Songs mit vorhandenen Loops ausgewählt sind, stehen im Auswahl-`•••` direkt über **Alle löschen** die Aktionen **Alle Loops aktivieren** und **Alle Loops deaktivieren**.


## Gruppen einklappen und wiederherstellen

Die fast weiße Kopfzeile einer Gruppe kann direkt angetippt werden. Dadurch werden alle Objekte der Gruppe eingeklappt, sodass nur Name, Anzahl, Dauer und `•••` sichtbar bleiben. Ein weiterer Klick fährt die Gruppe wieder aus. Die Bedienelemente innerhalb der Kopfzeile lösen das Einklappen nicht versehentlich aus. Dieses Verhalten gilt für Lieder sowie für Playlist- und Taggruppen direkt in der linken Spalte.

**Gruppe auflösen** ist Teil des normalen Undo/Redo-Verlaufs. Direkt nach dem Auflösen stellt Undo dieselbe Gruppe mit ihren bisherigen Inhalten und Einstellungen wieder her; Redo löst sie erneut auf.


## Farben und Bibliotheks-Layout

Songs, Playlists, Tags und Gruppen besitzen im `•••` die Aktion **Farbe ändern**. Bei Gruppen färbt sie die fast weiße Kopfzeile; bei einzelnen Objekten die sichtbare Objektfläche. Die eigentliche Tag-Farbe des bunten Punkts bleibt davon getrennt.

Der Farbwähler zeigt weiterhin das freie Spektrum und darunter feste Farbknöpfe für **Hell**, **Knallig**, **Dunkel** sowie **Weiß, Grau und Schwarz**. Diese Schnellpalette steht ebenfalls beim Erstellen und Umbenennen von Tags bereit.

In **Einstellungen → Bibliotheks-Interface** kann ein eigener Bearbeitungsmodus gestartet werden. Dann dürfen die Trennleisten der linken Spalte und der Playerbereiche verschoben werden. Mit **Layout fertig** werden die Leisten wieder gesperrt; die gewählten Breiten bleiben gespeichert. Namen und andere Texte werden innerhalb des verfügbaren Platzes begrenzt, statt benachbarte Bereiche zu überdecken.

Im `•••` der Überschriften **Playlists** und **Tags** liegt außerdem **Sortieren**. Diese Sortierung betrifft die Playlist-/Tag-Liste selbst; die Songs innerhalb einer Playlist bleiben davon unabhängig.


Undo/Redo bleibt auch in geöffneten Fenstern erreichbar. Eine feste Verlaufsleiste liegt oberhalb von Dialogen und Bestätigungen; im Importfenster steuert sie zuerst dessen eigenen Bearbeitungsverlauf.
