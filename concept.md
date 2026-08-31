# Produktkonzept

## Grundidee

Josi ist eine lokal laufende Musik-App für das iPad. Nutzer importieren eigene Audiodateien, organisieren sie in Playlists, spielen sie ab und bearbeiten ihre Sammlung direkt auf dem Gerät.

Der Proof of Concept validiert vor allem **Importieren → organisieren → zuverlässig abspielen → präzise verwalten**.

## Kernfunktionen

- Mehrere lokale Audiodateien über den normalen Dateidialog importieren.
- Bibliothek, Verlauf und eigener Loops-Tab.
- Neu importierte Songs blau markieren.
- Songs und Playlists über sichtbare Drei-Punkte-Menüs verwalten.
- Mehrere Songs auswählen und über „Alle Playlists“ einer Playlist zuordnen.
- Songlisten nach Manuell, A–Z Anfang, A–Z Ende, Höranzahl, Dauer oder Chronik sortieren.
- Lieddauer anzeigen, sobald sie vom Player ermittelt wurde.
- Vollständig gehörte Wiedergaben zählen.
- Manueller, präziser Loop-Editor statt automatischer Loop-Erkennung.
- Media-Session-Integration für System-Mediensteuerung, soweit iPadOS/Safari sie bereitstellt.

## Drei-Punkte-Menü für Songs

Die Aktionen stehen in dieser Reihenfolge:

1. **Umbenennen**
2. **Kopieren**
3. **Teilen**
4. **Loop erstellen** bzw. **Loop bearbeiten**
5. Bei vorhandenem Loop: **Loop aktivieren** bzw. **Loop deaktivieren**
6. Nur bei blau markierten Songs in blauer Schrift: **Als gelesen markieren**
7. Nur bei blau markierten Songs in blauer Schrift: **Alle als gelesen markieren**
8. In roter Schrift: **Löschen**

„Kopieren“ erstellt einen zweiten Bibliothekseintrag mit eigener ID. „Teilen“ öffnet nach Möglichkeit die iPad-Systemfreigabe mit der Audiodatei. „Löschen“ fragt vorher nach und entfernt den Song anschließend auch aus Playlists, ohne die Playlists selbst zu löschen.

## Drei-Punkte-Menü für Playlists

Einzelne Playlists bieten:

1. **Umbenennen**
2. **Kopieren**
3. **Teilen**
4. **Löschen** in Rot

Eine kopierte Playlist verweist auf dieselben Songs; Audiodateien werden nicht verdoppelt. Beim Teilen wird eine Textübersicht der Playlist mit ihren Liedern an die Systemfreigabe übergeben.

Der bisherige separate Löschknopf in einer geöffneten Playlist entfällt. Die Nachfrage „wirklich löschen?“ bleibt erhalten.

Das `•••` neben der Überschrift „Playlists“ bleibt für **Bearbeiten** und **Übersicht** zuständig.

## Import und lokale Dateien

Der Import bleibt bewusst leichtgewichtig. Nur neu ausgewählte Dateien werden gespeichert; bestehende Audiodaten werden nicht bei jedem Import erneut geschrieben.

`--:--` bedeutet unbekannte Dauer. `FEHLT` bedeutet, dass der lokale Audioblob nicht mehr vorhanden ist und der Song neu importiert werden muss.

Wichtig für die Datenintegrität: Die eigentliche Audiodatei und spätere Änderungen an einem Song werden getrennt gespeichert. **Loop speichern, Umbenennen, Dauer, Hörzähler, „gelesen“ und Sortierung dürfen die Audiodatei selbst nicht erneut schreiben.** Dadurch kann eine reine Bearbeitung die importierte Datei nicht mehr durch einen erneuten Blob-Schreibvorgang beschädigen.

Dateien, die bereits vor dieser Änderung beschädigt oder leer geworden sind, können von der App nicht wiederhergestellt werden und müssen erneut importiert werden.

## Mehrfachauswahl

