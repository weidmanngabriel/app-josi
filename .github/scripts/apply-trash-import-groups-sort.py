from pathlib import Path
import re


def once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'Missing pattern: {label}')
    return text.replace(old, new, 1)

app_path = Path('src/App.tsx')
app = app_path.read_text()

app = once(app,
"  getPlaylists,\n  getSongs,\n",
"  getPlaylists,\n  getSongs,\n  getTrashedPlaylists,\n  getTrashedSongs,\n",
'import trash readers')
app = once(app,
"type View = 'library' | 'history' | 'loops' | 'playlistOverview'",
"type View = 'library' | 'history' | 'loops' | 'trash' | 'playlistOverview'",
'view trash')
app = once(app,
"  const [playlists, setPlaylists] = useState<Playlist[]>([])\n",
"  const [playlists, setPlaylists] = useState<Playlist[]>([])\n  const [trashedSongs, setTrashedSongs] = useState<Song[]>([])\n  const [trashedPlaylists, setTrashedPlaylists] = useState<Playlist[]>([])\n",
'trash state')
app = once(app,
"  const [selectionConfirmation, setSelectionConfirmation] = useState<SelectionConfirmation>(null)\n",
"  const [selectionConfirmation, setSelectionConfirmation] = useState<SelectionConfirmation>(null)\n  const [trashConfirmation, setTrashConfirmation] = useState(false)\n  const [sortMenuOpen, setSortMenuOpen] = useState(false)\n  const [sortConfirmation, setSortConfirmation] = useState(false)\n",
'confirmation state')
app = once(app,
"    Promise.all([getSongs(), getPlaylists()]).then(([storedSongs, storedPlaylists]) => {\n      setSongs(storedSongs)\n      setPlaylists(storedPlaylists)\n",
"    Promise.all([getSongs(), getPlaylists(), getTrashedSongs(), getTrashedPlaylists()]).then(([storedSongs, storedPlaylists, storedTrashedSongs, storedTrashedPlaylists]) => {\n      setSongs(storedSongs)\n      setPlaylists(storedPlaylists)\n      setTrashedSongs(storedTrashedSongs)\n      setTrashedPlaylists(storedTrashedPlaylists)\n",
'initial trash load')
app = once(app,
"    if (view === 'history') return songs.filter((song) => song.isNew)\n",
"    if (view === 'history') return [...songs]\n",
'history all songs')

old_visible = """  const visibleSongs = useMemo(() => {\n    const items = [...searchedVisibleSongs]\n    if (sortMode === 'manual') return items\n    const direction = sortDirection === 'down' ? 1 : -1\n    const compare = (a: Song, b: Song) => {\n      if (sortMode === 'azStart') return a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' })\n      if (sortMode === 'azEnd') return reverseText(a.name).localeCompare(reverseText(b.name), 'de', { numeric: true, sensitivity: 'base' })\n      if (sortMode === 'plays') return (a.completedPlays ?? 0) - (b.completedPlays ?? 0) || a.name.localeCompare(b.name, 'de')\n      if (sortMode === 'duration') return (a.duration ?? Number.MAX_SAFE_INTEGER) - (b.duration ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'de')\n      return a.addedAt - b.addedAt\n    }\n    return items.sort((a, b) => compare(a, b) * direction)\n  }, [searchedVisibleSongs, sortMode, sortDirection])\n"""
new_visible = """  const visibleSongs = useMemo(() => {\n    const items = [...searchedVisibleSongs]\n    const direction = sortDirection === 'down' ? 1 : -1\n    const compare = (a: Song, b: Song) => {\n      if (sortMode === 'azStart') return a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' })\n      if (sortMode === 'azEnd') return reverseText(a.name).localeCompare(reverseText(b.name), 'de', { numeric: true, sensitivity: 'base' })\n      if (sortMode === 'plays') return (a.completedPlays ?? 0) - (b.completedPlays ?? 0) || a.name.localeCompare(b.name, 'de')\n      if (sortMode === 'duration') return (a.duration ?? Number.MAX_SAFE_INTEGER) - (b.duration ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'de')\n      return a.addedAt - b.addedAt\n    }\n    const ordered = sortMode === 'manual' ? items : items.sort((a, b) => compare(a, b) * direction)\n    const fresh = ordered.filter((song) => song.isNew)\n    const normal = ordered.filter((song) => !song.isNew)\n    return [...fresh, ...normal]\n  }, [searchedVisibleSongs, sortMode, sortDirection])\n"""
app = once(app, old_visible, new_visible, 'new song grouping')

