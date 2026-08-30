# Architektur

## Überblick

Die Anwendung ist eine rein clientseitige React-App mit TypeScript und Vite. Der Einstieg liegt in `src/main.tsx`, die Musikoberfläche in `src/App.tsx` und das globale Styling in `src/styles.css`.

Josi ist im aktuellen Proof of Concept eine lokale Musik-App ohne Backend. Audiodateien und Playlists bleiben auf dem jeweiligen Gerät im Browser-Speicher.

## Lokale Musikdaten

`src/musicDb.ts` kapselt die lokale Speicherung über IndexedDB.

Es gibt zwei Datenarten:

- **Songs**: ID, Anzeigename, Audiodatei als Blob, MIME-Typ und Importzeitpunkt.
- **Playlists**: ID, Name, geordnete Song-IDs, optionales Playlist-Bild als Blob sowie Zeitpunkte für Erstellung und letzte Verwendung.

Audiodateien werden beim Import vollständig in IndexedDB gespeichert. Playlists referenzieren nur Song-IDs; die Audiodatei wird nicht pro Playlist dupliziert. Playlist-Bilder werden ebenfalls lokal in der jeweiligen Playlist gespeichert.

Für die Wiedergabe erzeugt die App für den aktuell ausgewählten Audio-Blob temporär eine Object-URL und gibt sie an ein HTML-Audio-Element weiter. Dasselbe Prinzip wird für die Anzeige lokaler Playlist-Bilder verwendet. Nicht mehr benötigte Object-URLs werden wieder freigegeben.

## Player und Warteschlange

Der Player arbeitet immer mit der aktuell sichtbaren Warteschlange:

- In der Bibliothek besteht sie aus allen importierten Songs.
- In einer Playlist besteht sie aus deren gespeicherter Song-Reihenfolge.

Play/Pause, Vor, Zurück und die Fortschrittsanzeige steuern ein einzelnes HTML-Audio-Element. Das `ended`-Ereignis startet automatisch den nächsten Song der aktuellen Warteschlange.

Shuffle kann für die nächste Titelauswahl aktiviert werden. Repeat sorgt dafür, dass am Ende der Warteschlange wieder am Anfang weitergespielt wird.

Im Player werden Playlists für den aktuellen Song sortiert angezeigt: zuerst Playlists, die den Song bereits enthalten, danach die übrigen nach letzter Verwendung. Plus/Minus aktualisiert die Playlist unmittelbar in IndexedDB.

## Playlist-Verwaltung

Playlists können direkt in der Oberfläche umbenannt und nach einer Bestätigung gelöscht werden. Beim Löschen einer Playlist bleiben die referenzierten Songs in der Bibliothek erhalten.

Songs können direkt aus einer geöffneten Playlist entfernt werden. Die Reihenfolge der Song-IDs kann per Drag-and-Drop geändert und anschließend wieder in IndexedDB gespeichert werden.

Ein optionales Playlist-Bild wird über den normalen Bild-Dateiauswahldialog gewählt und lokal gespeichert. Es dient ausschließlich zur besseren visuellen Unterscheidung der Playlists.

## PWA

`vite-plugin-pwa` erzeugt beim Produktionsbuild das Web-App-Manifest und den Service Worker. Die App verwendet feste App-Icons aus `public/` und ein `apple-touch-icon` für iOS.

`src/PullToRefresh.tsx` ergänzt auf Touch-Geräten ein eigenes Pull-to-Refresh. Die Geste startet nur am oberen Seitenrand und löst nach Überschreiten des Schwellwerts einen vollständigen Reload aus.

Der Vite-Basispfad ist relativ (`./`). Dadurch funktioniert derselbe Build sowohl lokal als auch als GitHub-Project-Page in einem Repository-Unterpfad.

## Google Login

Die technische Google-Login-Basis aus dem ursprünglichen Template bleibt vorerst im Repository, wird vom Musik-PoC aber nicht in der Oberfläche verwendet. Der erste Produktablauf benötigt kein Nutzerkonto.

Falls später Synchronisierung, Cloud-Speicher oder geschützte Daten hinzukommen, muss die Authentifizierungs- und Backend-Architektur neu bewertet werden.

## Deployment

`.github/workflows/deploy.yml` baut die App bei Änderungen auf `main` und veröffentlicht ausschließlich `dist` über GitHub Pages.

GitHub Pages muss im Repository als Veröffentlichungsquelle **GitHub Actions** verwenden.

## Grenzen des aktuellen Ansatzes

IndexedDB-Speicher wird vom Browser bzw. Betriebssystem verwaltet. Für den Proof of Concept ist das bewusst akzeptiert. Vor einer produktiven Nutzung mit großen Musiksammlungen müssen verfügbare Speichermenge, Verhalten bei Speicherbereinigung sowie Backup und Wiederherstellung auf iPadOS geprüft werden.

Das aktuelle Drag-and-Drop basiert auf den Browser-Funktionen und muss insbesondere auf der tatsächlich verwendeten iPadOS-/Safari-Version praktisch getestet werden.

Crossfade ist noch nicht implementiert. Es soll erst ergänzt werden, wenn die einfache Wiedergabe und Autoplay auf dem iPad zuverlässig funktionieren.
