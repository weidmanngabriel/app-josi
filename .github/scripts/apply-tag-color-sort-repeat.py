from pathlib import Path
import re

app_path = Path('src/App.tsx')
css_path = Path('src/enhancements.css')
arch_path = Path('architecture.md')
concept_path = Path('concept.md')
app = app_path.read_text()
css = css_path.read_text()
arch = arch_path.read_text()
concept = concept_path.read_text()

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing pattern: {label}')
    return text.replace(old, new, 1)

# Types / palette / state
app = replace_once(app,
"type OverflowMenu = { kind: 'song' | 'playlist' | 'playlists' | 'tag' | 'tags'; id?: string } | null",
"type OverflowMenu = { kind: 'song' | 'songDetail' | 'playlist' | 'playlists' | 'tag' | 'tags'; id?: string } | null\ntype SidebarSortTarget = 'tags' | 'playlists' | null\ntype RepeatSetting = { kind: 'infinite' } | { kind: 'count'; count: number } | null",
'overflow types')

app = replace_once(app,
"const TAG_COLORS = ['#60a5fa', '#f472b6', '#f59e0b', '#34d399', '#a78bfa', '#fb7185', '#22d3ee', '#facc15'] as const",
"const TAG_COLOR_PALETTE = Array.from({ length: 100 }, (_, index) => {\n  const hue = (index % 20) * 18\n  const row = Math.floor(index / 20)\n  const saturation = [72, 82, 68, 88, 76][row]\n  const lightness = [38, 46, 54, 62, 70][row]\n  return `hsl(${hue} ${saturation}% ${lightness}%)`\n})",
'tag palette')

app = replace_once(app,
"  const [repeatQueue, setRepeatQueue] = useState(false)\n  const [repeatSelectionIds, setRepeatSelectionIds] = useState<Set<string>>(new Set())",
"  const [repeatQueue, setRepeatQueue] = useState(false)\n  const [repeatSetting, setRepeatSetting] = useState<RepeatSetting>(null)\n  const [repeatRemaining, setRepeatRemaining] = useState<number | null>(null)\n  const [repeatMenuOpen, setRepeatMenuOpen] = useState(false)\n  const [repeatCountInput, setRepeatCountInput] = useState('3')",
'repeat states')

app = replace_once(app,
"  const [tagName, setTagName] = useState('')",
"  const [tagName, setTagName] = useState('')\n  const [tagColor, setTagColor] = useState(TAG_COLOR_PALETTE[0])\n  const [tagColorPickerOpen, setTagColorPickerOpen] = useState(false)",
'tag create color state')

app = replace_once(app,
"  const [renameValue, setRenameValue] = useState('')",
"  const [renameValue, setRenameValue] = useState('')\n  const [renameTagColor, setRenameTagColor] = useState(TAG_COLOR_PALETTE[0])",
'rename color state')

app = replace_once(app,
"  const [tagSortMode, setTagSortMode] = useState<SortMode>(() => (localStorage.getItem('josi-tag-sort-mode') as SortMode) || 'manual')\n  const [tagSortDirection, setTagSortDirection] = useState<SortDirection>(() => (localStorage.getItem('josi-tag-sort-direction') as SortDirection) || 'down')",
"  const [tagSortMode, setTagSortMode] = useState<SortMode>(() => (localStorage.getItem('josi-tag-sort-mode') as SortMode) || 'manual')\n  const [tagSortDirection, setTagSortDirection] = useState<SortDirection>(() => (localStorage.getItem('josi-tag-sort-direction') as SortDirection) || 'down')\n  const [playlistSortMode, setPlaylistSortMode] = useState<SortMode>(() => (localStorage.getItem('josi-playlist-sort-mode') as SortMode) || 'manual')\n  const [playlistSortDirection, setPlaylistSortDirection] = useState<SortDirection>(() => (localStorage.getItem('josi-playlist-sort-direction') as SortDirection) || 'down')\n  const [sidebarSortTarget, setSidebarSortTarget] = useState<SidebarSortTarget>(null)",
'playlist sort states')

# persistence
app = replace_once(app,
"  useEffect(() => { localStorage.setItem('josi-tag-sort-direction', tagSortDirection) }, [tagSortDirection])",
"  useEffect(() => { localStorage.setItem('josi-tag-sort-direction', tagSortDirection) }, [tagSortDirection])\n  useEffect(() => { localStorage.setItem('josi-playlist-sort-mode', playlistSortMode) }, [playlistSortMode])\n  useEffect(() => { localStorage.setItem('josi-playlist-sort-direction', playlistSortDirection) }, [playlistSortDirection])",
'playlist sort persistence')