# Soft-delete single song into Trash.
pattern = re.compile(r"  const confirmDeleteSong = async \(\) => \{.*?\n  \}\n\n  const openLoopEditor", re.S)
match = pattern.search(app)
if not match: raise SystemExit('Missing confirmDeleteSong block')
replacement = """  const confirmDeleteSong = async () => {\n    if (!songToDelete) return\n    const playlistIds = playlists.filter((playlist) => playlist.songIds.includes(songToDelete.id)).map((playlist) => playlist.id)\n    const trashedSong = { ...songToDelete, trashedAt: Date.now(), trashPlaylistIds: playlistIds }\n    await saveSong(trashedSong)\n    const affected = playlists.filter((playlist) => playlist.songIds.includes(songToDelete.id)).map((playlist) => ({ ...playlist, songIds: playlist.songIds.filter((id) => id !== songToDelete.id) }))\n    if (affected.length) await Promise.all(affected.map(savePlaylist))\n    setPlaylists((items) => items.map((playlist) => affected.find((changed) => changed.id === playlist.id) ?? playlist))\n    setSongs((items) => items.filter((song) => song.id !== songToDelete.id))\n    setTrashedSongs((items) => [trashedSong, ...items.filter((song) => song.id !== trashedSong.id)])\n    if (currentSongId === songToDelete.id) { audioRef.current?.pause(); overlapAudioRef.current?.pause(); setCurrentSongId(null); setCurrentUrl(null); setCurrentTime(0); setDuration(0) }\n    if (loopEditorSongId === songToDelete.id) setLoopEditorSongId(null)\n    setSelectedSongIds((items) => { const next = new Set(items); next.delete(songToDelete.id); return next })\n    setSongToDelete(null)\n  }\n\n  const openLoopEditor"""
app = app[:match.start()] + replacement + app[match.end():]

# Soft-delete playlist.
old = "  const confirmDeletePlaylist = async () => { if (!playlistToDelete) return; recordHistory(); await deletePlaylist(playlistToDelete.id); setPlaylists((items) => items.filter((playlist) => playlist.id !== playlistToDelete.id)); if (activePlaylistId === playlistToDelete.id) navigateTo({ view: 'library', playlistId: null, detailOpen: false }); setPlaylistToDelete(null) }"
new = "  const confirmDeletePlaylist = async () => { if (!playlistToDelete) return; const trashed = { ...playlistToDelete, trashedAt: Date.now() }; await savePlaylist(trashed); setPlaylists((items) => items.filter((playlist) => playlist.id !== playlistToDelete.id)); setTrashedPlaylists((items) => [trashed, ...items.filter((playlist) => playlist.id !== trashed.id)]); if (activePlaylistId === playlistToDelete.id) navigateTo({ view: 'library', playlistId: null, detailOpen: false }); setPlaylistToDelete(null) }"
app = once(app, old, new, 'soft playlist delete')

# Soft-delete selected songs.
pattern = re.compile(r"  const deleteSelectedSongs = async \(\) => \{.*?\n  \}\n  const clearRepeatHold", re.S)
match = pattern.search(app)
if not match: raise SystemExit('Missing deleteSelectedSongs block')
replacement = """  const deleteSelectedSongs = async () => {\n    const ids = new Set(selectedSongIds)\n    if (!ids.size) return\n    const deletedAt = Date.now()\n    const movingToTrash = songs.filter((song) => ids.has(song.id)).map((song) => ({ ...song, trashedAt: deletedAt, trashPlaylistIds: playlists.filter((playlist) => playlist.songIds.includes(song.id)).map((playlist) => playlist.id) }))\n    await Promise.all(movingToTrash.map(saveSong))\n    const affected = playlists.filter((playlist) => playlist.songIds.some((id) => ids.has(id))).map((playlist) => ({ ...playlist, songIds: playlist.songIds.filter((id) => !ids.has(id)) }))\n    if (affected.length) await Promise.all(affected.map(savePlaylist))\n    setPlaylists((items) => items.map((playlist) => affected.find((changed) => changed.id === playlist.id) ?? playlist))\n    setSongs((items) => items.filter((song) => !ids.has(song.id)))\n    setTrashedSongs((items) => [...movingToTrash, ...items.filter((song) => !ids.has(song.id))])\n    if (currentSongId && ids.has(currentSongId)) { audioRef.current?.pause(); overlapAudioRef.current?.pause(); setCurrentSongId(null); setCurrentUrl(null); setCurrentTime(0); setDuration(0) }\n    setSelectionConfirmation(null)\n    stopSelection()\n  }\n  const clearRepeatHold"""
app = app[:match.start()] + replacement + app[match.end():]

