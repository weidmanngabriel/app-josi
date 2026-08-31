from pathlib import Path
import re


def once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1, found {count}')
    return text.replace(old, new, 1)


def regex_once(text, pattern, replacement, label):
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 regex match, found {count}')
    return updated

app_path = Path('src/App.tsx')
app = app_path.read_text()

app = once(app,
"type LoopConfirmation = 'save' | 'delete' | 'deleteMarkers' | null\n",
"type LoopConfirmation = 'save' | 'delete' | 'deleteMarkers' | null\n"
"type SelectionConfirmation = 'switchManual' | 'deleteSelected' | null\n",
'add selection confirmation type')

app = once(app,
"const LOOP_PREVIEW_OPTIONS = [0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5, 10] as const\n",
"const LOOP_PREVIEW_OPTIONS = [0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5, 10] as const\n"
"const SEEK_SECOND_OPTIONS = [5, 10, 15, 30, 60] as const\n"
"const LOOP_TAIL_SECONDS = 1\n",
'add settings constants')

app = once(app,
"  const [sortDirection, setSortDirection] = useState<SortDirection>(() => (localStorage.getItem('josi-sort-direction') as SortDirection) || 'down')\n\n",
"  const [sortDirection, setSortDirection] = useState<SortDirection>(() => (localStorage.getItem('josi-sort-direction') as SortDirection) || 'down')\n"
"  const [settingsOpen, setSettingsOpen] = useState(false)\n"
"  const [seekSeconds, setSeekSeconds] = useState(() => Number(localStorage.getItem('josi-seek-seconds')) || 10)\n"
"  const [loopTailMasterEnabled, setLoopTailMasterEnabled] = useState(() => localStorage.getItem('josi-loop-tail-master') !== 'false')\n"
"  const [selectionMenuOpen, setSelectionMenuOpen] = useState(false)\n"
"  const [bulkMoveMode, setBulkMoveMode] = useState(false)\n"
"  const [selectionConfirmation, setSelectionConfirmation] = useState<SelectionConfirmation>(null)\n\n",
'add global UI states')

app = once(app,
"  useEffect(() => { localStorage.setItem('josi-sort-direction', sortDirection) }, [sortDirection])\n\n",
"  useEffect(() => { localStorage.setItem('josi-sort-direction', sortDirection) }, [sortDirection])\n"
"  useEffect(() => { localStorage.setItem('josi-seek-seconds', String(seekSeconds)) }, [seekSeconds])\n"
"  useEffect(() => { localStorage.setItem('josi-loop-tail-master', String(loopTailMasterEnabled)) }, [loopTailMasterEnabled])\n\n",
'persist settings')

app = once(app,
"  const parsedLoopPlaybackRate = Math.max(.05, Math.min(50, Number.parseFloat(loopPlaybackRate.replace(',', '.')) || 1))\n\n",
"  const parsedLoopPlaybackRate = Math.max(.05, Math.min(50, Number.parseFloat(loopPlaybackRate.replace(',', '.')) || 1))\n"
"  const isLoopTailActive = (song: Song | null) => Boolean(song && loopTailMasterEnabled && song.loopTailEnabled !== false)\n\n",
'add loop tail helper')

playback_effect = """  useEffect(() => {\n    const audio = audioRef.current\n    if (!audio) return\n    audio.playbackRate = loopEditorSongId ? parsedLoopPlaybackRate : 1\n  }, [loopEditorSongId, parsedLoopPlaybackRate, currentUrl])\n\n"""
loop_frame_effect = playback_effect + """  useEffect(() => {\n    if (!isPlaying) return\n    let frame = 0\n    const tick = () => {\n      const audio = audioRef.current\n      const song = currentSong\n      if (audio && song && !audio.paused) {\n        if (loopEditorSongId === song.id && cursorLoopEnabled && loopDraftEnd > loopDraftStart && audio.currentTime >= loopDraftEnd) {\n          audio.currentTime = loopDraftStart\n          setCurrentTime(loopDraftStart)\n          setLoopCursor(loopDraftStart)\n        } else if (!loopEditorSongId && song.loopEnabled && song.loopStart !== undefined && song.loopEnd !== undefined) {\n          const tail = isLoopTailActive(song) ? LOOP_TAIL_SECONDS : 0\n          const naturalEnd = Number.isFinite(audio.duration) && audio.duration > 0 ? Math.max(song.loopStart + .02, audio.duration - .02) : song.loopEnd + tail\n          const boundary = Math.min(song.loopEnd + tail, naturalEnd)\n          if (audio.currentTime >= boundary) {\n            audio.currentTime = song.loopStart\n            setCurrentTime(song.loopStart)\n          }\n        }\n      }\n      frame = requestAnimationFrame(tick)\n    }\n    frame = requestAnimationFrame(tick)\n    return () => cancelAnimationFrame(frame)\n  }, [isPlaying, currentSong?.id, currentSong?.loopEnabled, currentSong?.loopStart, currentSong?.loopEnd, currentSong?.loopTailEnabled, loopTailMasterEnabled, loopEditorSongId, cursorLoopEnabled, loopDraftStart, loopDraftEnd])\n\n"""
app = once(app, playback_effect, loop_frame_effect, 'add animation-frame loop monitor')

