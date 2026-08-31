from pathlib import Path

app_path = Path('src/App.tsx')
app = app_path.read_text()

old = """    const copy: Song = { ...song, id: crypto.randomUUID(), name: `${song.name} Kopie`, addedAt: now, libraryOrder: now, importBatchId: crypto.randomUUID(), isNew: false, completedPlays: 0, loopMarkers: song.loopMarkers ? [...song.loopMarkers] : undefined }"""
new = """    const copy: Song = { ...song, id: crypto.randomUUID(), name: `${song.name} Kopie`, addedAt: now, libraryOrder: now, importBatchId: crypto.randomUUID(), isNew: false, completedPlays: 0, loopMarkers: song.loopMarkers ? [...song.loopMarkers] : undefined, trashedAt: undefined, trashPlaylistIds: undefined, trashedLoop: undefined }"""
if old not in app: raise SystemExit('copy pattern missing')
app = app.replace(old, new, 1)

old = """  const restoreTrashedPlaylist = async (playlist: Playlist) => { const restored = { ...playlist, trashedAt: undefined }; await savePlaylist(restored); setTrashedPlaylists((items) => items.filter((item) => item.id !== playlist.id)); setPlaylists((items) => [restored, ...items]) }"""
new = """  const restoreTrashedPlaylist = async (playlist: Playlist) => {
    const waitingSongs = songs.filter((song) => song.trashPlaylistIds?.includes(playlist.id))
    const restored = { ...playlist, trashedAt: undefined, songIds: [...playlist.songIds, ...waitingSongs.map((song) => song.id).filter((id) => !playlist.songIds.includes(id))] }
    await savePlaylist(restored)
    const updatedSongs = songs.map((song) => song.trashPlaylistIds?.includes(playlist.id) ? { ...song, trashPlaylistIds: song.trashPlaylistIds.filter((id) => id !== playlist.id) || undefined } : song)
    await Promise.all(updatedSongs.filter((song, index) => song !== songs[index]).map(saveSong))
    setSongs(updatedSongs)
    setTrashedPlaylists((items) => items.filter((item) => item.id !== playlist.id))
    setPlaylists((items) => [restored, ...items])
  }"""
if old not in app: raise SystemExit('restore playlist pattern missing')
app = app.replace(old, new, 1)

# Fix empty-array metadata after restoring a playlist.
app = app.replace("trashPlaylistIds: song.trashPlaylistIds.filter((id) => id !== playlist.id) || undefined", "trashPlaylistIds: (() => { const remaining = song.trashPlaylistIds.filter((id) => id !== playlist.id); return remaining.length ? remaining : undefined })()", 1)

app = app.replace('Der gespeicherte Loop von „{currentSong.name}“ wird entfernt. Die Audiodatei bleibt unverändert.', 'Der gespeicherte Loop von „{currentSong.name}“ wird in den Papierkorb verschoben. Die Audiodatei bleibt unverändert.', 1)
app_path.write_text(app)

css_path = Path('src/enhancements.css')
css = css_path.read_text()
marker = r'\n\n/* Import groups, sort menu and Trash */'
if marker in css:
    before, after = css.split(marker, 1)
    css = before + '\n\n/* Import groups, sort menu and Trash */' + after.replace(r'\n', '\n')
css_path.write_text(css)
