from pathlib import Path

app_path = Path('src/App.tsx')
app = app_path.read_text()
old = "  const toggleSongLoop = async (id: string) => { const song = songs.find((item) => item.id === id); if (!song || song.loopStart === undefined || song.loopEnd === undefined) return; await updateSong({ ...song, loopEnabled: !song.loopEnabled }, true); setOverflowMenu(null) }\n  const toggleCurrentLoop = async () => { if (!currentSong || currentSong.loopStart === undefined || currentSong.loopEnd === undefined) return; await updateSong({ ...currentSong, loopEnabled: !currentSong.loopEnabled }, true) }"
new = "  const toggleSongLoop = async (id: string) => { const song = songs.find((item) => item.id === id); if (!song || song.loopStart === undefined || song.loopEnd === undefined) return; if (song.loopEnabled && id === currentSongId) cancelLoopTransition(); await updateSong({ ...song, loopEnabled: !song.loopEnabled }, true); setOverflowMenu(null) }\n  const toggleCurrentLoop = async () => { if (!currentSong || currentSong.loopStart === undefined || currentSong.loopEnd === undefined) return; if (currentSong.loopEnabled) cancelLoopTransition(); await updateSong({ ...currentSong, loopEnabled: !currentSong.loopEnabled }, true) }"
if old not in app:
    raise SystemExit('loop toggle anchor missing')
app_path.write_text(app.replace(old, new, 1))

architecture_path = Path('architecture.md')
architecture = architecture_path.read_text()
architecture = architecture.replace('Bibliothek, Playlists, Verlauf und Loops verwenden denselben Auswahlmodus.', 'Bibliothek, Playlists, Importverlauf und Loops verwenden denselben Auswahlmodus.')
architecture_path.write_text(architecture)

concept_path = Path('concept.md')
concept = concept_path.read_text()
concept = concept.replace('„Auswählen“ funktioniert in Bibliothek, Playlist, Verlauf und Loops.', '„Auswählen“ funktioniert in Bibliothek, Playlist, Importverlauf und Loops.')
concept_path.write_text(concept)