app = once(app,
"  const navigateForward = () => { if (navigationIndex >= navigation.length - 1) return; const next = navigationIndex + 1; setNavigationIndex(next); applyNavigation(navigation[next]) }\n\n",
"  const navigateForward = () => { if (navigationIndex >= navigation.length - 1) return; const next = navigationIndex + 1; setNavigationIndex(next); applyNavigation(navigation[next]) }\n"
"  const goHome = () => { setSettingsOpen(false); navigateTo({ view: 'library', playlistId: null, detailOpen: false }) }\n\n",
'add home navigation')

app = once(app,
"      ['seekbackward', (event) => skipSeconds(-(event.seekOffset ?? 10))], ['seekforward', (event) => skipSeconds(event.seekOffset ?? 10)], ['seekto', (event) => event.seekTime !== undefined && seek(event.seekTime)],\n",
"      ['seekbackward', (event) => skipSeconds(-(event.seekOffset ?? seekSeconds))], ['seekforward', (event) => skipSeconds(event.seekOffset ?? seekSeconds)], ['seekto', (event) => event.seekTime !== undefined && seek(event.seekTime)],\n",
'media session seek setting')
app = once(app,
"  }, [currentSong?.id, isPlaying, playerQueue, shuffle, repeatQueue, currentTime, duration])\n",
"  }, [currentSong?.id, isPlaying, playerQueue, shuffle, repeatQueue, currentTime, duration, seekSeconds])\n",
'media session dependencies')

app = once(app,
"  const startSelection = () => { setSelectionMode(true); setSelectedSongIds(new Set()) }\n  const stopSelection = () => { setSelectionMode(false); setSelectedSongIds(new Set()); setPlaylistChooserMode(null) }\n",
"  const startSelection = () => { setSelectionMode(true); setSelectedSongIds(new Set()); setSelectionMenuOpen(false); setBulkMoveMode(false) }\n"
"  const stopSelection = () => { setSelectionMode(false); setSelectedSongIds(new Set()); setPlaylistChooserMode(null); setSelectionMenuOpen(false); setBulkMoveMode(false); setSelectionConfirmation(null) }\n"
"  const beginSelectedMove = () => {\n"
"    setSelectionMenuOpen(false)\n"
"    if (!selectedSongIds.size || view !== 'library') return\n"
"    if (sortMode !== 'manual') { setSelectionConfirmation('switchManual'); return }\n"
"    setBulkMoveMode(true)\n"
"  }\n"
"  const moveSelectedToIndex = async (targetIndex: number) => {\n"
"    if (!bulkMoveMode || !selectedSongIds.size || view !== 'library') return\n"
"    const sourceIds = activePlaylist ? [...activePlaylist.songIds] : manualQueue.map((song) => song.id)\n"
"    const moving = sourceIds.filter((id) => selectedSongIds.has(id))\n"
"    if (!moving.length) return\n"
"    const removedBeforeTarget = sourceIds.slice(0, targetIndex).filter((id) => selectedSongIds.has(id)).length\n"
"    const remaining = sourceIds.filter((id) => !selectedSongIds.has(id))\n"
"    const insertAt = Math.max(0, Math.min(remaining.length, targetIndex - removedBeforeTarget))\n"
"    const nextIds = [...remaining.slice(0, insertAt), ...moving, ...remaining.slice(insertAt)]\n"
"    if (activePlaylist) {\n"
"      await updatePlaylist({ ...activePlaylist, songIds: nextIds, lastUsedAt: Date.now() }, true)\n"
"    } else {\n"
"      recordHistory()\n"
"      const byId = new Map(songs.map((song) => [song.id, song]))\n"
"      const updated = nextIds.map((id, index) => ({ ...byId.get(id)!, libraryOrder: index }))\n"
"      setSongs(updated)\n"
"      await saveSongOrder(updated)\n"
"    }\n"
"    setBulkMoveMode(false)\n"
"  }\n"
"  const renderBulkMoveDropZone = (index: number) => !bulkMoveMode ? null : <button className=\"drop-zone bulk-move-zone\" type=\"button\" onClick={() => void moveSelectedToIndex(index)} aria-label=\"Auswahl hierhin bewegen\"><span /></button>\n"
"  const deleteSelectedSongs = async () => {\n"
"    const ids = new Set(selectedSongIds)\n"
"    if (!ids.size) return\n"
"    recordHistory()\n"
"    await Promise.all([...ids].map(deleteSong))\n"
"    const affected = playlists.filter((playlist) => playlist.songIds.some((id) => ids.has(id))).map((playlist) => ({ ...playlist, songIds: playlist.songIds.filter((id) => !ids.has(id)) }))\n"
"    if (affected.length) await Promise.all(affected.map(savePlaylist))\n"
"    setPlaylists((items) => items.map((playlist) => affected.find((changed) => changed.id === playlist.id) ?? playlist))\n"
"    setSongs((items) => items.filter((song) => !ids.has(song.id)))\n"
"    if (currentSongId && ids.has(currentSongId)) { audioRef.current?.pause(); setCurrentSongId(null); setCurrentUrl(null); setCurrentTime(0); setDuration(0) }\n"
"    setSelectionConfirmation(null)\n"
"    stopSelection()\n"
"  }\n",
'bulk selection actions')