# playlist sorting
app = replace_once(app,
"  const sidebarPlaylists = useMemo(() => [...playlists].sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) || b.lastUsedAt - a.lastUsedAt), [playlists])",
"  const sidebarPlaylists = useMemo(() => {\n    const items = [...playlists]\n    if (playlistSortMode === 'manual') return items.sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) || b.lastUsedAt - a.lastUsedAt)\n    const direction = playlistSortDirection === 'down' ? 1 : -1\n    const playsFor = (playlist: Playlist) => playlist.songIds.reduce((sum, id) => sum + (songs.find((song) => song.id === id)?.completedPlays ?? 0), 0)\n    const compare = (a: Playlist, b: Playlist) => {\n      if (playlistSortMode === 'azStart') return a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' })\n      if (playlistSortMode === 'azEnd') return reverseText(a.name).localeCompare(reverseText(b.name), 'de', { numeric: true, sensitivity: 'base' })\n      if (playlistSortMode === 'plays') return playsFor(a) - playsFor(b) || a.name.localeCompare(b.name, 'de')\n      if (playlistSortMode === 'duration') return a.songIds.length - b.songIds.length || a.name.localeCompare(b.name, 'de')\n      return a.createdAt - b.createdAt\n    }\n    return items.sort((a, b) => compare(a, b) * direction)\n  }, [playlists, songs, playlistSortMode, playlistSortDirection])",
'playlist sort memo')

app = replace_once(app,
"  const repeatSelectionQueue = repeatSelectionIds.size ? playerQueue.filter((song) => repeatSelectionIds.has(song.id)) : []\n",
"",
'remove repeat selection queue')

# reset finite repeat on song change
needle = "  useEffect(() => {\n    const file = currentSong?.file"
insert = "  useEffect(() => {\n    if (repeatSetting?.kind === 'count') setRepeatRemaining(repeatSetting.count)\n    else setRepeatRemaining(null)\n  }, [currentSongId, repeatSetting])\n\n"
if needle not in app:
    raise SystemExit('missing repeat reset insertion point')
app = app.replace(needle, insert + needle, 1)

# Loop playback finite-repeat guard / countdown
app = app.replace("        } else if (!loopEditorSongId && song.loopEnabled && song.loopStart !== undefined && song.loopEnd !== undefined) {",
                  "        } else if (!loopEditorSongId && song.loopEnabled && song.loopStart !== undefined && song.loopEnd !== undefined && (repeatSetting?.kind !== 'count' || (repeatRemaining ?? 0) > 0)) {", 1)
app = app.replace("            if (audio.currentTime >= end) { audio.currentTime = start; setCurrentTime(start) }",
                  "            if (audio.currentTime >= end) { audio.currentTime = start; setCurrentTime(start); if (repeatSetting?.kind === 'count') setRepeatRemaining((value) => Math.max(0, (value ?? 0) - 1)) }", 1)
app = app.replace("                playbackAudioRef.current = transition.incoming; loopTransitionRef.current = null; setCurrentTime(transition.incoming.currentTime)",
                  "                playbackAudioRef.current = transition.incoming; loopTransitionRef.current = null; setCurrentTime(transition.incoming.currentTime); if (repeatSetting?.kind === 'count') setRepeatRemaining((value) => Math.max(0, (value ?? 0) - 1))", 1)
app = app.replace("                    if (audio.currentTime >= end) { audio.currentTime = start; setCurrentTime(start) }",
                  "                    if (audio.currentTime >= end) { audio.currentTime = start; setCurrentTime(start); if (repeatSetting?.kind === 'count') setRepeatRemaining((value) => Math.max(0, (value ?? 0) - 1)) }", 1)
app = replace_once(app,
"  }, [isPlaying, currentSong?.id, currentSong?.loopEnabled, currentSong?.loopStart, currentSong?.loopEnd, loopEditorSongId, cursorLoopEnabled, loopDraftStart, loopDraftEnd])",
"  }, [isPlaying, currentSong?.id, currentSong?.loopEnabled, currentSong?.loopStart, currentSong?.loopEnd, loopEditorSongId, cursorLoopEnabled, loopDraftStart, loopDraftEnd, repeatSetting, repeatRemaining])",
'loop effect deps')

# home must close loop editor even when navigation target already is library
app = replace_once(app,
"  const goHome = () => { setSettingsOpen(false); navigateTo({ view: 'library', playlistId: null, detailOpen: false }) }",
"  const goHome = () => { setSettingsOpen(false); setLoopEditorSongId(null); setDetailOpen(false); setActiveTagId(null); setActivePlaylistId(null); navigateTo({ view: 'library', playlistId: null, detailOpen: false }) }",
'home loop fix')

# moveSong no old repeat-selection queue
app = replace_once(app,
"    const queue = repeatSelectionQueue.length ? repeatSelectionQueue : playerQueue\n    const currentIndex = queue.findIndex((song) => song.id === currentSongId)\n    if (!repeatSelectionQueue.length && shuffle && direction === 1 && playerQueue.length > 1) {",
"    const queue = playerQueue\n    const currentIndex = queue.findIndex((song) => song.id === currentSongId)\n    if (shuffle && direction === 1 && playerQueue.length > 1) {",
'moveSong queue')
app = app.replace("    if (repeatSelectionQueue.length) return playQueueSong(queue[direction === 1 ? 0 : queue.length - 1])\n", "", 1)

# tag rename color
app = replace_once(app,
"    if (!name) return\n    setRenameTarget({ kind, id }); setRenameValue(name); setOverflowMenu(null)",
"    if (!name) return\n    if (kind === 'tag') setRenameTagColor(tags.find((tag) => tag.id === id)?.color ?? TAG_COLOR_PALETTE[0])\n    setRenameTarget({ kind, id }); setRenameValue(name); setOverflowMenu(null)",
'begin rename color')
app = replace_once(app,
"      if (tag) await updateTag({ ...tag, name, lastUsedAt: Date.now() }, true)",
"      if (tag) await updateTag({ ...tag, name, color: renameTagColor, lastUsedAt: Date.now() }, true)",
'confirm rename color')

