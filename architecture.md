# Architektur

## Überblick

Die Anwendung ist eine rein clientseitige React-App mit TypeScript und Vite. Der Einstieg liegt in `src/main.tsx`, die Musikoberfläche in `src/App.tsx` und das globale Styling in `src/styles.css`.

Josi ist im aktuellen Proof of Concept eine lokale Musik-App ohne Backend. Audiodateien und Playlists bleiben auf dem jeweiligen Gerät im Browser-Speicher.

## Lokale Musikdaten

`src/musicDb.ts` kapselt die lokale Speicherung über IndexedDB.

Es gibt zwei Datenarten:

- **Songs**: ID, Anzeigename, Audiodatei als Blob, MIME-Typ und Importzeitpunkt.
- **Playlists**: ID, Name, geordnete Song-IDs sowie Zeitpunkte für Erstellung und letzte Verwendung.

Audiodateien werden beim Import vollständig in IndexedDB gespeichert. Playlists referenzieren nur Song-IDs; die Audiodatei wird nicht pro Playlist dupliziert.

Für die Wiedergabe erzeugt die App für den aktuell ausgewählten Blob temporär eine Object-URL und gibt sie an ein HTML-Audio-Element weiter. Beim Songwechsel wird die bisherige URL wieder freigegeben.

## Player und Warteschlange

Der Player arbeitet immer mit der aktuell sichtbaren Warteschlange:

- In der Bibliothek besteht sie aus allen importierten Songs.
- In einer Playlist besteht sie aus deren gespeicherter Song-Reihenfolge.

Play/Pause, Vor, Zurück und die Fortschrittsanzeige steuern ein einzelnes HTML-Audio-Element. Das `ended`-Ereignis startet automatisch den nächsten Song der aktuellen Warteschlange.

Im Player werden Playlists für den aktuellen Song sortiert angezeigt: zuerst Playlists, die den Song bereits enthalten, danach die übrigen nach letzter Verwendung. Plus/Minus aktualisiert die Playlist unmittelbar in IndexedDB.

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

Crossfade ist noch nicht implementiert. Es soll erst ergänzt werden, wenn die einfache Wiedergabe und Autoplay auf dem iPad zuverlässig funktionieren.