app = once(app,
"  const toggleSongLoop = async (id: string) => { const song = songs.find((item) => item.id === id); if (!song || song.loopStart === undefined || song.loopEnd === undefined) return; await updateSong({ ...song, loopEnabled: !song.loopEnabled }, true); setOverflowMenu(null) }\n  const toggleCurrentLoop = async () => { if (!currentSong || currentSong.loopStart === undefined || currentSong.loopEnd === undefined) return; await updateSong({ ...currentSong, loopEnabled: !currentSong.loopEnabled }, true) }\n",
"  const toggleSongLoop = async (id: string) => { const song = songs.find((item) => item.id === id); if (!song || song.loopStart === undefined || song.loopEnd === undefined) return; await updateSong({ ...song, loopEnabled: !song.loopEnabled }, true); setOverflowMenu(null) }\n"
"  const toggleSongLoopTail = async (id: string) => { const song = songs.find((item) => item.id === id); if (!song || song.loopStart === undefined || song.loopEnd === undefined || !loopTailMasterEnabled) return; await updateSong({ ...song, loopTailEnabled: song.loopTailEnabled === false }, true); setOverflowMenu(null) }\n"
"  const toggleCurrentLoop = async () => { if (!currentSong || currentSong.loopStart === undefined || currentSong.loopEnd === undefined) return; await updateSong({ ...currentSong, loopEnabled: !currentSong.loopEnabled }, true) }\n"
"  const toggleCurrentLoopTail = async () => { if (!currentSong || currentSong.loopStart === undefined || currentSong.loopEnd === undefined || !loopTailMasterEnabled) return; await updateSong({ ...currentSong, loopTailEnabled: currentSong.loopTailEnabled === false }, true) }\n",
'toggle loop tail')

# Remove low-frequency loop switching from timeupdate. rAF monitor now owns loop boundaries.
app = regex_once(app,
r"onTimeUpdate=\{\(event\) => \{ const audio = event\.currentTarget; const song = currentSong; if \(loopEditorSongId === song\?\.id && cursorLoopEnabled && loopDraftEnd > loopDraftStart && audio\.currentTime >= loopDraftEnd\) audio\.currentTime = loopDraftStart; else if \(!loopEditorSongId && song\?\.loopEnabled && song\.loopStart !== undefined && song\.loopEnd !== undefined && audio\.currentTime >= song\.loopEnd\) audio\.currentTime = song\.loopStart; setCurrentTime\(audio\.currentTime\); if \(loopEditorSongId\) setLoopCursor\(audio\.currentTime\) \}\}",
"onTimeUpdate={(event) => { const audio = event.currentTarget; setCurrentTime(audio.currentTime); if (loopEditorSongId) setLoopCursor(audio.currentTime) }}",
'replace timeupdate loop logic')