# create tag selected color
app = replace_once(app,
"    recordHistory(); const now = Date.now(); const tag: Tag = { id: crypto.randomUUID(), name, color: TAG_COLORS[tags.length % TAG_COLORS.length], songIds: [], playlistIds: [], createdAt: now, lastUsedAt: now, sortOrder: tags.length }\n    await saveTag(tag); setTags((items) => [...items, tag]); setTagName('')",
"    recordHistory(); const now = Date.now(); const tag: Tag = { id: crypto.randomUUID(), name, color: tagColor, songIds: [], playlistIds: [], createdAt: now, lastUsedAt: now, sortOrder: tags.length }\n    await saveTag(tag); setTags((items) => [...items, tag]); setTagName(''); setTagColorPickerOpen(false); setTagColor(TAG_COLOR_PALETTE[(tags.length + 1) % TAG_COLOR_PALETTE.length])",
'create tag color')

# Manual editing switches corresponding list to manual
app = replace_once(app,
"  const beginReorder = (scope: Exclude<ReorderScope, null>) => { if (scope === 'library' || scope === 'playlist') setSearchQuery(''); if (scope === 'sidebar') setPlaylistsCollapsed(false); if (scope === 'tags') setTagsCollapsed(false); setReorderScope(scope); setMoveCandidate(null); setOverflowMenu(null); if (scope === 'tags') setTagSortMode('manual'); else setSortMode('manual') }",
"  const beginReorder = (scope: Exclude<ReorderScope, null>) => { if (scope === 'library' || scope === 'playlist') setSearchQuery(''); if (scope === 'sidebar') { setPlaylistsCollapsed(false); setPlaylistSortMode('manual') } if (scope === 'tags') { setTagsCollapsed(false); setTagSortMode('manual') } setReorderScope(scope); setMoveCandidate(null); setOverflowMenu(null); if (scope !== 'tags' && scope !== 'sidebar') setSortMode('manual') }",
'begin reorder sort modes')

# Repeat hold becomes menu; remove old selected-song repeat mode
pattern = re.compile(r"  const clearRepeatHold = \(\) => \{.*?  const selectAllVisible = \(\) =>", re.S)
replacement = """  const clearRepeatHold = () => {
    if (repeatHoldTimerRef.current !== null) window.clearTimeout(repeatHoldTimerRef.current)
    repeatHoldTimerRef.current = null
  }
  const beginRepeatHold = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    clearRepeatHold()
    repeatHoldTriggeredRef.current = false
    repeatHoldTimerRef.current = window.setTimeout(() => {
      repeatHoldTriggeredRef.current = true
      repeatHoldTimerRef.current = null
      setRepeatMenuOpen(true)
    }, 650)
  }
  const endRepeatHold = () => clearRepeatHold()
  const handleRepeatClick = () => {
    if (repeatHoldTriggeredRef.current) { repeatHoldTriggeredRef.current = false; return }
    clearRepeatHold()
    if (repeatSetting) { setRepeatSetting(null); setRepeatRemaining(null); setRepeatQueue(false); return }
    setRepeatQueue((value) => !value)
  }
  const chooseInfiniteRepeat = () => { setRepeatSetting({ kind: 'infinite' }); setRepeatRemaining(null); setRepeatQueue(false); setRepeatMenuOpen(false) }
  const chooseCountRepeat = () => {
    const count = Math.max(1, Math.min(9999, Math.floor(Number(repeatCountInput) || 1)))
    setRepeatCountInput(String(count)); setRepeatSetting({ kind: 'count', count }); setRepeatRemaining(count); setRepeatQueue(false); setRepeatMenuOpen(false)
  }
  const selectAllVisible = () =>"""
app, count = pattern.subn(replacement, app, count=1)
if count != 1:
    raise SystemExit('repeat handler block not found')

# helper for palette before constants calculated near render
needle = "  const songEditMode = reorderScope === (activePlaylist ? 'playlist' : 'library') && view === 'library'"
palette_helper = """  const renderTagColorPalette = (selected: string, onSelect: (color: string) => void) => <div className=\"tag-color-palette\" role=\"group\" aria-label=\"Tag-Farbe wählen\">{TAG_COLOR_PALETTE.map((color) => <button key={color} className={selected === color ? 'selected' : ''} type=\"button\" style={{ background: color }} onClick={() => onSelect(color)} aria-label={`Farbe ${color}`} />)}</div>
  const repeatBadge = repeatSetting?.kind === 'infinite' ? '∞' : repeatSetting?.kind === 'count' ? String(repeatRemaining ?? repeatSetting.count) : null

"""
if needle not in app:
    raise SystemExit('palette helper insertion missing')
app = app.replace(needle, palette_helper + needle, 1)

# labels for sidebar sorting
app = replace_once(app,
"  const tagSortLabels: Record<SortMode, string> = { ...sortLabels, duration: 'Anzahl der Lieder' }",
"  const tagSortLabels: Record<SortMode, string> = { ...sortLabels, duration: 'Anzahl der Lieder' }\n  const playlistSortLabels: Record<SortMode, string> = { ...sortLabels, duration: 'Anzahl der Lieder' }",
'playlist sort labels')