# Loop deletion now goes to Trash.
old = "  const removeCurrentLoop = async () => { if (!currentSong) return; await updateSong({ ...currentSong, loopStart: undefined, loopEnd: undefined, loopConfidence: undefined, loopEnabled: false }, true); setLoopConfirmation(null) }"
new = "  const removeCurrentLoop = async () => { if (!currentSong || currentSong.loopStart === undefined || currentSong.loopEnd === undefined) return; await updateSong({ ...currentSong, trashedLoop: { deletedAt: Date.now(), start: currentSong.loopStart, end: currentSong.loopEnd, enabled: Boolean(currentSong.loopEnabled), markers: currentSong.loopMarkers ? [...currentSong.loopMarkers] : undefined }, loopStart: undefined, loopEnd: undefined, loopConfidence: undefined, loopEnabled: false, loopMarkers: undefined }); setLoopConfirmation(null) }"
app = once(app, old, new, 'trash loop')

# Trash helpers + one-time manual sort.
anchor = "  const songEditMode = reorderScope === (activePlaylist ? 'playlist' : 'library') && view === 'library'\n"
insert = """  const restoreTrashedSong = async (song: Song) => {\n    const wantedPlaylists = song.trashPlaylistIds ?? []\n    const activeIds = new Set(playlists.map((playlist) => playlist.id))\n    const remainingIds = wantedPlaylists.filter((id) => !activeIds.has(id))\n    const restored = { ...song, trashedAt: undefined, trashPlaylistIds: remainingIds.length ? remainingIds : undefined }\n    await saveSong(restored)\n    const changedPlaylists = playlists.map((playlist) => wantedPlaylists.includes(playlist.id) && !playlist.songIds.includes(song.id) ? { ...playlist, songIds: [...playlist.songIds, song.id] } : playlist)\n    await Promise.all(changedPlaylists.filter((playlist, index) => playlist !== playlists[index]).map(savePlaylist))\n    setPlaylists(changedPlaylists)\n    setTrashedSongs((items) => items.filter((item) => item.id !== song.id))\n    setSongs((items) => [...items, restored].sort((a, b) => (a.libraryOrder ?? a.addedAt) - (b.libraryOrder ?? b.addedAt)))\n  }\n  const restoreTrashedPlaylist = async (playlist: Playlist) => { const restored = { ...playlist, trashedAt: undefined }; await savePlaylist(restored); setTrashedPlaylists((items) => items.filter((item) => item.id !== playlist.id)); setPlaylists((items) => [restored, ...items]) }\n  const restoreTrashedLoop = async (song: Song) => { if (!song.trashedLoop) return; const loop = song.trashedLoop; await updateSong({ ...song, loopStart: loop.start, loopEnd: loop.end, loopEnabled: loop.enabled, loopMarkers: loop.markers ? [...loop.markers] : undefined, trashedLoop: undefined }); }\n  const emptyTrash = async () => {\n    await Promise.all(trashedSongs.map((song) => deleteSong(song.id)))\n    await Promise.all(trashedPlaylists.map((playlist) => deletePlaylist(playlist.id)))\n    const loopTrashSongs = songs.filter((song) => song.trashedLoop)\n    if (loopTrashSongs.length) await Promise.all(loopTrashSongs.map((song) => saveSong({ ...song, trashedLoop: undefined })))\n    setSongs((items) => items.map((song) => song.trashedLoop ? { ...song, trashedLoop: undefined } : song))\n    setTrashedSongs([]); setTrashedPlaylists([]); setTrashConfirmation(false)\n  }\n  const applyCurrentSortAsManual = async () => {\n    if (view !== 'library' || sortMode === 'manual') { setSortConfirmation(false); return }\n    const source = activePlaylist ? [...manualQueue] : [...songs].sort((a, b) => (a.libraryOrder ?? a.addedAt) - (b.libraryOrder ?? b.addedAt))\n    const direction = sortDirection === 'down' ? 1 : -1\n    const compare = (a: Song, b: Song) => {\n      if (sortMode === 'azStart') return a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' })\n      if (sortMode === 'azEnd') return reverseText(a.name).localeCompare(reverseText(b.name), 'de', { numeric: true, sensitivity: 'base' })\n      if (sortMode === 'plays') return (a.completedPlays ?? 0) - (b.completedPlays ?? 0) || a.name.localeCompare(b.name, 'de')\n      if (sortMode === 'duration') return (a.duration ?? Number.MAX_SAFE_INTEGER) - (b.duration ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'de')\n      return a.addedAt - b.addedAt\n    }\n    const ordered = source.sort((a, b) => compare(a, b) * direction)\n    recordHistory()\n    if (activePlaylist) await updatePlaylist({ ...activePlaylist, songIds: ordered.map((song) => song.id), lastUsedAt: Date.now() })\n    else { const updated = ordered.map((song, index) => ({ ...song, libraryOrder: index })); setSongs(updated); await saveSongOrder(updated) }\n    setSortMode('manual'); setSortConfirmation(false); setSortMenuOpen(false)\n  }\n\n"""
app = once(app, anchor, insert + anchor, 'trash helpers')