„Auswählen“ funktioniert in Bibliothek, Playlist, Verlauf und Loops. Mehrere markierte Songs werden ausschließlich über den Kasten **„Alle Playlists“** unten rechts einer Playlist zugeordnet.

## Sortierung

Alle Songlisten bieten:

- **Manuell**
- **A–Z Anfang**
- **A–Z Ende**
- **Anzahl des Hörens**
- **Dauer**
- **Chronik**

Der Pfeil kehrt die Sortierung um. Die manuelle Reihenfolge bleibt separat gespeichert und wird durch andere Sortierungen nicht verändert.

## Präziser Loop-Editor

`•••` → **Loop erstellen** öffnet eine eigene Vollbildansicht. Die automatische Loop-Erkennung bleibt entfernt.

Der Editor enthält:

- einen **roten Loop-Kasten** mit verschiebbarem Gesamtbereich,
- getrennte rote Start- und Endkanten mit größeren Touch-Flächen,
- **Zoom von 1× bis 16×** und horizontales Scrollen,
- eine klassische **Audio-Wellenform** als Amplitude über Zeit,
- einen **blauen Abspielstrich**, der nur über seinen blauen Punkt bewegt werden kann,
- einen Schalter, der den roten Loop-Bereich transparent und unbeweglich macht,
- einen Schalter **„Cursor-Loop“**, der bestimmt, ob die Wiedergabe im Editor am roten Endpunkt wieder zum roten Startpunkt springt,
- eine zweite **grüne Fokus-Leiste unter der Zeitachse**,
- einen grünen Fokusstrich, der den Mittelpunkt für den nächsten Zoom bestimmt,
- einen Schalter **„Fokus folgt Cursor“**: eingeschaltet folgt der grüne Fokus dem blauen Cursor und die sichtbare Zeitleiste bewegt sich beim Abspielen mit; ausgeschaltet kann der Fokus unabhängig gesetzt werden,
- **−5 s**, **Play/Pause** und **+5 s**,
- eine leicht bläuliche Geschwindigkeitsbox mit **10%, 25%, 33%, 50%, 66%, 75%, 100%, 150% und 200%**, wobei 100% Normalgeschwindigkeit ist,
- **orange Markierungen**, die an der Position des blauen Cursors gesetzt werden,
- anklickbare orange Markierungen, die den blauen Cursor direkt dorthin bringen,
- einen Schalter zum Aktivieren/Deaktivieren der Markierungsbedienung,
- ein Eingabefeld für die **Feinschrittweite der zuletzt berührten roten Kante**, z. B. `0,01` = 10 ms, `0,1` = 100 ms oder `1` = eine Sekunde,
- zwei Knöpfe **− Schritt / + Schritt**, die genau diese eingestellte Schrittweite verwenden,
- ein Eingabefeld für einen frei wählbaren Vorlauf in Sekunden, z. B. `0,5` oder `1`,
- **vor Start abspielen** und **vor Ende abspielen**, die den blauen Cursor entsprechend vor die gewünschte rote Kante setzen und die Wiedergabe starten.

Die Wellenform entspricht dem, was man aus Schnittprogrammen kennt: Sie zeigt nicht die Frequenz in Hertz, sondern die Stärke des Audios über die Zeit. Das macht Einsätze, Pausen und Übergänge leichter sichtbar. Kann die Datei lokal nicht für die Wellenform dekodiert werden, bleibt der Song trotzdem normal abspielbar.

Das Bedienprinzip priorisiert große, eindeutige Touch-Flächen. Unsichtbare Trefferbereiche dürfen größer als die sichtbaren Striche sein, solange sie sich nicht gegenseitig blockieren. Besonders der blaue Cursor nimmt deshalb entlang seines Strichs keine Eingaben an; nur der blaue Punkt ist greifbar.