# handle ended: finite/infinite repetition for loop or whole song
old_ended = """  const handleAudioEnded = (audio: HTMLAudioElement) => {
    if (loopTransitionRef.current?.outgoing === audio || currentPlaybackAudio() !== audio) return
    if (currentSong?.loopEnabled && currentSong.loopStart !== undefined && currentSong.loopEnd !== undefined) {
      const automatic = loopOverlapBlockedRef.current ? automaticLoopSeamsRef.current.get(currentSong.id) : undefined
      audio.currentTime = automatic?.start ?? currentSong.loopStart; setCurrentTime(audio.currentTime); void audio.play().catch(() => undefined); return
    }
    if (currentSong) void updateSong({ ...currentSong, completedPlays: (currentSong.completedPlays ?? 0) + 1 })
    moveSong(1)
  }"""
new_ended = """  const handleAudioEnded = (audio: HTMLAudioElement) => {
    if (loopTransitionRef.current?.outgoing === audio || currentPlaybackAudio() !== audio) return
    const finiteAvailable = repeatSetting?.kind !== 'count' || (repeatRemaining ?? 0) > 0
    if (currentSong?.loopEnabled && currentSong.loopStart !== undefined && currentSong.loopEnd !== undefined && finiteAvailable) {
      const automatic = loopOverlapBlockedRef.current ? automaticLoopSeamsRef.current.get(currentSong.id) : undefined
      audio.currentTime = automatic?.start ?? currentSong.loopStart; setCurrentTime(audio.currentTime); if (repeatSetting?.kind === 'count') setRepeatRemaining((value) => Math.max(0, (value ?? 0) - 1)); void audio.play().catch(() => undefined); return
    }
    if (currentSong && !currentSong.loopEnabled && repeatSetting?.kind === 'infinite') { audio.currentTime = 0; setCurrentTime(0); void audio.play().catch(() => undefined); return }
    if (currentSong && !currentSong.loopEnabled && repeatSetting?.kind === 'count' && (repeatRemaining ?? 0) > 0) { setRepeatRemaining((value) => Math.max(0, (value ?? 0) - 1)); audio.currentTime = 0; setCurrentTime(0); void audio.play().catch(() => undefined); return }
    if (currentSong) void updateSong({ ...currentSong, completedPlays: (currentSong.completedPlays ?? 0) + 1 })
    moveSong(1)
  }"""
app = replace_once(app, old_ended, new_ended, 'ended repeat behavior')

# sidebar: remove inline tag sort controls, add color picker create control
old_sidebar_tags = """      {!tagsCollapsed && <><div className=\"tag-sort-row\" onClick={(event) => event.stopPropagation()}><select value={tagSortMode} onChange={(event) => setTagSortMode(event.target.value as SortMode)}>{(Object.keys(tagSortLabels) as SortMode[]).map((mode) => <option key={mode} value={mode}>{tagSortLabels[mode]}</option>)}</select><button type=\"button\" disabled={tagSortMode === 'manual'} onClick={() => setTagSortDirection((value) => value === 'down' ? 'up' : 'down')}>{tagSortMode === 'manual' ? '—' : tagSortDirection === 'down' ? '↓' : '↑'}</button></div><div className=\"tag-nav\">"""
app = replace_once(app, old_sidebar_tags, "      {!tagsCollapsed && <><div className=\"tag-nav\">", 'remove inline tag sort')
app = replace_once(app,
"<form className=\"new-playlist new-tag\" onSubmit={createTag}><input value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder=\"Neuer Tag\" /><button type=\"submit\" disabled={!tagName.trim()}>+</button></form>",
"<form className=\"new-playlist new-tag\" onSubmit={createTag}><input value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder=\"Neuer Tag\" /><div className=\"tag-color-picker-wrap\"><button className=\"tag-color-trigger\" type=\"button\" style={{ background: tagColor }} onClick={() => setTagColorPickerOpen((value) => !value)} aria-label=\"Tag-Farbe wählen\" />{tagColorPickerOpen && <div className=\"tag-color-popover\">{renderTagColorPalette(tagColor, (color) => { setTagColor(color); setTagColorPickerOpen(false) })}</div>}</div><button type=\"submit\" disabled={!tagName.trim()}>+</button></form>",
'tag create palette UI')

# remove old green repeat class on rows
app = app.replace("${repeatSelectionIds.has(song.id) ? ' repeat-selected-song' : ''}", "", 1)

# main repeat button
old_repeat_button = """<button className={repeatQueue || repeatSelectionIds.size ? 'active-control repeat-control' : 'repeat-control'} onPointerDown={beginRepeatHold} onPointerUp={endRepeatHold} onPointerCancel={endRepeatHold} onContextMenu={(event) => event.preventDefault()} onClick={handleRepeatClick} aria-label={repeatSelectionIds.size ? 'Ausgewählte Lieder wiederholen' : 'Liste wiederholen'}><span className={`repeat-symbol${repeatSelectionIds.size ? ' repeat-one-symbol' : ''}`}>↻{repeatSelectionIds.size > 0 && <b>1</b>}</span></button>"""
new_repeat_button = """<button className={repeatQueue || repeatSetting ? 'active-control repeat-control' : 'repeat-control'} onPointerDown={beginRepeatHold} onPointerUp={endRepeatHold} onPointerCancel={endRepeatHold} onContextMenu={(event) => event.preventDefault()} onClick={handleRepeatClick} aria-label={repeatBadge ? `Wiederholung ${repeatBadge}` : 'Liste wiederholen'}><span className=\"repeat-symbol\">↻{repeatBadge && <b>{repeatBadge}</b>}</span></button>"""
if app.count(old_repeat_button) != 2:
    raise SystemExit(f'expected 2 repeat buttons, got {app.count(old_repeat_button)}')