# Header: Home, settings, then back/forward.
app = once(app,
"      <div className=\"history-controls\" aria-label=\"Navigation und Verlauf\"><button type=\"button\" onClick={navigateBack}",
"      <div className=\"history-controls\" aria-label=\"Navigation und Verlauf\"><button className=\"home-button\" type=\"button\" onClick={goHome} aria-label=\"Bibliothek\">⌂</button><button className=\"settings-button\" type=\"button\" onClick={() => setSettingsOpen(true)} aria-label=\"Einstellungen\">⚙</button><button type=\"button\" onClick={navigateBack}",
'header home settings')

# Main transport: seek instead of track previous/next.
app = once(app,
"<button className={shuffle ? 'active-control' : ''} onClick={() => setShuffle((value) => !value)}>⇄</button><button onClick={() => moveSong(-1)}>⏮</button><button className=\"play-button\" onClick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button><button onClick={() => moveSong(1)}>⏭</button><button className={repeatQueue || repeatSelectionIds.size ? 'active-control repeat-control' : 'repeat-control'}",
"<button className={shuffle ? 'active-control' : ''} onClick={() => setShuffle((value) => !value)}>⇄</button><button onClick={() => skipSeconds(-seekSeconds)} aria-label={`${seekSeconds} Sekunden zurück`}>⏪</button><button className=\"play-button\" onClick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button><button onClick={() => skipSeconds(seekSeconds)} aria-label={`${seekSeconds} Sekunden vor`}>⏩</button><button className={repeatQueue || repeatSelectionIds.size ? 'active-control repeat-control' : 'repeat-control'}",
'main seek controls')

# Bottom selection tools beside Alle Playlists.
app = once(app,
"      <div className=\"quick-playlists\"><button className=\"all-playlists-button\" type=\"button\" onClick={() => setPlaylistChooserMode(selectionMode ? 'bulk' : 'current')} disabled={selectionMode ? !selectedSongIds.size : !currentSong}><span>Alle Playlists</span><strong>›</strong></button></div>\n",
"      <div className={`quick-playlists${selectionMode ? ' selection-tools' : ''}`}><button className=\"all-playlists-button\" type=\"button\" onClick={() => setPlaylistChooserMode(selectionMode ? 'bulk' : 'current')} disabled={selectionMode ? !selectedSongIds.size : !currentSong}><span>Alle Playlists</span><strong>›</strong></button>{selectionMode && <div className=\"selection-more-wrap\"><button className=\"selection-more-button\" type=\"button\" onClick={() => setSelectionMenuOpen((value) => !value)} aria-label=\"Weitere Auswahlaktionen\">•••</button>{selectionMenuOpen && <><button className=\"selection-menu-shield\" type=\"button\" onClick={() => setSelectionMenuOpen(false)} /><div className=\"selection-action-menu\"><button type=\"button\" disabled>Gruppieren</button><button type=\"button\" onClick={beginSelectedMove} disabled={!selectedSongIds.size || view !== 'library'}>Bewegen</button><button type=\"button\" disabled>Tags</button><button className=\"danger-menu-action\" type=\"button\" onClick={() => { setSelectionMenuOpen(false); setSelectionConfirmation('deleteSelected') }} disabled={!selectedSongIds.size}>Alle löschen</button></div></>}</div>}</div>\n",
'selection bottom menu')

# Bulk move zones in current song list.
app = once(app,
"{visibleSongs.length ? <div className=\"song-list\">{renderDropZone(0, 'song')}{visibleSongs.map",
"{visibleSongs.length ? <div className=\"song-list\">{bulkMoveMode ? renderBulkMoveDropZone(0) : renderDropZone(0, 'song')}{visibleSongs.map",
'bulk first drop zone')
app = once(app,
"{renderDropZone(index + 1, 'song')}</div>)}</div>",
"{bulkMoveMode ? renderBulkMoveDropZone(index + 1) : renderDropZone(index + 1, 'song')}</div>)}</div>",
'bulk row drop zones')

# Selection hint mentions move mode.
app = once(app,
"{selectionMode && <div className=\"selection-hint\">{selectedSongIds.size} ausgewählt. Die Zuordnung erfolgt unten rechts über „Alle Playlists“.</div>}",
"{selectionMode && <div className=\"selection-hint\">{bulkMoveMode ? 'Zielposition in der Liste antippen.' : `${selectedSongIds.size} ausgewählt. Playlists und weitere Aktionen findest du unten rechts.`}</div>}",
'selection hint')