app = once(app,
"  const title = view === 'history' ? 'Importverlauf' : view === 'loops' ? 'Loops' : activePlaylist?.name ?? 'Bibliothek'\n",
"  const title = view === 'history' ? 'Importverlauf' : view === 'loops' ? 'Loops' : view === 'trash' ? 'Papierkorb' : activePlaylist?.name ?? 'Bibliothek'\n  const trashCount = trashedSongs.length + trashedPlaylists.length + songs.filter((song) => song.trashedLoop).length\n",
'title trash')

# Sidebar Importverlauf blue x and Trash below Loops.
old = "<span>Importverlauf</span><strong>{newImportCount}/{songs.length}</strong></button>\n      <button className={`nav-item history-nav${view === 'loops' ? ' active' : ''}`} type=\"button\" onClick={() => navigateTo({ view: 'loops', playlistId: null, detailOpen: false })}><span>Loops</span><strong>{songs.filter((song) => song.loopStart !== undefined && song.loopEnd !== undefined).length}</strong></button>"
new = "<span>Importverlauf</span><strong><span className=\"new-count-blue\">{newImportCount}</span>/{songs.length}</strong></button>\n      <button className={`nav-item history-nav${view === 'loops' ? ' active' : ''}`} type=\"button\" onClick={() => navigateTo({ view: 'loops', playlistId: null, detailOpen: false })}><span>Loops</span><strong>{songs.filter((song) => song.loopStart !== undefined && song.loopEnd !== undefined).length}</strong></button>\n      <button className={`nav-item history-nav${view === 'trash' ? ' active' : ''}`} type=\"button\" onClick={() => navigateTo({ view: 'trash', playlistId: null, detailOpen: false })}><span>Papierkorb</span><strong>{trashCount}</strong></button>"
app = once(app, old, new, 'sidebar trash')

# Heading labels/counts and actions.
app = once(app,
"{view === 'history' ? 'IMPORTVERLAUF' : view === 'loops' ? 'GESPEICHERTE LOOPS' : activePlaylist ? 'PLAYLIST' : 'DEINE MUSIK'}",
"{view === 'history' ? 'IMPORTVERLAUF' : view === 'loops' ? 'GESPEICHERTE LOOPS' : view === 'trash' ? 'PAPIERKORB' : activePlaylist ? 'PLAYLIST' : 'DEINE MUSIK'}",
'eyebrow trash')
app = once(app,
"<p>{view === 'history' ? `${newImportCount}/${songs.length} neue Importe` : `${visibleSongs.length} ${visibleSongs.length === 1 ? 'Lied' : 'Lieder'}`}</p>",
"<p>{view === 'history' ? <><span className=\"new-count-blue\">{newImportCount}</span>/{songs.length} neue Importe</> : view === 'trash' ? `${trashCount} ${trashCount === 1 ? 'Eintrag' : 'Einträge'}` : `${visibleSongs.length} ${visibleSongs.length === 1 ? 'Lied' : 'Lieder'}`}</p>",
'heading count')
app = once(app,
"<div className=\"playlist-actions\">{!selectionMode && <button type=\"button\" onClick={startSelection}>Auswählen</button>}",
"<div className=\"playlist-actions\">{!selectionMode && view !== 'trash' && <button type=\"button\" onClick={startSelection}>Auswählen</button>}{view === 'trash' && <button className=\"danger-button\" type=\"button\" onClick={() => setTrashConfirmation(true)} disabled={!trashCount}>Papierkorb leeren</button>}",
'heading trash actions')