app = app.replace(old_repeat_button, new_repeat_button)

# detail menu button
app = replace_once(app,
"<section className=\"song-detail\"><div className=\"detail-topbar\"><button type=\"button\" onClick={navigateBack}>‹ Zurück</button></div>",
"<section className=\"song-detail\"><div className=\"detail-topbar\"><button type=\"button\" onClick={navigateBack}>‹ Zurück</button><button className=\"overflow-button detail-overflow\" type=\"button\" onClick={() => setOverflowMenu({ kind: 'songDetail', id: currentSong.id })} aria-label=\"Weitere Liedaktionen\">•••</button></div>",
'detail overflow button')

# overflow menus: sorting under rename for tags/playlists and detail-specific song menu
app = replace_once(app,
"return <><button type=\"button\" onClick={() => beginRename('tag', tag.id)}>Umbenennen</button><button className=\"danger-menu-action\"",
"return <><button type=\"button\" onClick={() => beginRename('tag', tag.id)}>Umbenennen</button><button type=\"button\" onClick={() => { setOverflowMenu(null); setSidebarSortTarget('tags') }}>Sortieren</button><button className=\"danger-menu-action\"",
'tag sort menu item')
app = replace_once(app,
"return <><button type=\"button\" onClick={() => openPlaylistCoverPicker(playlist.id)}>Bild ändern</button><button type=\"button\" onClick={() => beginRename('playlist', playlist.id)}>Umbenennen</button><button type=\"button\" onClick={() => copyPlaylist(playlist.id)}>",
"return <><button type=\"button\" onClick={() => openPlaylistCoverPicker(playlist.id)}>Bild ändern</button><button type=\"button\" onClick={() => beginRename('playlist', playlist.id)}>Umbenennen</button><button type=\"button\" onClick={() => { setOverflowMenu(null); setSidebarSortTarget('playlists') }}>Sortieren</button><button type=\"button\" onClick={() => copyPlaylist(playlist.id)}>",
'playlist sort menu item')

# Insert songDetail menu before playlist branch
marker = "{overflowMenu.kind === 'playlist' && overflowMenu.id && (() => { const playlist = playlists.find((item) => item.id === overflowMenu.id);"
detail_menu = """{overflowMenu.kind === 'songDetail' && overflowMenu.id && (() => { const song = songs.find((item) => item.id === overflowMenu.id); if (!song) return null; return <><button type=\"button\" onClick={() => beginRename('song', song.id)}>Umbenennen</button><button type=\"button\" onClick={() => copySong(song.id)}>Kopieren</button><button type=\"button\" disabled={clipboard?.kind !== 'song'} onClick={pasteFromSongMenu}>Einfügen</button><button type=\"button\" onClick={() => openTagChooser('song', [song.id])}>Tags</button><button type=\"button\" onClick={() => void shareSong(song.id)}>Teilen</button><button type=\"button\" onClick={() => openLoopEditor(song.id)}>{song.loopStart !== undefined ? 'Loop bearbeiten' : 'Loop erstellen'}</button>{song.loopStart !== undefined && song.loopEnd !== undefined && <button type=\"button\" onClick={() => void toggleSongLoop(song.id)}>{song.loopEnabled ? 'Loop deaktivieren' : 'Loop aktivieren'}</button>}<button className=\"danger-menu-action\" type=\"button\" onClick={() => { setSongToDelete(song); setOverflowMenu(null) }}>Löschen</button></> })()}"""
if marker not in app:
    raise SystemExit('detail menu insertion marker missing')
app = app.replace(marker, detail_menu + marker, 1)

# tag chooser: assigned state is minus not check
app = replace_once(app, "<strong>{all ? '✓' : some ? '±' : '+'}</strong>", "<strong>{all ? '−' : some ? '±' : '+'}</strong>", 'tag chooser minus')

