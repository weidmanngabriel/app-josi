# Architektur

## Überblick

Die Anwendung ist eine rein clientseitige React-App mit TypeScript und Vite. Der Einstieg liegt in `src/main.tsx`, die Musikoberfläche in `src/App.tsx` und das globale Styling in `src/styles.css`.

Josi ist im aktuellen Proof of Concept eine lokale Musik-App ohne Backend. Audiodateien und Playlists bleiben auf dem jeweiligen Gerät im Browser-Speicher.

## Lokale Musikdaten

`src/musicDb.ts` kapselt die lokale Speicherung über IndexedDB.

Es gibt zwei Datenarten:

- **Songs**: ID, Anzeigename, Audiodatei als Blob, MIME-Typ, Importzeitpunkt, optionaler relativer Quellpfad und optionale manuelle Position in der Bibliothek.
- **Playlists**: ID, Name, geordnete Song-IDs, optionales Playlist-Bild als Blob, Zeitpunkte für Erstellung und letzte Verwendung sowie optionale manuelle Position in der linken Playlist-Liste.

Audiodateien werden beim Import vollständig in IndexedDB gespeichert. Playlists referenzieren nur Song-IDs; die Audiodatei wird nicht pro Playlist dupliziert. Playlist-Bilder werden ebenfalls lokal in der jeweiligen Playlist gespeichert.

Für die Wiedergabe erzeugt die App für den aktuell ausgewählten Audio-Blob temporär eine Object-URL und gibt sie an ein HTML-Audio-Element weiter. Dasselbe Prinzip wird für die Anzeige lokaler Playlist-Bilder verwendet. Nicht mehr benötigte Object-URLs werden wieder freigegeben.

Die manuelle Reihenfolge der Bibliothek wird über `libraryOrder` an den Songs gespeichert. Die manuelle Reihenfolge der Playlist-Liste wird über `sortOrder` an den Playlists gespeichert. Bestehende Einträge ohne diese Werte verwenden weiterhin ihre bisherige zeitliche Reihenfolge als Fallback, bis sie erstmals manuell sortiert werden.

## Layout und Scrollen

Auf iPad-Größen ist die Hauptansicht in zwei unabhängig scrollbare Bereiche aufgeteilt:

- die linke Navigation mit Bibliothek und Playlists,
- den rechten Inhaltsbereich mit der Songliste.

Der Header oben und der Player unten bleiben außerhalb dieser beiden Scrollbereiche stehen. Dadurch scrollt eine lange Songliste nicht mehr die linke Navigation mit und umgekehrt.

## Player und Warteschlange

Der Player arbeitet immer mit der aktuell sichtbaren Warteschlange:

- In der Bibliothek besteht sie aus allen importierten Songs in der manuell gespeicherten Bibliotheksreihenfolge.
- In einer Playlist besteht sie aus deren gespeicherter Song-Reihenfolge.

Play/Pause, Vor, Zurück und die Fortschrittsanzeige steuern ein einzelnes HTML-Audio-Element. Das `ended`-Ereignis startet automatisch den nächsten Song der aktuellen Warteschlange.

Shuffle kann für die nächste Titelauswahl aktiviert werden. Repeat sorgt dafür, dass am Ende der Warteschlange wieder am Anfang weitergespielt wird.

Im Player werden Playlists für den aktuellen Song sortiert angezeigt: zuerst Playlists, die den Song bereits enthalten, danach die übrigen nach letzter Verwendung. Plus/Minus aktualisiert die Playlist unmittelbar in IndexedDB.

Die kompakte Anzeige „Jetzt“ ist anklickbar und öffnet eine Songdetailansicht innerhalb der App. Sie verwendet denselben laufenden Audio-Player und bietet eine große Titelanzeige, die aktuelle Playlist-Zugehörigkeit, frei verschiebbare Wiedergabeposition sowie fünf Bedienelemente: tatsächlich zuvor abgespielter Song, 10 Sekunden zurück, Play/Pause, 10 Sekunden vor und nächster Song. Für den historischen Zurück-Button hält die Oberfläche eine kleine lokale Wiedergabehistorie im Arbeitsspeicher.

Die frühere Herkunfts-/Originalpfad-Anzeige ist nicht mehr Teil der sichtbaren Songdetailansicht.