# Detail controls: shuffle and repeat outside existing controls; use configured seek width.
old_detail = "<div className=\"detail-controls\"><button onClick={playPreviousFromHistory} disabled={!playHistory.length}>⏮</button><button onClick={() => skipSeconds(-10)}>↶<small>10</small></button><button className=\"detail-play\" onClick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button><button onClick={() => skipSeconds(10)}>↷<small>10</small></button><button onClick={() => moveSong(1)}>⏭</button></div>"
new_detail = "<div className=\"detail-controls detail-controls-expanded\"><button className={shuffle ? 'active-control' : ''} onClick={() => setShuffle((value) => !value)} aria-label=\"Shuffle\">⇄</button><button onClick={playPreviousFromHistory} disabled={!playHistory.length}>⏮</button><button onClick={() => skipSeconds(-seekSeconds)}>↶<small>{seekSeconds}</small></button><button className=\"detail-play\" onClick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button><button onClick={() => skipSeconds(seekSeconds)}>↷<small>{seekSeconds}</small></button><button onClick={() => moveSong(1)}>⏭</button><button className={repeatQueue || repeatSelectionIds.size ? 'active-control repeat-control' : 'repeat-control'} onPointerDown={beginRepeatHold} onPointerUp={endRepeatHold} onPointerCancel={endRepeatHold} onContextMenu={(event) => event.preventDefault()} onClick={handleRepeatClick} aria-label={repeatSelectionIds.size ? 'Ausgewählte Lieder wiederholen' : 'Liste wiederholen'}><span className={`repeat-symbol${repeatSelectionIds.size ? ' repeat-one-symbol' : ''}`}>↻{repeatSelectionIds.size > 0 && <b>1</b>}</span></button></div>"
app = once(app, old_detail, new_detail, 'detail player expansion')

# Detail loop strip: add tail toggle beside loop enabled button.
app = once(app,
"<button className={currentSong.loopEnabled ? 'loop-active' : ''} type=\"button\" onClick={() => void toggleCurrentLoop()}>{currentSong.loopEnabled ? 'Loop aktiv' : 'Loop aktivieren'}</button><button className=\"danger-button\"",
"<button className={currentSong.loopEnabled ? 'loop-active' : ''} type=\"button\" onClick={() => void toggleCurrentLoop()}>{currentSong.loopEnabled ? 'Loop aktiv' : 'Loop aktivieren'}</button><button className={isLoopTailActive(currentSong) ? 'loop-tail-active' : ''} type=\"button\" onClick={() => void toggleCurrentLoopTail()} disabled={!loopTailMasterEnabled}>{!loopTailMasterEnabled ? 'Auslauf global aus' : isLoopTailActive(currentSong) ? 'Auslauf +1 s aktiv' : 'Auslauf +1 s aktivieren'}</button><button className=\"danger-button\"",
'detail loop tail')

# Loop editor navigation gets Home + settings too.
app = once(app,
"<div className=\"loop-command-history\" aria-label=\"Editor Navigation\"><button type=\"button\" onClick={() => setLoopEditorSongId(null)} aria-label=\"Zurück\">‹</button>",
"<div className=\"loop-command-history\" aria-label=\"Editor Navigation\"><button type=\"button\" onClick={goHome} aria-label=\"Bibliothek\">⌂</button><button type=\"button\" onClick={() => setSettingsOpen(true)} aria-label=\"Einstellungen\">⚙</button><button type=\"button\" onClick={() => setLoopEditorSongId(null)} aria-label=\"Zurück\">‹</button>",
'editor home settings')