# Repeat menu and sorting modal before duplicate conflict
modal_marker = "    {duplicateConflict && <div className=\"modal-backdrop duplicate-conflict-backdrop\""
new_modals = """    {repeatMenuOpen && <div className=\"modal-backdrop repeat-choice-backdrop\" onMouseDown={() => setRepeatMenuOpen(false)}><div className=\"confirm-dialog repeat-choice-dialog\" onMouseDown={(event) => event.stopPropagation()}><h2>Wiederholung</h2><p>Unendlich wiederholen oder eine feste Anzahl wählen. Bei einem aktiven Loop zählt die Zahl pro Loop-Durchlauf herunter.</p><div className=\"repeat-choice-options\"><button className=\"repeat-infinity-option\" type=\"button\" onClick={chooseInfiniteRepeat}><span>∞</span><strong>Unendlich</strong></button><div className=\"repeat-count-option\"><input type=\"number\" min=\"1\" max=\"9999\" inputMode=\"numeric\" value={repeatCountInput} onChange={(event) => setRepeatCountInput(event.target.value)} aria-label=\"Anzahl Wiederholungen\" /><button type=\"button\" onClick={chooseCountRepeat}>Anwenden</button></div></div><div className=\"dialog-actions\"><button type=\"button\" onClick={() => setRepeatMenuOpen(false)}>Abbrechen</button></div></div></div>}
    {sidebarSortTarget && <div className=\"modal-backdrop sidebar-sort-backdrop\" onMouseDown={() => setSidebarSortTarget(null)}><div className=\"confirm-dialog sidebar-sort-dialog\" onMouseDown={(event) => event.stopPropagation()}><h2>{sidebarSortTarget === 'tags' ? 'Tags sortieren' : 'Playlists sortieren'}</h2><div className=\"sidebar-sort-controls\"><select value={sidebarSortTarget === 'tags' ? tagSortMode : playlistSortMode} onChange={(event) => sidebarSortTarget === 'tags' ? setTagSortMode(event.target.value as SortMode) : setPlaylistSortMode(event.target.value as SortMode)}>{(Object.keys(sidebarSortTarget === 'tags' ? tagSortLabels : playlistSortLabels) as SortMode[]).map((mode) => <option key={mode} value={mode}>{(sidebarSortTarget === 'tags' ? tagSortLabels : playlistSortLabels)[mode]}</option>)}</select><button type=\"button\" disabled={(sidebarSortTarget === 'tags' ? tagSortMode : playlistSortMode) === 'manual'} onClick={() => sidebarSortTarget === 'tags' ? setTagSortDirection((value) => value === 'down' ? 'up' : 'down') : setPlaylistSortDirection((value) => value === 'down' ? 'up' : 'down')}>{(sidebarSortTarget === 'tags' ? tagSortMode : playlistSortMode) === 'manual' ? '—' : (sidebarSortTarget === 'tags' ? tagSortDirection : playlistSortDirection) === 'down' ? '↓' : '↑'}</button></div><p>Die Sortierung wird für diese Seitenleisten-Liste gespeichert. „Manuell“ verwendet die verschiebbare Reihenfolge.</p><div className=\"dialog-actions\"><button type=\"button\" onClick={() => setSidebarSortTarget(null)}>Fertig</button></div></div></div>}
"""
if modal_marker not in app:
    raise SystemExit('modal insertion marker missing')
app = app.replace(modal_marker, new_modals + modal_marker, 1)

# Rename dialog shows color palette for tags
old_rename_modal = """    {renameTarget && <div className=\"modal-backdrop\" onMouseDown={() => setRenameTarget(null)}><form className=\"confirm-dialog rename-dialog\" onSubmit={confirmRename} onMouseDown={(event) => event.stopPropagation()}><h2>Umbenennen</h2><input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} autoFocus /><div className=\"dialog-actions\"><button type=\"button\" onClick={() => setRenameTarget(null)}>Abbrechen</button><button type=\"submit\" disabled={!renameValue.trim()}>Speichern</button></div></form></div>}"""
new_rename_modal = """    {renameTarget && <div className=\"modal-backdrop\" onMouseDown={() => setRenameTarget(null)}><form className=\"confirm-dialog rename-dialog\" onSubmit={confirmRename} onMouseDown={(event) => event.stopPropagation()}><h2>Umbenennen</h2><input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} autoFocus />{renameTarget.kind === 'tag' && <div className=\"rename-tag-color\"><span>Farbe</span>{renderTagColorPalette(renameTagColor, setRenameTagColor)}</div>}<div className=\"dialog-actions\"><button type=\"button\" onClick={() => setRenameTarget(null)}>Abbrechen</button><button type=\"submit\" disabled={!renameValue.trim()}>Speichern</button></div></form></div>}"""
app = replace_once(app, old_rename_modal, new_rename_modal, 'rename palette')