Beim Abspielen innerhalb des Editors springt die Wiedergabe nur dann am Loop-Ende wieder zum Loop-Start, wenn **Cursor-Loop** eingeschaltet ist. **Loop speichern** übernimmt Start, Ende, Marker und aktiviert den gespeicherten Song-Loop. Diese Werte werden nur als Metadaten gespeichert; die Audiodatei selbst bleibt unangetastet. Gespeicherte Loops werden weiterhin mit einer roten Schleife markiert und im Tab **Loops** gesammelt.

## Wiederholen: Liste oder ausgewählte Songs

Kurzer Druck auf den Wiederholen-Knopf schaltet die normale Listenwiederholung. **Langdruck ist hier bewusst die einzige Ausnahme zur sonst abgeschafften Langdruck-Bedienung:** Er aktiviert `↻1`. Ohne Mehrfachauswahl wiederholt Josi den aktuell gewählten Song. Werden vorher mehrere Songs mit „Auswählen“ markiert, übernimmt der Langdruck genau diese Songs als Wiederholgruppe, beendet den Auswahlmodus und markiert die Gruppe dauerhaft grün, solange der Modus aktiv ist. Die Songs laufen in Listenreihenfolge und beginnen nach dem letzten wieder beim ersten. Das Symbol bleibt `↻1`, auch wenn mehrere Songs dazugehören.

## Wiedergabe nach Loop-Bearbeitung

Das Speichern oder Umschalten eines Loops darf die zugrunde liegende Audiodatei weder neu laden noch neu in IndexedDB schreiben. Die Audioquelle wird nur dann neu erzeugt, wenn sich der ausgewählte Song oder dessen tatsächlicher Datei-Blob ändert.

Änderungen wie Loop speichern, Loop an/aus, Marker, Dauer oder Umbenennen verändern nur Metadaten. Dadurch bleibt die Wiedergabequelle stabil und die importierte Datei geschützt.

## Teilen

Songs werden, soweit die Web Share API und iPadOS es erlauben, als tatsächliche Audiodatei geteilt. Wenn der Browser Dateifreigabe nicht unterstützt, zeigt Josi eine verständliche Meldung statt still zu scheitern.

Playlists sind keine einzelne Datei. Deshalb teilt Josi bei Playlists eine Textübersicht mit Playlistname und Liedliste.

## Navigation und Bearbeitungsverlauf

Zurück und Vor öffnen vorherige bzw. nächste App-Ansichten. Undo und Redo bleiben rechts daneben. Bei einer vorgemerkten manuellen Verschiebung folgen Haken und X. Im Loop-Editor schließt Zurück zuerst den Editor.

## Abgrenzung

Noch nicht Teil der aktuellen Version:

- Cloud-Synchronisierung oder Backend,
- Nutzerkonten im Produktablauf,
- automatische Metadaten-/Cover-Erkennung,
- Suche,
- Musik-Streaming,
- automatische Loop-Erkennung,
- Frequenz-Spektrogramm,
- Crossfade/Fading,
- native iOS-Hintergrund-Audio-Berechtigungen außerhalb der Möglichkeiten einer PWA.

Der experimentelle Ordnerimport bleibt entfernt.

## Offene Annahmen

- Die lokale Browser-Speicherkapazität reicht für einen realistischen Test.
- Systemfreigabe von Audiodateien funktioniert auf den tatsächlich verwendeten iPadOS-/Safari-Versionen ausreichend zuverlässig.
- Die klassische Amplituden-Wellenform ist auf realen Musikdateien schnell genug berechenbar und hilft bei der Loop-Auswahl.
- Die vergrößerten Trefferflächen und die getrennte Fokus-Leiste machen den Editor auf Touch-Geräten zuverlässiger bedienbar.
- Die getrennte Speicherung von Audiodatei und Metadaten verhindert, dass reine Bearbeitungsschritte bestehende Audiodaten erneut schreiben.
- Für eine spätere Produktversion müssen Backup, Speichergrenzen, Wiederherstellung verlorener Audiodaten und eventuell eine native App-Hülle geprüft werden.
