from pathlib import Path

css_path = Path('src/enhancements.css')
concept_path = Path('concept.md')

css = css_path.read_text()
concept = concept_path.read_text()

css = css.replace('.song-row.repeat-selected-song { background:rgba(22,163,74,.17); box-shadow:inset 3px 0 0 #22c55e; }\n.song-row.repeat-selected-song:hover { background:rgba(22,163,74,.23); }\n', '')
css = css.replace('.repeat-symbol b { position:absolute; inset:0; display:grid; place-items:center; padding-top:1px; font-size:8px; font-weight:950; line-height:1; }\n', '')

concept = concept.replace(
    'Die Sortiersteuerung steht nicht dauerhaft unter der Überschrift, sondern in `••• → Umbenennen → Sortieren` des jeweiligen Tags bzw. der Playlist.',
    'Die Sortiersteuerung steht nicht dauerhaft unter der Überschrift, sondern im `•••` des jeweiligen Tags bzw. der Playlist als **Sortieren** direkt unter **Umbenennen**.'
)

css_path.write_text(css)
concept_path.write_text(concept)
print('polished legacy repeat styles and sorting wording')