# CSS
css += r'''

/* Tag color palette, sidebar sort dialogs, detail menu and repeat choices */
.new-tag { grid-template-columns: minmax(0,1fr) 38px 42px; position: relative; }
.tag-color-picker-wrap { position: relative; display: grid; place-items: center; }
.tag-color-trigger { width: 34px; height: 34px; min-height: 34px !important; padding: 0 !important; border: 2px solid rgba(255,255,255,.48) !important; border-radius: 50% !important; box-shadow: inset 0 0 0 2px rgba(0,0,0,.2); }
.tag-color-popover { position: absolute; z-index: 190; left: 50%; bottom: 44px; width: 232px; padding: 9px; border: 1px solid #3a4050; border-radius: 13px; background: #111620; box-shadow: 0 18px 50px rgba(0,0,0,.55); transform: translateX(-50%); }
.tag-color-palette { display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; }
.tag-color-palette button { width: 18px; height: 18px; min-height: 18px !important; padding: 0 !important; border: 1px solid rgba(255,255,255,.2) !important; border-radius: 5px !important; cursor: pointer; }
.tag-color-palette button.selected { outline: 2px solid #fff; outline-offset: 1px; }
.rename-tag-color { display: grid; gap: 8px; margin: -6px 0 18px; }
.rename-tag-color > span { color: #9ca3af; font-size: 11px; font-weight: 850; letter-spacing: .08em; text-transform: uppercase; }
.rename-tag-color .tag-color-palette { width: min(240px,100%); }
.sidebar-sort-dialog { width: min(430px, calc(100vw - 28px)); }
.sidebar-sort-controls { display: grid; grid-template-columns: minmax(0,1fr) 44px; gap: 8px; margin: 14px 0 10px; }
.sidebar-sort-controls select, .sidebar-sort-controls button { min-height: 44px; border: 1px solid #3b4352; border-radius: 10px; background: #171b24; color: #fff; }
.sidebar-sort-controls select { padding: 0 10px; }
.sidebar-sort-controls button { padding: 0; font-size: 20px; cursor: pointer; }
.detail-topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.detail-topbar .detail-overflow { width: 44px; height: 42px; padding: 0; font-size: 16px; }
.repeat-choice-dialog { width: min(460px, calc(100vw - 28px)); }
.repeat-choice-options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 16px 0; }
.repeat-infinity-option { display: grid; place-items: center; gap: 5px; min-height: 104px; border: 1px solid #454d5d; border-radius: 14px; background: #171c26; cursor: pointer; }
.repeat-infinity-option span { font-size: 42px; line-height: 1; }
.repeat-count-option { display: grid; grid-template-rows: 1fr 42px; gap: 8px; }
.repeat-count-option input { width: 100%; min-height: 54px; padding: 0 12px; border: 1px solid #454d5d; border-radius: 12px; background: #0f141c; color: #fff; font-size: 28px; text-align: center; }
.repeat-count-option button { border: 1px solid #454d5d; border-radius: 10px; background: #1c2230; cursor: pointer; }
.repeat-symbol b { position: absolute; right: -9px; top: -7px; min-width: 17px; height: 17px; padding: 0 3px; display: grid; place-items: center; border-radius: 999px; background: #8b5cf6; color: #fff; font-size: 9px; font-weight: 950; line-height: 1; }
@media (max-width: 620px) {
  .tag-color-popover { left: auto; right: -44px; transform: none; }
  .repeat-choice-options { grid-template-columns: 1fr; }
}
'''

# Docs
arch = arch.replace(
"Langdruck wird grundsätzlich nicht für Objektaktionen verwendet. Zusatzfunktionen liegen in sichtbaren `•••`-Menüs. **Einzige bewusste Ausnahme ist der Wiederholen-Knopf im Player:** Langdruck aktiviert die Wiederholung eines einzelnen bzw. mehrerer zuvor ausgewählter Songs.",
"Langdruck wird grundsätzlich nicht für Objektaktionen verwendet. Zusatzfunktionen liegen in sichtbaren `•••`-Menüs. **Einzige bewusste Ausnahme ist der Wiederholen-Knopf im Player:** Langdruck öffnet eine Wiederholungsbox mit `∞` oder einer frei wählbaren Anzahl."
)
arch = arch.replace(
"Playlists enthalten ID, Name, geordnete Song-IDs, optionales Bild, Erstellungs-/Nutzungszeit und manuelle Sortierposition. Tags liegen ab IndexedDB-Version 3 in einem eigenen `tags`-Store und enthalten Name, Farbe, Song-IDs, Playlist-IDs und eine manuelle Sortierposition. Tags referenzieren ausschließlich vorhandene Objekte und duplizieren niemals Audiodateien. Ein Song oder eine Playlist kann mehrere Tags besitzen; Tags selbst können nicht Mitglied einer Playlist sein.",
"Playlists enthalten ID, Name, geordnete Song-IDs, optionales Bild, Erstellungs-/Nutzungszeit und manuelle Sortierposition. Tags liegen ab IndexedDB-Version 3 in einem eigenen `tags`-Store und enthalten Name, frei wählbare Farbe, Song-IDs, Playlist-IDs und eine manuelle Sortierposition. Beim Erstellen und Umbenennen steht eine kompakte Palette mit ungefähr 100 Farbtönen bereit. Tags referenzieren ausschließlich vorhandene Objekte und duplizieren niemals Audiodateien. Ein Song oder eine Playlist kann mehrere Tags besitzen; Tags selbst können nicht Mitglied einer Playlist sein."
)
arch = arch.replace(
"Ein kurzer Druck auf `↻` schaltet weiterhin die Wiederholung der aktuellen Liste um. Ein Langdruck auf denselben Knopf aktiviert einen Sondermodus mit `↻1`: Ohne Mehrfachauswahl wird der aktuell gewählte Song wiederholt. Mit aktiver Mehrfachauswahl werden die ausgewählten Songs als feste Wiederholgruppe übernommen und anschließend grün in den Listen markiert. Die Gruppe läuft in ihrer Reihenfolge zyklisch weiter; das Symbol bleibt auch bei mehreren Songs `↻1`. Ein normaler kurzer Druck beendet den Sondermodus zunächst vollständig; ein weiterer kurzer Druck kann danach wieder die normale Listenwiederholung einschalten.",
"Ein kurzer Druck auf `↻` schaltet weiterhin die Wiederholung der aktuellen Liste um. Ein Langdruck öffnet stattdessen eine Box mit zwei Sonderoptionen: `∞` oder eine frei eingegebene Anzahl. Das aktive Sonderziel wird als `∞` bzw. als verbleibende Zahl direkt am Wiederholen-Symbol gezeigt. Bei einem aktivierten gespeicherten Loop wird die Zahl nach jedem Loop-Durchlauf heruntergezählt; bei 0 wird der Loop für diese Wiedergabe nicht mehr zurückgesetzt und der Song kann normal bis zum nächsten Lied weiterlaufen. Bei Songs ohne aktiven Loop gilt dieselbe Sonderzahl für vollständige Song-Wiederholungen. Die Einstellung ist nur Wiedergabezustand und wird nicht in Song-Metadaten gespeichert."
)
arch += "\n\n## Seitenleisten-Sortierung, Detailmenü und Navigation\n\nDie Sortierfelder für Tags und Playlists stehen nicht dauerhaft in der Seitenleiste. Bei einem einzelnen Tag bzw. einer Playlist liegt direkt unter `Umbenennen` die Aktion `Sortieren`; sie öffnet einen kompakten Dialog für Sortiermodus und Richtung. Beide Listen speichern ihre Auswahl separat. Die Song-Detailansicht besitzt ein eigenes `•••` mit nur songbezogenen Aktionen inklusive Tags; globale Listen-Sortierung erscheint dort nicht. `Home` schließt den Loop-Editor explizit, bevor zur Bibliothek navigiert wird, damit ein bereits aktiver Bibliotheks-Navigationseintrag den Editor nicht offen hält.\n"

