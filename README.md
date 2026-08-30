# Josi

Dieses Repository ist die technische Basis für **Josi**. Aktuell ist noch kein produktspezifischer Funktionsumfang festgelegt; das Projekt befindet sich auf dem Stand eines schlanken, installierbaren PWA-Grundgerüsts.

Die fachliche Produktidee wird in `concept.md` festgehalten. Technische Entscheidungen und die aktuelle Struktur stehen in `architecture.md`.

## Aktueller Stand

Vorhanden sind:

- React + TypeScript + Vite
- installierbare Progressive Web App mit Service Worker und App-Icons
- responsive Oberfläche
- Pull-to-Refresh auf Touch-Geräten
- optionaler Google Login über Google Identity Services
- mehrere lokal gespeicherte Google-Konten mit Accountwechsel
- automatisches Deployment über GitHub Pages und GitHub Actions

Noch nicht definiert sind unter anderem Zielgruppe, Kernnutzen, fachliche Abläufe, Datenmodell, Rollen und Zahlungsfunktionen. Diese Punkte werden erst ergänzt, wenn das Produktkonzept feststeht.

## Lokal starten

Voraussetzung ist eine aktuelle Node.js-Installation.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Produktionsbuild prüfen:

```bash
npm run build
```

## Google Login

Der Google Login ist optional. Ohne konfigurierte Client-ID funktioniert die restliche App weiterhin.

Für lokale Entwicklung kann in `.env.local` eine öffentliche OAuth-Web-Client-ID gesetzt werden:

```env
VITE_GOOGLE_CLIENT_ID=deine-client-id.apps.googleusercontent.com
```

Für das Deployment wird dieselbe Client-ID in GitHub unter **Settings → Secrets and variables → Actions → Variables** als Repository-Variable `GOOGLE_CLIENT_ID` hinterlegt.

Ein Client-Secret gehört nicht in dieses Repository oder in den Browser-Code.

Die aktuell lokal gespeicherten Google-Profildaten dienen nur dem komfortablen Accountwechsel. Sie sind keine sichere Autorisierung für geschützte Daten oder Backend-Funktionen.

## Deployment

Der Workflow `.github/workflows/deploy.yml` läuft bei Änderungen auf `main`, erstellt den Produktionsbuild und veröffentlicht `dist` über GitHub Pages.

GitHub Pages muss im Repository als Veröffentlichungsquelle **GitHub Actions** verwenden.

Der Vite-Basispfad ist relativ konfiguriert. Dadurch funktioniert derselbe Build lokal und unter einem GitHub-Pages-Unterpfad.

## Wichtige Dateien

- `agents.md` – verbindliche Arbeitsregeln für Coding Agents
- `concept.md` – Produktidee, Zielgruppe, Kernfunktionen und zentrale Abläufe
- `architecture.md` – technische Architektur und wichtige Entscheidungen
- `src/App.tsx` – aktuelle Oberfläche
- `src/auth/google.ts` – lokale Google-Account-Verwaltung
- `src/PullToRefresh.tsx` – Pull-to-Refresh für Touch-Geräte
- `.github/workflows/deploy.yml` – GitHub-Pages-Deployment

## Entwicklungsprinzip

Josi soll zunächst als möglichst einfacher Prototyp entstehen. Neue Libraries, ein Backend oder zusätzliche technische Schichten werden erst eingeführt, wenn eine konkrete Produktanforderung sie rechtfertigt.

Der nächste fachlich wichtige Schritt ist das Ausfüllen von `concept.md`: Welches Problem Josi löst, für wen die App gedacht ist und welcher kleinste Ablauf ein echtes Geschäftsmodell testen kann.
