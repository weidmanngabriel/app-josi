from pathlib import Path

replacements = {
    'architecture.md': [
        ('Beim Erstellen und Umbenennen steht eine kompakte Palette mit ungefähr 100 Farbtönen bereit.', 'Beim Erstellen und Umbenennen öffnet der Farbring ein frei antippbares Farbspektrum; erst „Fertig“ übernimmt die gewählte Farbe.'),
        ('Das `•••` neben der Überschrift „Playlists“ bleibt für „Bearbeiten“ und „Übersicht“ zuständig.', 'Das `•••` neben der Überschrift „Playlists“ bietet „Auswählen“, „Bearbeiten“ und „Übersicht“. Im Auswahlmodus erscheint zusätzlich der schwebende Drei-Punkte-Knopf unten rechts.'),
        ('Bibliothek, Playlists, Importverlauf und Loops verwenden denselben Auswahlmodus. Rechts neben „Alle Playlists“ liegt im Auswahlmodus ein runder `•••`-Knopf. Er zeigt die reservierten Aktionen Gruppieren und Tags sowie Bewegen und Alle löschen. Gruppieren/Tags bleiben im Prototyp deaktiviert.', 'Bibliothek, Playlists, Importverlauf und Loops verwenden denselben Song-Auswahlmodus. Rechts neben „Alle Playlists“ liegt im Auswahlmodus ein runder `•••`-Knopf. Er bietet unter anderem Gruppieren, Bewegen, Tags und Alle löschen. Playlists und Tags besitzen einen entsprechenden eigenen Auswahlmodus mit einem schwebenden `•••` unten rechts; dort kann die Auswahl gruppiert werden.'),
        ('Die Song-Detailansicht zeigt Shuffle und Wiederholen außen um ihre bisherigen Transportknöpfe; derselbe Langdruck auf Wiederholen aktiviert dort ebenfalls `↻1`.', 'Die Song-Detailansicht zeigt Shuffle und Wiederholen außen um ihre bisherigen Transportknöpfe; derselbe Langdruck auf Wiederholen öffnet dort ebenfalls die Auswahl zwischen `∞` und einer endlichen Wiederholungszahl.'),
    ],
    'concept.md': [
        ('Das `•••` neben der Überschrift „Playlists“ bleibt für **Bearbeiten** und **Übersicht** zuständig.', 'Das `•••` neben der Überschrift „Playlists“ bietet **Auswählen**, **Bearbeiten** und **Übersicht**. Während der Auswahl erscheint der zusätzliche Drei-Punkte-Knopf unten rechts.'),
        ('„Auswählen“ funktioniert in Bibliothek, Playlist, Importverlauf und Loops. Rechts neben **„Alle Playlists“** erscheint ein runder `•••`-Knopf mit **Gruppieren** (später), **Bewegen**, **Tags** und **Alle löschen**.', '„Auswählen“ funktioniert in Bibliothek, Playlist, Importverlauf und Loops. Rechts neben **„Alle Playlists“** erscheint ein runder `•••`-Knopf mit **Gruppieren**, **Bewegen**, **Tags** und **Alle löschen**. Playlists und Tags erhalten einen eigenen Auswahlmodus über ihre Überschrift und ebenfalls einen Drei-Punkte-Knopf unten rechts zum Gruppieren.'),
        ('In der näheren Song-Ansicht sitzen Shuffle und Wiederholen außen um die bisherigen Transportknöpfe; Langdruck auf Wiederholen nutzt dort ebenfalls `↻1`.', 'In der näheren Song-Ansicht sitzen Shuffle und Wiederholen außen um die bisherigen Transportknöpfe; Langdruck auf Wiederholen öffnet dort ebenfalls `∞` oder eine frei wählbare Wiederholungszahl.'),
        ('Beim Erstellen und Umbenennen kann die Farbe aus einer kompakten Palette mit ungefähr 100 Farben gewählt werden.', 'Beim Erstellen und Umbenennen wird die Farbe über ein frei antippbares Farbspektrum gewählt. Ein nicht greifbarer Punkt zeigt die Auswahl; erst **Fertig** übernimmt sie.'),
    ],
}

for file_name, items in replacements.items():
    path = Path(file_name)
    text = path.read_text()
    for old, new in items:
        if old not in text:
            raise SystemExit(f'missing documentation text in {file_name}: {old[:60]}')
        text = text.replace(old, new, 1)
    path.write_text(text)