concept = concept.replace(
"Kurzer Druck auf den Wiederholen-Knopf schaltet die normale Listenwiederholung. **Langdruck ist hier bewusst die einzige Ausnahme zur sonst abgeschafften Langdruck-Bedienung:** Er aktiviert `↻1`. Ohne Mehrfachauswahl wiederholt Josi den aktuell gewählten Song. Werden vorher mehrere Songs mit „Auswählen“ markiert, übernimmt der Langdruck genau diese Songs als Wiederholgruppe, beendet den Auswahlmodus und markiert die Gruppe dauerhaft grün, solange der Modus aktiv ist. Die Songs laufen in Listenreihenfolge und beginnen nach dem letzten wieder beim ersten. Das Symbol bleibt `↻1`, auch wenn mehrere Songs dazugehören.",
"Kurzer Druck auf den Wiederholen-Knopf schaltet die normale Listenwiederholung. **Langdruck ist hier bewusst die einzige Ausnahme zur sonst abgeschafften Langdruck-Bedienung:** Er öffnet eine Box mit `∞` oder einer frei eingebbaren Wiederholungszahl. `∞` bzw. die verbleibende Zahl wird neben dem Wiederholen-Symbol gezeigt. Bei einem aktiven Loop zählt die Zahl bei jedem Loop-Durchlauf herunter; bei 0 läuft das Lied ohne weiteren Loop weiter und kann danach zum nächsten Song wechseln. Ohne aktiven Loop zählt die Zahl vollständige Song-Wiederholungen."
)
concept = concept.replace(
"Tags sind eine zweite Organisationsschicht neben Playlists. Jeder Tag hat einen farbigen Punkt und kann beliebig viele Songs und Playlists enthalten; Tags selbst gehören nie zu Playlists. In normalen Songzeilen werden aus Platzgründen nur die Punkte angezeigt. In der näheren Songansicht stehen Punkt und Tagname zusammen.\n\nDer Tags-Bereich und der Playlists-Bereich lassen sich durch Antippen ihrer freien Überschrift ein- und ausklappen. Tags haben eine eigene gespeicherte Sortierung: Manuell, A–Z Anfang, A–Z Ende, summierte Höranzahl, Anzahl der Lieder und Chronik.",
"Tags sind eine zweite Organisationsschicht neben Playlists. Jeder Tag hat einen farbigen Punkt und kann beliebig viele Songs und Playlists enthalten; Tags selbst gehören nie zu Playlists. Beim Erstellen und Umbenennen kann die Farbe aus einer kompakten Palette mit ungefähr 100 Farben gewählt werden. In normalen Songzeilen werden aus Platzgründen nur die Punkte angezeigt. In der näheren Songansicht stehen Punkt und Tagname zusammen.\n\nDer Tags-Bereich und der Playlists-Bereich lassen sich durch Antippen ihrer freien Überschrift ein- und ausklappen. Die Sortiersteuerung steht nicht dauerhaft unter der Überschrift, sondern in `••• → Umbenennen → Sortieren` des jeweiligen Tags bzw. der Playlist. Tags und Playlists speichern ihren Sortiermodus und die Richtung getrennt. Für Tags stehen Manuell, A–Z Anfang, A–Z Ende, summierte Höranzahl, Anzahl der Lieder und Chronik bereit; Playlists verwenden dieselben passenden Kriterien."
)
concept += "\n\n## Detailansicht und kleine Bedienkorrekturen\n\nDie nähere Songansicht besitzt ein eigenes `•••` mit songbezogenen Aktionen wie Umbenennen, Kopieren/Einfügen, Tags, Teilen und Loop-Funktionen. Listenweite Aktionen wie das Sortieren von Tags oder Playlists werden dort bewusst nicht gezeigt. In der Tag-Zuordnung bedeutet `+` hinzufügen und `−` entfernen; eine teilweise Mehrfachzuordnung bleibt als `±` sichtbar. Home schließt auch aus dem Loop-Editor zuverlässig den Editor und öffnet die Bibliothek.\n"

app_path.write_text(app)
css_path.write_text(css)
arch_path.write_text(arch)
concept_path.write_text(concept)
print('patched tag colors, sidebar sorting, detail menu, repeat menu and loop home')