# Sort bar with overflow, hidden in trash.
old_sort = """    <div className=\"sort-bar\"><span>Sortierung</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>{(Object.keys(sortLabels) as SortMode[]).map((mode) => <option key={mode} value={mode}>{sortLabels[mode]}</option>)}</select><button type=\"button\" className=\"sort-direction\" disabled={sortMode === 'manual'} onClick={() => setSortDirection((value) => value === 'down' ? 'up' : 'down')}>{sortMode === 'manual' ? '—' : sortDirection === 'down' ? '↓' : '↑'}</button></div>\n"""
new_sort = """    {view !== 'trash' && <div className=\"sort-bar\"><span>Sortierung</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>{(Object.keys(sortLabels) as SortMode[]).map((mode) => <option key={mode} value={mode}>{sortLabels[mode]}</option>)}</select><button type=\"button\" className=\"sort-direction\" disabled={sortMode === 'manual'} onClick={() => setSortDirection((value) => value === 'down' ? 'up' : 'down')}>{sortMode === 'manual' ? '—' : sortDirection === 'down' ? '↓' : '↑'}</button><div className=\"sort-more-wrap\"><button className=\"sort-more-button\" type=\"button\" onClick={() => setSortMenuOpen((value) => !value)} aria-label=\"Weitere Sortieraktionen\">•••</button>{sortMenuOpen && <div className=\"sort-action-menu\"><button type=\"button\" disabled={sortMode === 'manual' || view !== 'library'} onClick={() => { setSortMenuOpen(false); setSortConfirmation(true) }}>Aktuelle Sortierung als Manuell übernehmen</button></div>}</div></div>}\n"""
app = once(app, old_sort, new_sort, 'sort overflow')

# Trash content is a dedicated list instead of normal song list.
needle = "    {visibleSongs.length ? <div className=\"song-list\">"
trash_ui = """    {view === 'trash' ? <div className=\"trash-list\">\n      {trashedSongs.map((song) => <article className=\"trash-item\" key={`trash-song-${song.id}`}><div><small>LIED</small><strong>{song.name}</strong><span>{song.trashedAt ? formatDate(song.trashedAt) : ''}</span></div><button type=\"button\" onClick={() => void restoreTrashedSong(song)}>Wiederherstellen</button></article>)}\n      {trashedPlaylists.map((playlist) => <article className=\"trash-item\" key={`trash-playlist-${playlist.id}`}><div><small>PLAYLIST</small><strong>{playlist.name}</strong><span>{playlist.trashedAt ? formatDate(playlist.trashedAt) : ''}</span></div><button type=\"button\" onClick={() => void restoreTrashedPlaylist(playlist)}>Wiederherstellen</button></article>)}\n      {songs.filter((song) => song.trashedLoop).map((song) => <article className=\"trash-item\" key={`trash-loop-${song.id}`}><div><small>LOOP</small><strong>{song.name}</strong><span>{song.trashedLoop ? `${formatPrecise(song.trashedLoop.start)} – ${formatPrecise(song.trashedLoop.end)}` : ''}</span></div><button type=\"button\" onClick={() => void restoreTrashedLoop(song)}>Wiederherstellen</button></article>)}\n      {!trashCount && <div className=\"empty-state trash-empty\"><div className=\"empty-icon\">⌫</div><h2>Der Papierkorb ist leer.</h2></div>}\n    </div> : visibleSongs.length ? <div className=\"song-list\">"""
app = once(app, needle, trash_ui, 'trash list')

# Add visual group break class to first normal song after new songs.
old_class = "className={`song-row${song.isNew ? ' new-import' : ''}${selectedSongIds.has(song.id) ? ' selected-song' : ''}${repeatSelectionIds.has(song.id) ? ' repeat-selected-song' : ''}`}"
new_class = "className={`song-row${song.isNew ? ' new-import' : ''}${index > 0 && !song.isNew && visibleSongs[index - 1]?.isNew ? ' new-group-break' : ''}${selectedSongIds.has(song.id) ? ' selected-song' : ''}${repeatSelectionIds.has(song.id) ? ' repeat-selected-song' : ''}`}"
app = once(app, old_class, new_class, 'group break class')

# Marker menu: explicit Cursor target.
old = "<div className=\"marker-more-menu\"><button type=\"button\" onClick={() => moveMarkerTarget('focus')} disabled={activeMarker === null}>Zoom hinbewegen</button>"
new = "<div className=\"marker-more-menu\"><button type=\"button\" onClick={() => { if (activeMarker !== null) moveCursorTo(activeMarker, false, true); setLoopEditorMenuOpen(false) }} disabled={activeMarker === null}>Cursor hinbewegen</button><button type=\"button\" onClick={() => moveMarkerTarget('focus')} disabled={activeMarker === null}>Zoom hinbewegen</button>"
app = once(app, old, new, 'marker cursor menu')