# Song overflow: tail option directly under Loop erstellen/bearbeiten.
app = once(app,
"<button type=\"button\" onClick={() => openLoopEditor(song.id)}>{song.loopStart !== undefined ? 'Loop bearbeiten' : 'Loop erstellen'}</button>{song.loopStart !== undefined && song.loopEnd !== undefined && <button type=\"button\" onClick={() => void toggleSongLoop(song.id)}>{song.loopEnabled ? 'Loop deaktivieren' : 'Loop aktivieren'}</button>}",
"<button type=\"button\" onClick={() => openLoopEditor(song.id)}>{song.loopStart !== undefined ? 'Loop bearbeiten' : 'Loop erstellen'}</button>{song.loopStart !== undefined && song.loopEnd !== undefined && <><button type=\"button\" onClick={() => void toggleSongLoopTail(song.id)} disabled={!loopTailMasterEnabled}>{!loopTailMasterEnabled ? 'Loop-Auslauf global aus' : isLoopTailActive(song) ? 'Loop-Auslauf deaktivieren' : 'Loop-Auslauf aktivieren'}</button><button type=\"button\" onClick={() => void toggleSongLoop(song.id)}>{song.loopEnabled ? 'Loop deaktivieren' : 'Loop aktivieren'}</button></>}",
overflow loop tail')

# Insert settings and selection confirmations before rename dialog.
anchor = "    {renameTarget && <div className=\"modal-backdrop\""
insert = """    {settingsOpen && <div className=\"modal-backdrop settings-backdrop\" onMouseDown={() => setSettingsOpen(false)}><div className=\"confirm-dialog settings-dialog\" onMouseDown={(event) => event.stopPropagation()}><h2>Einstellungen</h2><div className=\"settings-row\"><div><strong>Spulweite</strong><small>Für ⏪/⏩ und die Detailansicht.</small></div><select value={seekSeconds} onChange={(event) => setSeekSeconds(Number(event.target.value))}>{SEEK_SECOND_OPTIONS.map((value) => <option key={value} value={value}>{value} Sekunden</option>)}</select></div><div className=\"settings-row\"><div><strong>Loop-Auslauf +1 s</strong><small>Master-Schalter für alle Songs. Kann die hörbare Lücke beim Zurückspringen kaschieren.</small></div><button className={`settings-switch${loopTailMasterEnabled ? ' on' : ''}`} type=\"button\" onClick={() => setLoopTailMasterEnabled((value) => !value)} aria-label=\"Loop-Auslauf für alle Songs umschalten\"><i /></button></div><div className=\"dialog-actions\"><button type=\"button\" onClick={() => setSettingsOpen(false)}>Fertig</button></div></div></div>}\n"
"    {selectionConfirmation === 'switchManual' && <div className=\"modal-backdrop selection-confirm-backdrop\" onMouseDown={() => setSelectionConfirmation(null)}><div className=\"confirm-dialog\" onMouseDown={(event) => event.stopPropagation()}><h2>Auf „Manuell“ umschalten?</h2><p>Ausgewählte Lieder können nur innerhalb der gespeicherten manuellen Reihenfolge bewegt werden.</p><div className=\"dialog-actions\"><button type=\"button\" onClick={() => setSelectionConfirmation(null)}>Nein</button><button type=\"button\" onClick={() => { setSortMode('manual'); setSelectionConfirmation(null); setBulkMoveMode(true) }}>Ja, umschalten</button></div></div></div>}\n"
"    {selectionConfirmation === 'deleteSelected' && <div className=\"modal-backdrop selection-confirm-backdrop\" onMouseDown={() => setSelectionConfirmation(null)}><div className=\"confirm-dialog\" onMouseDown={(event) => event.stopPropagation()}><h2>{selectedSongIds.size} ausgewählte Lieder löschen?</h2><p>Die lokalen Audiodateien werden gelöscht und aus allen Playlists entfernt.</p><div className=\"dialog-actions\"><button type=\"button\" onClick={() => setSelectionConfirmation(null)}>Abbrechen</button><button className=\"danger-button\" type=\"button\" onClick={() => void deleteSelectedSongs()}>Alle löschen</button></div></div></div>}\n"
"""
if anchor not in app:
    raise SystemExit('modal insertion anchor missing')
app = app.replace(anchor, insert + anchor, 1)

app_path.write_text(app)

# musicDb: per-song loop tail metadata
mdb_path = Path('src/musicDb.ts')
mdb = mdb_path.read_text()
mdb = once(mdb,
"  loopEnabled?: boolean\n  loopConfidence?: number\n",
"  loopEnabled?: boolean\n  loopTailEnabled?: boolean\n  loopConfidence?: number\n",
'music db loop tail field')
mdb_path.write_text(mdb)

# CSS additions
css_path = Path('src/enhancements.css')
css = css_path.read_text()
css += r'''

/* Home/settings, selection overflow, settings prototype */
.history-controls .home-button,
.history-controls .settings-button { font-size: 20px; }
.quick-playlists.selection-tools { position: relative; display: flex; align-items: center; gap: 9px; }
.quick-playlists.selection-tools .all-playlists-button { min-width: 0; flex: 1; }
.selection-more-wrap { position: relative; flex: 0 0 auto; }
.selection-more-button { display: grid; place-items: center; width: 48px; height: 48px; padding: 0; border: 1px solid #3b4354; border-radius: 50%; background: #171c27; color: #cbd5e1; font-weight: 900; letter-spacing: 1px; cursor: pointer; }
.selection-menu-shield { position: fixed; inset: 0; z-index: 158; border: 0; background: transparent; }
.selection-action-menu { position: absolute; right: 0; bottom: 58px; z-index: 159; display: grid; width: 210px; padding: 6px; border: 1px solid #3b4352; border-radius: 13px; background: #171b24; box-shadow: 0 18px 50px rgba(0,0,0,.5); }
.selection-action-menu button { min-height: 42px; padding: 0 12px; border: 0; border-radius: 8px; background: transparent; text-align: left; cursor: pointer; }
.selection-action-menu button:not(:disabled):hover { background: #252a36; }
.selection-action-menu .danger-menu-action { color: #f87171; }
.bulk-move-zone { height: 20px; margin: -4px 0; }
.bulk-move-zone span { top: 8px; height: 3px; background: #a78bfa; box-shadow: 0 0 0 1px rgba(167,139,250,.18); }
.settings-backdrop, .selection-confirm-backdrop { z-index: 220 !important; }
.settings-dialog { width: min(520px, calc(100vw - 28px)); }
.settings-row { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 15px 0; border-bottom: 1px solid #2b313d; }
.settings-row > div { display: grid; gap: 4px; min-width: 0; }
.settings-row small { color: #8d96a6; line-height: 1.35; }
.settings-row select { min-height: 40px; padding: 0 34px 0 10px; border: 1px solid #3b4352; border-radius: 10px; background: #11161f; color: #fff; }
.settings-switch { position: relative; flex: 0 0 48px; width: 48px; height: 28px; padding: 0; border: 1px solid #4b5563; border-radius: 999px; background: #242b36; cursor: pointer; }
.settings-switch i { position: absolute; top: 4px; left: 4px; width: 18px; height: 18px; border-radius: 50%; background: #9ca3af; transition: transform .14s ease; }
.settings-switch.on { border-color: #ef4444; background: #7f1d1d; }
.settings-switch.on i { transform: translateX(20px); background: #fff; }
.loop-actions .loop-tail-active { border-color: #b45309; background: #3b2513; color: #fed7aa; }
.detail-controls-expanded { flex-wrap: wrap; }
.detail-controls-expanded .active-control { border-color: #7657d7; background: #2b2148; color: white; }
@media (max-width: 720px) {
  .settings-row { align-items: flex-start; flex-direction: column; }
  .settings-row select { width: 100%; }
}
'''
css_path.write_text(css)

# Architecture docs
arch_path = Path('architecture.md')
arch = arch_path.read_text()
arch = once(arch,
"- `loopEnabled`\n- `loopMarkers` für orange Hilfsmarkierungen im Loop-Editor\n",
"- `loopEnabled`\n- `loopTailEnabled` als optionale Song-Ausnahme für den einsekündigen Loop-Auslauf\n- `loopMarkers` für orange Hilfsmarkierungen im Loop-Editor\n",
'architecture song metadata')
arch = once(arch,
"Bibliothek, Playlists, Verlauf und Loops verwenden denselben Auswahlmodus. Die Zuordnung erfolgt ausschließlich über „Alle Playlists“ unten rechts. Die Playlist-Liste ist nach Symbolen, Zahlen und danach Buchstaben gruppiert.\n",
"Bibliothek, Playlists, Verlauf und Loops verwenden denselben Auswahlmodus. Rechts neben „Alle Playlists“ liegt im Auswahlmodus ein runder `•••`-Knopf. Er zeigt die reservierten Aktionen Gruppieren und Tags sowie Bewegen und Alle löschen. Gruppieren/Tags bleiben im Prototyp deaktiviert. Bewegen arbeitet nur in Bibliothek bzw. geöffneter Playlist und verschiebt die Auswahl als Block innerhalb der manuellen Reihenfolge. Ist eine andere Sortierung aktiv, fragt Josi vorab nach dem Wechsel auf Manuell; bei Nein wird abgebrochen. Alle löschen verlangt eine Sicherheitsabfrage und entfernt die ausgewählten lokalen Dateien aus allen Playlists.\n",
'architecture selection menu')
arch = once(arch,
"Ein einzelnes HTML-Audio-Element übernimmt Wiedergabe, Fortschritt, Systemsteuerung und Loop-Vorschau. Vollständig gehörte Songs werden nur beim natürlichen `ended`-Ereignis gezählt. Media Session wird genutzt, soweit Safari/iPadOS sie bereitstellt.\n",
"Ein einzelnes HTML-Audio-Element übernimmt Wiedergabe, Fortschritt, Systemsteuerung und Loop-Vorschau. Loop-Grenzen werden während laufender Wiedergabe zusätzlich per `requestAnimationFrame` überwacht, statt nur auf das deutlich seltenere `timeupdate` zu warten. Das reduziert die hörbare Verzögerung beim Zurückspringen erheblich, kann auf Safari/iPadOS aber kein sample-genaues Gapless-Segment-Looping garantieren. Als Fallback existiert ein globaler Loop-Auslauf-Master in den Einstellungen: Ist er aktiv, kann ein Song bis eine Sekunde nach dem gesetzten Loop-Ende weiterlaufen, bevor zum Loop-Start gesprungen wird. Pro Song kann dieser Auslauf deaktiviert werden. Vollständig gehörte Songs werden nur beim natürlichen `ended`-Ereignis gezählt. Media Session wird genutzt, soweit Safari/iPadOS sie bereitstellt.\n\nIm Kopfbereich stehen Home und Einstellungen links vor Zurück/Vor. Home öffnet immer die Bibliothek. Die Einstellungen enthalten zunächst die globale Spulweite (5/10/15/30/60 Sekunden) und den Master-Schalter für den Loop-Auslauf. Der Hauptplayer verwendet die konfigurierte Spulweite als ⏪ / Play-Pause / ⏩-Gruppe. Die Song-Detailansicht zeigt Shuffle und Wiederholen außen um ihre bisherigen Transportknöpfe; derselbe Langdruck auf Wiederholen aktiviert dort ebenfalls `↻1`.\n",
'architecture player settings loop monitor')
arch_path.write_text(arch)

concept_path = Path('concept.md')
concept = concept_path.read_text()
concept = once(concept,
"„Auswählen“ funktioniert in Bibliothek, Playlist, Verlauf und Loops. Mehrere markierte Songs werden ausschließlich über den Kasten **„Alle Playlists“** unten rechts einer Playlist zugeordnet.\n",
"„Auswählen“ funktioniert in Bibliothek, Playlist, Verlauf und Loops. Rechts neben **„Alle Playlists“** erscheint ein runder `•••`-Knopf mit **Gruppieren** (später), **Bewegen**, **Tags** (später) und **Alle löschen**. Bewegen ist nur in Bibliothek bzw. geöffneter Playlist verfügbar und verschiebt die Auswahl als zusammenhängenden Block. Bei einer nicht-manuellen Sortierung fragt Josi, ob auf Manuell umgeschaltet werden soll; Nein bricht die Aktion ab. Alle löschen verlangt eine Sicherheitsabfrage.\n",
'concept selection menu')
concept = once(concept,
"Änderungen wie Loop speichern, Loop an/aus, Marker, Dauer oder Umbenennen verändern nur Metadaten. Dadurch bleibt die Wiedergabequelle stabil und die importierte Datei geschützt.\n",
"Änderungen wie Loop speichern, Loop an/aus, Marker, Dauer oder Umbenennen verändern nur Metadaten. Dadurch bleibt die Wiedergabequelle stabil und die importierte Datei geschützt. Für die Loop-Grenze nutzt der Player während der Wiedergabe eine häufige Frame-Prüfung statt ausschließlich `timeupdate`, um die hörbare Pause beim Rücksprung zu verkleinern. Da echtes sample-genaues Gapless-Segment-Looping in Safari-PWAs nicht garantiert ist, gibt es zusätzlich **Loop-Auslauf +1 s**: ein globaler Master-Schalter in den Einstellungen und eine pro Song ein-/ausschaltbare Ausnahme in Detailansicht und `•••`.\n",
'concept loop gap')
concept = once(concept,
"Zurück und Vor öffnen vorherige bzw. nächste App-Ansichten. Undo und Redo bleiben rechts daneben. Bei einer vorgemerkten manuellen Verschiebung folgen Haken und X. Im Loop-Editor schließt Zurück zuerst den Editor.\n",
"Ganz links stehen **Home** und **Einstellungen**, danach Zurück/Vor sowie Undo/Redo. Home öffnet von jedem Tab direkt die Bibliothek. Die Einstellungen sind zunächst ein Prototyp für die Spulweite (5/10/15/30/60 Sekunden) und den globalen Loop-Auslauf. Der Hauptplayer zeigt zwischen Shuffle und Wiederholen **⏪ / Play-Pause / ⏩** mit der gewählten Spulweite. In der näheren Song-Ansicht sitzen Shuffle und Wiederholen außen um die bisherigen Transportknöpfe; Langdruck auf Wiederholen nutzt dort ebenfalls `↻1`.\n",
'concept navigation settings')
concept_path.write_text(concept)