## Playlist- und Bibliotheksverwaltung

Playlists können direkt in der Oberfläche umbenannt und nach einer Bestätigung gelöscht werden. Beim Löschen einer Playlist bleiben die referenzierten Songs in der Bibliothek erhalten.

Songs können direkt aus einer geöffneten Playlist entfernt werden. Für die Reihenfolge einer geöffneten Playlist gibt es weiterhin den sichtbaren Bearbeitungsmodus „Reihenfolge ändern“.

Die Bibliothek verwendet denselben Pointer-Event-basierten Touch-Sortiermechanismus. Ihr Bearbeitungsmodus wird jedoch nicht dauerhaft als Knopf gezeigt: Ein etwa einsekündiger Langdruck auf die Überschrift „Bibliothek“ blendet einen kleinen „Bearbeiten“-Eintrag ein. Danach erscheinen Griffe an den Songs. Beim Ziehen wird nur der rechte Inhaltsbereich automatisch weitergescrollt.

Auch die Playlist-Liste in der linken Navigation ist manuell sortierbar. Ein etwa einsekündiger Langdruck auf „Playlists“ blendet den kleinen Eintrag „Bearbeiten“ ein. Ein transparenter Klickfänger liegt währenddessen über der restlichen Oberfläche; dadurch schließt ein Tipp daneben den Eintrag, ohne gleichzeitig die darunterliegende Aktion auszulösen. Im Bearbeitungsmodus erscheinen Griffe an den Playlists, und beim Ziehen scrollt nur die linke Navigation.

Die Sortierlogik verwendet Pointer Events statt nativem HTML5-Drag-and-Drop. Dadurch funktioniert dieselbe Interaktion mit Finger, Pencil oder Maus und sie kollidiert auf dem iPad weniger mit normalem Scrollen.

Ein optionales Playlist-Bild wird über den normalen Bild-Dateiauswahldialog gewählt und lokal gespeichert. Es dient ausschließlich zur besseren visuellen Unterscheidung der Playlists.

## PWA

`vite-plugin-pwa` erzeugt beim Produktionsbuild das Web-App-Manifest und den Service Worker. Die App verwendet feste App-Icons aus `public/` und ein `apple-touch-icon` für iOS.

`src/PullToRefresh.tsx` ergänzt auf Touch-Geräten ein eigenes Pull-to-Refresh. Durch die neuen internen Scrollbereiche ist dieses Verhalten auf der Hauptansicht weniger zentral und sollte auf dem Ziel-iPad praktisch mitgetestet werden.

Der Vite-Basispfad ist relativ (`./`). Dadurch funktioniert derselbe Build sowohl lokal als auch als GitHub-Project-Page in einem Repository-Unterpfad.

## Google Login

Die technische Google-Login-Basis aus dem ursprünglichen Template bleibt vorerst im Repository, wird vom Musik-PoC aber nicht in der Oberfläche verwendet. Der erste Produktablauf benötigt kein Nutzerkonto.

Falls später Synchronisierung, Cloud-Speicher oder geschützte Daten hinzukommen, muss die Authentifizierungs- und Backend-Architektur neu bewertet werden.

## Deployment

`.github/workflows/deploy.yml` baut die App bei Änderungen auf `main` und veröffentlicht ausschließlich `dist` über GitHub Pages.

GitHub Pages muss im Repository als Veröffentlichungsquelle **GitHub Actions** verwenden.

## Grenzen des aktuellen Ansatzes

IndexedDB-Speicher wird vom Browser bzw. Betriebssystem verwaltet. Für den Proof of Concept ist das bewusst akzeptiert. Vor einer produktiven Nutzung mit großen Musiksammlungen müssen verfügbare Speichermenge, Verhalten bei Speicherbereinigung sowie Backup und Wiederherstellung auf iPadOS geprüft werden.

Die Touch-Sortiermodi sollten weiterhin praktisch auf den tatsächlich verwendeten iPadOS-/Safari-Versionen getestet werden, insbesondere bei sehr langen Song- und Playlist-Listen und beim automatischen Scrollen am Rand des jeweiligen Bereichs.

Crossfade ist noch nicht implementiert. Es soll erst ergänzt werden, wenn die einfache Wiedergabe und Autoplay auf dem iPad zuverlässig funktionieren.