# Confirmation modals.
anchor = "    {settingsOpen && <div className=\"modal-backdrop settings-backdrop\""
modals = """    {trashConfirmation && <div className=\"modal-backdrop\" onMouseDown={() => setTrashConfirmation(false)}><div className=\"confirm-dialog\" onMouseDown={(event) => event.stopPropagation()}><h2>Papierkorb endgültig leeren?</h2><p>{trashCount} {trashCount === 1 ? 'Eintrag wird' : 'Einträge werden'} dauerhaft gelöscht. Audiodateien im Papierkorb können danach nicht wiederhergestellt werden.</p><div className=\"dialog-actions\"><button type=\"button\" onClick={() => setTrashConfirmation(false)}>Abbrechen</button><button className=\"danger-button\" type=\"button\" onClick={() => void emptyTrash()}>Endgültig leeren</button></div></div></div>}\n    {sortConfirmation && <div className=\"modal-backdrop\" onMouseDown={() => setSortConfirmation(false)}><div className=\"confirm-dialog\" onMouseDown={(event) => event.stopPropagation()}><h2>Sortierung einmalig übernehmen?</h2><p>Die aktuelle Sortierung „{sortLabels[sortMode]}“ mit der Richtung {sortDirection === 'down' ? '↓' : '↑'} wird als neue manuelle Reihenfolge gespeichert. Danach ändert sie sich nicht automatisch weiter.</p><div className=\"dialog-actions\"><button type=\"button\" onClick={() => setSortConfirmation(false)}>Abbrechen</button><button type=\"button\" onClick={() => void applyCurrentSortAsManual()}>Übernehmen</button></div></div></div>}\n"""
app = once(app, anchor, modals + anchor, 'trash/sort confirmations')

# Delete-dialog wording now reflects Trash.
app = app.replace('und seine lokal gespeicherte Audiodatei werden gelöscht. Der Song wird außerdem aus allen Playlists entfernt.', 'wird in den Papierkorb verschoben und aus allen Playlists entfernt. Die Audiodatei bleibt bis zum Leeren des Papierkorbs wiederherstellbar.')
app = app.replace('>Lied löschen</button>', '>In Papierkorb</button>')
app = app.replace('„{playlistToDelete.name}“ wird gelöscht. Die Musikdateien bleiben erhalten.', '„{playlistToDelete.name}“ wird in den Papierkorb verschoben. Die Musikdateien bleiben erhalten.')
app = app.replace('>Playlist löschen</button>', '>In Papierkorb</button>')
app = app.replace('Die lokalen Audiodateien werden gelöscht und aus allen Playlists entfernt.', 'Die ausgewählten Lieder werden in den Papierkorb verschoben und aus allen Playlists entfernt.')
app = app.replace('>Alle löschen</button></div></div></div>}\n    {renameTarget', '>In Papierkorb</button></div></div></div>}\n    {renameTarget', 1)

app_path.write_text(app)

# musicDb: soft-trash metadata and filtered readers.
db_path = Path('src/musicDb.ts')
db = db_path.read_text()
db = once(db,
"  loopMarkers?: number[]\n}",
"  loopMarkers?: number[]\n  trashedAt?: number\n  trashPlaylistIds?: string[]\n  trashedLoop?: { deletedAt: number; start: number; end: number; enabled: boolean; markers?: number[] }\n}",
'song trash fields')
db = once(db,
"  sortOrder?: number\n}",
"  sortOrder?: number\n  trashedAt?: number\n}",
'playlist trash field')
old_getsongs = re.compile(r"export async function getSongs\(\): Promise<Song\[]> \{.*?\n\}\n\nexport async function saveSongs", re.S)
m = old_getsongs.search(db)
if not m: raise SystemExit('Missing getSongs')
new_getsongs = """async function getAllSongs(): Promise<Song[]> {\n  const db = await openDb()\n  try {\n    const tx = db.transaction([SONGS, SONG_METADATA], 'readonly')\n    const [baseSongs, metadata] = await Promise.all([\n      requestResult(tx.objectStore(SONGS).getAll() as IDBRequest<Song[]>),\n      requestResult(tx.objectStore(SONG_METADATA).getAll() as IDBRequest<SongMetadata[]>),\n    ])\n    const metadataById = new Map(metadata.map((item) => [item.id, item]))\n    return baseSongs\n      .map((song) => ({ ...song, ...(metadataById.get(song.id) ?? {}), file: song.file }))\n      .sort((a, b) => (a.libraryOrder ?? a.addedAt) - (b.libraryOrder ?? b.addedAt))\n  } finally { db.close() }\n}\n\nexport async function getSongs(): Promise<Song[]> { return (await getAllSongs()).filter((song) => !song.trashedAt) }\nexport async function getTrashedSongs(): Promise<Song[]> { return (await getAllSongs()).filter((song) => Boolean(song.trashedAt)).sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0)) }\n\nexport async function saveSongs"""
db = db[:m.start()] + new_getsongs + db[m.end():]
old_playlists = re.compile(r"export async function getPlaylists\(\): Promise<Playlist\[]> \{.*?\n\}\n\nexport async function savePlaylist", re.S)
m = old_playlists.search(db)
if not m: raise SystemExit('Missing getPlaylists')
new_playlists = """async function getAllPlaylists(): Promise<Playlist[]> {\n  const db = await openDb()\n  try {\n    const tx = db.transaction(PLAYLISTS, 'readonly')\n    return await requestResult(tx.objectStore(PLAYLISTS).getAll() as IDBRequest<Playlist[]>)\n  } finally { db.close() }\n}\n\nexport async function getPlaylists(): Promise<Playlist[]> { return (await getAllPlaylists()).filter((playlist) => !playlist.trashedAt) }\nexport async function getTrashedPlaylists(): Promise<Playlist[]> { return (await getAllPlaylists()).filter((playlist) => Boolean(playlist.trashedAt)).sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0)) }\n\nexport async function savePlaylist"""
db = db[:m.start()] + new_playlists + db[m.end():]
db_path.write_text(db)

# CSS additions.
css_path = Path('src/enhancements.css')
css = css_path.read_text()
css += r'''\n\n/* Import groups, sort menu and Trash */\n.new-count-blue { color:#60a5fa; }\n.song-row.new-group-break { margin-top:22px; position:relative; }\n.song-row.new-group-break::before { content:'WEITERE LIEDER'; position:absolute; left:10px; top:-18px; color:#727d8e; font-size:9px; font-weight:900; letter-spacing:.1em; pointer-events:none; }\n.sort-more-wrap { position:relative; }\n.sort-more-button { width:38px; height:38px; padding:0; border:1px solid #343b49; border-radius:10px; background:#171b24; color:#cbd5e1; font-weight:900; cursor:pointer; }\n.sort-action-menu { position:absolute; z-index:145; top:44px; right:0; width:min(300px,80vw); padding:6px; border:1px solid #3a4050; border-radius:12px; background:#171b24; box-shadow:0 16px 45px rgba(0,0,0,.45); }\n.sort-action-menu button { width:100%; min-height:42px; padding:0 11px; border:0; border-radius:8px; background:transparent; text-align:left; cursor:pointer; }\n.sort-action-menu button:not(:disabled):hover { background:#252a36; }\n.trash-list { display:grid; gap:10px; padding-bottom:26px; }\n.trash-item { display:flex; align-items:center; justify-content:space-between; gap:18px; padding:14px 15px; border:1px solid #343b49; border-radius:13px; background:#141820; }\n.trash-item > div { display:grid; min-width:0; gap:3px; }\n.trash-item small { color:#8d96a6; font-size:9px; font-weight:900; letter-spacing:.12em; }\n.trash-item strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }\n.trash-item span { color:#8d96a6; font-size:11px; }\n.trash-item > button { flex:0 0 auto; min-height:38px; padding:0 11px; border:1px solid #3b4352; border-radius:9px; background:#1b202a; cursor:pointer; }\n.trash-empty { margin-top:24px; }\n@media (max-width:620px) { .trash-item { align-items:flex-start; flex-direction:column; } .trash-item > button { width:100%; } }\n'''
css_path.write_text(css)

# Docs.
arch_path = Path('architecture.md')
arch = arch_path.read_text()
arch = arch.replace('Der frühere Tab „Verlauf“ heißt „Importverlauf“. Er zeigt nur blau markierte, noch nicht als gelesen markierte Importe. Die Navigation zeigt `x/y`: x sind aktuell blaue Importe, y ist die Gesamtzahl aller importierten Songs.', 'Der frühere Tab „Verlauf“ heißt „Importverlauf“. Er zeigt alle aktiven Songs. Die Navigation zeigt `x/y`: x sind aktuell blau markierte neue Importe, y ist die Gesamtzahl aller aktiven Songs. Die Zahl x ist blau. In allen Songlisten werden blau markierte Songs als temporäre obere Gruppe von normalen Songs getrennt; innerhalb beider Gruppen gilt dieselbe gewählte Sortierung. Nach „Als gelesen markieren“ fällt der Song zurück in die normale Gruppe.')
arch = arch.replace('Alle Songlisten unterstützen `Manuell`, `A–Z Anfang`, `A–Z Ende`, `Anzahl des Hörens`, `Dauer` und `Chronik`. Die Sortieransicht verändert die manuelle Reihenfolge nicht. Die gewählte Ansicht und Richtung werden in `localStorage` gespeichert.', 'Alle Songlisten unterstützen `Manuell`, `A–Z Anfang`, `A–Z Ende`, `Anzahl des Hörens`, `Dauer` und `Chronik`. Die Sortieransicht verändert die manuelle Reihenfolge nicht. Die gewählte Ansicht und Richtung werden in `localStorage` gespeichert. Neben Sortierbox und Richtungspfeil liegt ein `•••`. In Bibliothek bzw. geöffneter Playlist kann die aktuelle nicht-manuelle Sortierung inklusive Pfeilrichtung nach Bestätigung einmalig als neue manuelle Reihenfolge gespeichert werden; danach wird auf Manuell gewechselt und es gibt keine automatische Nachsortierung.')
arch = arch.replace('## Löschen und Undo/Redo\n\nSong- und Playlist-Löschen verwenden Bestätigungsdialoge.', '## Papierkorb, Löschen und Undo/Redo\n\nUnter Loops liegt ein Papierkorb. Song- und Playlist-Löschen verwenden Bestätigungsdialoge und verschieben die Objekte zunächst nur in diesen lokalen Papierkorb. Der Song-Blob bleibt dabei im bestehenden Song-Store; Playlists werden per `trashedAt` ausgeblendet. Gelöschte Loops bleiben als kleine `trashedLoop`-Metadaten am Song erhalten. Alle drei Typen können einzeln wiederhergestellt werden. Erst „Papierkorb leeren“ entfernt nach erneuter Bestätigung Songs/Blobs und Playlists endgültig bzw. verwirft gelöschte Loop-Metadaten. Normale Löschaktionen werden deshalb nicht zusätzlich in den Undo-Verlauf geschrieben.\n\nSong- und Playlist-Löschen verwenden Bestätigungsdialoge.')
arch = arch.replace('Eine ausgewählte Markierung kann über `•••` zum Zoom-Fokus, zum Loop-Anfang oder zum Loop-Ende übertragen oder einzeln gelöscht werden.', 'Eine ausgewählte Markierung kann über `•••` direkt zum Cursor, zum Zoom-Fokus, zum Loop-Anfang oder zum Loop-Ende übertragen oder einzeln gelöscht werden.')
arch_path.write_text(arch)

concept_path = Path('concept.md')
concept = concept_path.read_text()
concept = concept.replace('Der frühere „Verlauf“-Tab heißt **Importverlauf**. Er zeigt die aktuell blau markierten neuen Importe. In der Navigation steht **x/y**: x ist die Zahl der blauen Importe, y die Gesamtzahl aller importierten Songs.', 'Der frühere „Verlauf“-Tab heißt **Importverlauf** und zeigt alle aktiven Songs. In der Navigation steht **x/y**: x ist die blau dargestellte Zahl der noch blau markierten neuen Importe, y die Gesamtzahl aller aktiven Songs. Blau markierte Songs bilden in allen Songlisten vorübergehend eine eigene obere Gruppe; normale Songs stehen darunter. Beide Gruppen werden mit derselben gewählten Sortierung sortiert. Nach „Als gelesen markieren“ verlässt ein Song die blaue Gruppe.')
concept = concept.replace('Der Pfeil kehrt die Sortierung um. Die manuelle Reihenfolge bleibt separat gespeichert und wird durch andere Sortierungen nicht verändert.', 'Der Pfeil kehrt die Sortierung um. Die manuelle Reihenfolge bleibt separat gespeichert und wird durch andere Sortierungen nicht verändert. Über `•••` neben der Sortierung kann eine aktuelle nicht-manuelle Reihenfolge inklusive Pfeilrichtung nach Bestätigung **einmalig** als neue manuelle Reihenfolge übernommen werden. Danach bleibt sie statisch.')
concept = concept.replace('## Präziser Loop-Editor', '## Papierkorb\n\nUnter Loops gibt es einen Papierkorb. Gelöschte Songs, Playlists und Loops landen zunächst dort und können einzeln wiederhergestellt werden. Bei Songs bleibt die lokale Audiodatei bis zum endgültigen Leeren erhalten. „Papierkorb leeren“ verlangt eine erneute Sicherheitsabfrage und entfernt die dortigen Einträge endgültig.\n\n## Präziser Loop-Editor')
concept = concept.replace('Das `•••` enthält weiterhin „Zoom hinbewegen“, „Loop-Anfang hinbewegen“, „Loop-Ende hinbewegen“ und „Markierung löschen“.', 'Das `•••` enthält „Cursor hinbewegen“, „Zoom hinbewegen“, „Loop-Anfang hinbewegen“, „Loop-Ende hinbewegen“ und „Markierung löschen“.')
concept_path.write_text(concept)
