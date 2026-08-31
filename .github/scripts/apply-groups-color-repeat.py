from pathlib import Path
import re

app_path = Path('src/App.tsx')
css_path = Path('src/enhancements.css')
architecture_path = Path('architecture.md')
concept_path = Path('concept.md')
app = app_path.read_text()
css = css_path.read_text()
architecture = architecture_path.read_text()
concept = concept_path.read_text()

def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing pattern: {label}')
    if text.count(old) != 1:
        raise SystemExit(f'pattern not unique ({text.count(old)}): {label}')
    return text.replace(old, new, 1)

# Imports and types
app = replace_once(app, "import './enhancements.css'", "import { ColorSpectrumPicker } from './ColorSpectrumPicker'\nimport './enhancements.css'", 'color picker import')
app = replace_once(app,
"type OverflowMenu = { kind: 'song' | 'songDetail' | 'playlist' | 'playlists' | 'tag' | 'tags'; id?: string } | null\ntype SidebarSortTarget = 'tags' | 'playlists' | null\ntype RepeatSetting = { kind: 'infinite' } | { kind: 'count'; count: number } | null",
"type OverflowMenu = { kind: 'song' | 'songDetail' | 'playlist' | 'playlists' | 'tag' | 'tags' | 'group'; id?: string } | null\ntype SidebarSortTarget = 'tags' | 'playlists' | null\ntype RepeatSetting = { kind: 'infinite' } | { kind: 'count'; count: number } | null\ntype GroupKind = 'song' | 'playlist' | 'tag'\ntype GroupSortMode = 'general' | SortMode\ntype ObjectGroup = { id: string; kind: GroupKind; name: string; itemIds: string[]; createdAt: number; sortOrder: number; sortMode: GroupSortMode; sortDirection: SortDirection }\ntype SidebarSelectionKind = 'playlist' | 'tag' | null\ntype GroupMembershipTarget = { groupId: string; mode: 'add' | 'remove' } | null",
'group types')

# Remove the fixed palette.
app = re.sub(r"\nconst TAG_COLOR_PALETTE = Array\.from\(\{ length: 100 \}, \(_, index\) => \{.*?\n\}\)\n", "\n", app, count=1, flags=re.S)

# State additions and color state replacements.
app = replace_once(app,
"  const [repeatCountInput, setRepeatCountInput] = useState('3')\n  const [shuffle, setShuffle] = useState(false)",
"  const [repeatCountInput, setRepeatCountInput] = useState('3')\n  const [objectGroups, setObjectGroups] = useState<ObjectGroup[]>(() => { try { const parsed = JSON.parse(localStorage.getItem('josi-object-groups') ?? '[]'); return Array.isArray(parsed) ? parsed : [] } catch { return [] } })\n  const [groupPlaybackIds, setGroupPlaybackIds] = useState<string[] | null>(null)\n  const [sidebarSelectionKind, setSidebarSelectionKind] = useState<SidebarSelectionKind>(null)\n  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<Set<string>>(new Set())\n  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set())\n  const [sidebarSelectionMenuOpen, setSidebarSelectionMenuOpen] = useState(false)\n  const [groupRenameId, setGroupRenameId] = useState<string | null>(null)\n  const [groupRenameValue, setGroupRenameValue] = useState('')\n  const [groupSortId, setGroupSortId] = useState<string | null>(null)\n  const [groupMembershipTarget, setGroupMembershipTarget] = useState<GroupMembershipTarget>(null)\n  const [groupReorderId, setGroupReorderId] = useState<string | null>(null)\n  const [groupMoveId, setGroupMoveId] = useState<string | null>(null)\n  const [colorPickerTarget, setColorPickerTarget] = useState<'create' | 'rename' | null>(null)\n  const [shuffle, setShuffle] = useState(false)",
'group states')
app = replace_once(app,
"  const [tagColor, setTagColor] = useState(TAG_COLOR_PALETTE[0])\n  const [tagColorPickerOpen, setTagColorPickerOpen] = useState(false)",
"  const [tagColor, setTagColor] = useState('#60a5fa')",
'tag color create state')
app = replace_once(app,
"  const [renameTagColor, setRenameTagColor] = useState(TAG_COLOR_PALETTE[0])",
"  const [renameTagColor, setRenameTagColor] = useState('#60a5fa')",
'tag color rename state')
app = replace_once(app,
"  const repeatHoldTriggeredRef = useRef(false)",
"  const repeatHoldTriggeredRef = useRef(false)\n  const repeatRemainingRef = useRef<number | null>(null)",
'repeat remaining ref')

# Persistence and repeat ref synchronization.
app = replace_once(app,
"  useEffect(() => { localStorage.setItem('josi-tags-collapsed', tagsCollapsed ? '1' : '0') }, [tagsCollapsed])",
"  useEffect(() => { localStorage.setItem('josi-tags-collapsed', tagsCollapsed ? '1' : '0') }, [tagsCollapsed])\n  useEffect(() => { localStorage.setItem('josi-object-groups', JSON.stringify(objectGroups)) }, [objectGroups])",
'group persistence')
app = replace_once(app,
"  useEffect(() => {\n    if (repeatSetting?.kind === 'count') setRepeatRemaining(repeatSetting.count)\n    else setRepeatRemaining(null)\n  }, [currentSongId, repeatSetting])",
"  useEffect(() => {\n    const next = repeatSetting?.kind === 'count' ? repeatSetting.count : null\n    repeatRemainingRef.current = next\n    setRepeatRemaining(next)\n  }, [currentSongId, repeatSetting])",
'repeat sync effect')

# Player queue can be temporarily replaced by a song group.
app = replace_once(app,
"  const playerQueue = view === 'tag' && activeTag ? tagSongQueue : activePlaylist ? manualQueue : [...songs].sort((a, b) => (a.libraryOrder ?? a.addedAt) - (b.libraryOrder ?? b.addedAt))",
"  const normalPlayerQueue = view === 'tag' && activeTag ? tagSongQueue : activePlaylist ? manualQueue : [...songs].sort((a, b) => (a.libraryOrder ?? a.addedAt) - (b.libraryOrder ?? b.addedAt))\n  const groupPlayerQueue = groupPlaybackIds ? groupPlaybackIds.map((id) => songs.find((song) => song.id === id)).filter((song): song is Song => Boolean(song)) : []\n  const playerQueue = groupPlayerQueue.length ? groupPlayerQueue : normalPlayerQueue",
'group player queue')

# Keep group playback active only while navigating inside the group.
app = replace_once(app,
"  const playSong = (id: string, remember = true) => {\n    if (selectionMode) return toggleSelected(id)",
"  const playSong = (id: string, remember = true, preserveGroupQueue = false) => {\n    if (selectionMode) return toggleSelected(id)\n    if (!preserveGroupQueue) setGroupPlaybackIds(null)",
'playSong signature')
app = replace_once(app,
"    playSong(song.id)\n  }\n  const moveSong",
"    playSong(song.id, true, true)\n  }\n  const moveSong",
'playQueueSong preserve group')
app = app.replace("return playSong(options[Math.floor(Math.random() * options.length)].id)", "return playSong(options[Math.floor(Math.random() * options.length)].id, true, true)")
app = app.replace("if (repeatQueue) return playSong(playerQueue[direction === 1 ? 0 : playerQueue.length - 1].id)", "if (repeatQueue) return playSong(playerQueue[direction === 1 ? 0 : playerQueue.length - 1].id, true, true)")

# Rename tag color fallback and tag creation reset.
app = app.replace("tags.find((tag) => tag.id === id)?.color ?? TAG_COLOR_PALETTE[0]", "tags.find((tag) => tag.id === id)?.color ?? '#60a5fa'")
app = replace_once(app,
"    await saveTag(tag); setTags((items) => [...items, tag]); setTagName(''); setTagColorPickerOpen(false); setTagColor(TAG_COLOR_PALETTE[(tags.length + 1) % TAG_COLOR_PALETTE.length])",
"    await saveTag(tag); setTags((items) => [...items, tag]); setTagName(''); setTagColor('#60a5fa')",
'createTag color reset')

# Robust repeat helpers and handlers.
app = replace_once(app,
"  const clearRepeatHold = () => {",
"  const setRepeatRemainingNow = (value: number | null) => { repeatRemainingRef.current = value; setRepeatRemaining(value) }\n  const consumeRepeat = () => { const current = Math.max(0, repeatRemainingRef.current ?? 0); const next = Math.max(0, current - 1); setRepeatRemainingNow(next); return next }\n  const restartFinishedAudio = (audio: HTMLAudioElement) => { cancelLoopTransition(); const other = otherPlaybackAudio(audio); other?.pause(); playbackAudioRef.current = audio; audio.currentTime = 0; setCurrentTime(0); requestAnimationFrame(() => void audio.play().catch(() => setMessage('Die Wiederholung konnte nicht gestartet werden.'))) }\n  const clearRepeatHold = () => {",
'repeat helpers')
app = replace_once(app,
"    if (repeatSetting) { setRepeatSetting(null); setRepeatRemaining(null); setRepeatQueue(false); return }",
"    if (repeatSetting) { setRepeatSetting(null); setRepeatRemainingNow(null); setRepeatQueue(false); return }",
'repeat click clear')
app = replace_once(app,
"  const chooseInfiniteRepeat = () => { setRepeatSetting({ kind: 'infinite' }); setRepeatRemaining(null); setRepeatQueue(false); setRepeatMenuOpen(false) }\n  const chooseCountRepeat = () => {\n    const count = Math.max(1, Math.min(9999, Math.floor(Number(repeatCountInput) || 1)))\n    setRepeatCountInput(String(count)); setRepeatSetting({ kind: 'count', count }); setRepeatRemaining(count); setRepeatQueue(false); setRepeatMenuOpen(false)\n  }",
"  const chooseInfiniteRepeat = () => { setRepeatSetting({ kind: 'infinite' }); setRepeatRemainingNow(null); setRepeatQueue(false); setRepeatMenuOpen(false) }\n  const chooseCountRepeat = () => {\n    const count = Math.max(1, Math.min(9999, Math.floor(Number(repeatCountInput) || 1)))\n    setRepeatCountInput(String(count)); setRepeatSetting({ kind: 'count', count }); setRepeatRemainingNow(count); setRepeatQueue(false); setRepeatMenuOpen(false)\n  }",
'repeat choices')
# Replace decrement setters in loop RAF with synchronous helper.
app = app.replace("if (repeatSetting?.kind === 'count') setRepeatRemaining((value) => Math.max(0, (value ?? 0) - 1))", "if (repeatSetting?.kind === 'count') consumeRepeat()")
app = app.replace("(repeatSetting?.kind !== 'count' || (repeatRemaining ?? 0) > 0)", "(repeatSetting?.kind !== 'count' || (repeatRemainingRef.current ?? 0) > 0)")

# Replace audio ended logic entirely.
old_ended = re.search(r"  const handleAudioEnded = \(audio: HTMLAudioElement\) => \{.*?\n  \}\n\n  return <div", app, re.S)
if not old_ended:
    raise SystemExit('missing handleAudioEnded block')
new_ended = """  const handleAudioEnded = (audio: HTMLAudioElement) => {
    if (loopTransitionRef.current?.outgoing === audio || currentPlaybackAudio() !== audio) return
    const remaining = repeatRemainingRef.current ?? 0
    const finiteAvailable = repeatSetting?.kind !== 'count' || remaining > 0
    if (currentSong?.loopEnabled && currentSong.loopStart !== undefined && currentSong.loopEnd !== undefined && finiteAvailable) {
      const automatic = loopOverlapBlockedRef.current ? automaticLoopSeamsRef.current.get(currentSong.id) : undefined
      audio.currentTime = automatic?.start ?? currentSong.loopStart
      setCurrentTime(audio.currentTime)
      if (repeatSetting?.kind === 'count') consumeRepeat()
      void audio.play().catch(() => undefined)
      return
    }
    if (currentSong && !currentSong.loopEnabled && repeatSetting?.kind === 'infinite') { restartFinishedAudio(audio); return }
    if (currentSong && !currentSong.loopEnabled && repeatSetting?.kind === 'count' && remaining > 0) { consumeRepeat(); restartFinishedAudio(audio); return }
    if (currentSong) void updateSong({ ...currentSong, completedPlays: (currentSong.completedPlays ?? 0) + 1 })
    moveSong(1)
  }

  return <div"""
app = app[:old_ended.start()] + new_ended + app[old_ended.end():]

# Insert grouping helpers before repeat badge / old palette renderer.
marker = "  const renderTagColorPalette = (selected: string, onSelect: (color: string) => void) => <div className=\"tag-color-palette\" role=\"group\" aria-label=\"Tag-Farbe wählen\">{TAG_COLOR_PALETTE.map((color) => <button key={color} className={selected === color ? 'selected' : ''} type=\"button\" style={{ background: color }} onClick={() => onSelect(color)} aria-label={`Farbe ${color}`} />)}</div>\n"
if marker not in app:
    raise SystemExit('missing palette renderer')
helpers = r'''  const globalSortForKind = (kind: GroupKind) => kind === 'song' ? { mode: sortMode, direction: sortDirection } : kind === 'playlist' ? { mode: playlistSortMode, direction: playlistSortDirection } : { mode: tagSortMode, direction: tagSortDirection }
  const itemDuration = (kind: GroupKind, id: string) => {
    if (kind === 'song') return songs.find((song) => song.id === id)?.duration ?? 0
    if (kind === 'playlist') return (playlists.find((playlist) => playlist.id === id)?.songIds ?? []).reduce((sum, songId) => sum + (songs.find((song) => song.id === songId)?.duration ?? 0), 0)
    return (tags.find((tag) => tag.id === id)?.songIds ?? []).reduce((sum, songId) => sum + (songs.find((song) => song.id === songId)?.duration ?? 0), 0)
  }
  const itemPlays = (kind: GroupKind, id: string) => {
    if (kind === 'song') return songs.find((song) => song.id === id)?.completedPlays ?? 0
    if (kind === 'playlist') return (playlists.find((playlist) => playlist.id === id)?.songIds ?? []).reduce((sum, songId) => sum + (songs.find((song) => song.id === songId)?.completedPlays ?? 0), 0)
    return (tags.find((tag) => tag.id === id)?.songIds ?? []).reduce((sum, songId) => sum + (songs.find((song) => song.id === songId)?.completedPlays ?? 0), 0)
  }
  const itemSongCount = (kind: GroupKind, id: string) => kind === 'song' ? 1 : kind === 'playlist' ? (playlists.find((playlist) => playlist.id === id)?.songIds.length ?? 0) : (tags.find((tag) => tag.id === id)?.songIds.filter((songId) => songs.some((song) => song.id === songId)).length ?? 0)
  const objectFor = (kind: GroupKind, id: string): Song | Playlist | Tag | null => kind === 'song' ? songs.find((song) => song.id === id) ?? null : kind === 'playlist' ? playlists.find((playlist) => playlist.id === id) ?? null : tags.find((tag) => tag.id === id) ?? null
  const compareObjects = (kind: GroupKind, a: Song | Playlist | Tag, b: Song | Playlist | Tag, mode: SortMode) => {
    if (mode === 'azStart') return a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' })
    if (mode === 'azEnd') return reverseText(a.name).localeCompare(reverseText(b.name), 'de', { numeric: true, sensitivity: 'base' })
    if (mode === 'plays') return itemPlays(kind, a.id) - itemPlays(kind, b.id) || a.name.localeCompare(b.name, 'de')
    if (mode === 'duration') return (kind === 'song' ? itemDuration(kind, a.id) - itemDuration(kind, b.id) : itemSongCount(kind, a.id) - itemSongCount(kind, b.id)) || a.name.localeCompare(b.name, 'de')
    const aTime = kind === 'song' ? (a as Song).addedAt : (a as Playlist | Tag).createdAt
    const bTime = kind === 'song' ? (b as Song).addedAt : (b as Playlist | Tag).createdAt
    return aTime - bTime
  }
  const orderedGroupItems = (group: ObjectGroup, allowed: Array<Song | Playlist | Tag>) => {
    const allowedMap = new Map(allowed.map((item) => [item.id, item]))
    if (group.sortMode === 'general') return allowed.filter((item) => group.itemIds.includes(item.id))
    if (group.sortMode === 'manual') return group.itemIds.map((id) => allowedMap.get(id)).filter((item): item is Song | Playlist | Tag => Boolean(item))
    const direction = group.sortDirection === 'down' ? 1 : -1
    return group.itemIds.map((id) => allowedMap.get(id)).filter((item): item is Song | Playlist | Tag => Boolean(item)).sort((a, b) => compareObjects(group.kind, a, b, group.sortMode as SortMode) * direction)
  }
  const groupDuration = (group: ObjectGroup, allowed: Array<Song | Playlist | Tag>) => orderedGroupItems(group, allowed).reduce((sum, item) => sum + itemDuration(group.kind, item.id), 0)
  const sortedGroupsFor = (kind: GroupKind, allowed: Array<Song | Playlist | Tag>) => {
    const allowedIds = new Set(allowed.map((item) => item.id))
    const candidates = objectGroups.filter((group) => group.kind === kind && group.itemIds.some((id) => allowedIds.has(id)))
    const { mode, direction } = globalSortForKind(kind)
    if (mode === 'manual') return [...candidates].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
    const sign = direction === 'down' ? 1 : -1
    const metric = (group: ObjectGroup) => {
      const ids = group.itemIds.filter((id) => allowedIds.has(id))
      if (mode === 'plays') return ids.reduce((sum, id) => sum + itemPlays(kind, id), 0)
      if (mode === 'duration') return kind === 'song' ? ids.reduce((sum, id) => sum + itemDuration(kind, id), 0) : ids.reduce((sum, id) => sum + itemSongCount(kind, id), 0)
      return group.createdAt
    }
    return [...candidates].sort((a, b) => {
      if (mode === 'azStart') return a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' }) * sign
      if (mode === 'azEnd') return reverseText(a.name).localeCompare(reverseText(b.name), 'de', { numeric: true, sensitivity: 'base' }) * sign
      return (metric(a) - metric(b) || a.name.localeCompare(b.name, 'de')) * sign
    })
  }
  const createObjectGroup = (kind: GroupKind, sourceIds: string[]) => {
    const valid = [...new Set(sourceIds)].filter((id) => Boolean(objectFor(kind, id)))
    if (valid.length < 2) { setMessage('Wähle mindestens zwei Objekte zum Gruppieren aus.'); return }
    setObjectGroups((current) => {
      const next = current.map((group) => group.kind === kind ? { ...group, itemIds: group.itemIds.filter((id) => !valid.includes(id)) } : group).filter((group) => group.kind !== kind || group.itemIds.length >= 2)
      const minOrder = Math.min(0, ...next.filter((group) => group.kind === kind).map((group) => group.sortOrder))
      return [{ id: crypto.randomUUID(), kind, name: 'Unbenannt', itemIds: valid, createdAt: Date.now(), sortOrder: minOrder - 1, sortMode: 'general', sortDirection: 'down' }, ...next]
    })
    if (kind === 'song') stopSelection()
    else { setSidebarSelectionKind(null); setSelectedPlaylistIds(new Set()); setSelectedTagIds(new Set()); setSidebarSelectionMenuOpen(false) }
  }
  const startSidebarSelection = (kind: 'playlist' | 'tag') => { setSidebarSelectionKind(kind); setSelectedPlaylistIds(new Set()); setSelectedTagIds(new Set()); setSidebarSelectionMenuOpen(false); setOverflowMenu(null) }
  const stopSidebarSelection = () => { setSidebarSelectionKind(null); setSelectedPlaylistIds(new Set()); setSelectedTagIds(new Set()); setSidebarSelectionMenuOpen(false) }
  const toggleSidebarSelected = (kind: 'playlist' | 'tag', id: string) => {
    const setter = kind === 'playlist' ? setSelectedPlaylistIds : setSelectedTagIds
    setter((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  const updateObjectGroup = (id: string, change: (group: ObjectGroup) => ObjectGroup) => setObjectGroups((current) => current.map((group) => group.id === id ? change(group) : group))
  const dissolveGroup = (id: string) => { setObjectGroups((current) => current.filter((group) => group.id !== id)); setOverflowMenu(null); setGroupReorderId((value) => value === id ? null : value); setGroupMoveId((value) => value === id ? null : value) }
  const openGroupRename = (group: ObjectGroup) => { setGroupRenameId(group.id); setGroupRenameValue(group.name); setOverflowMenu(null) }
  const saveGroupRename = (event: React.FormEvent) => { event.preventDefault(); const value = groupRenameValue.trim(); if (!groupRenameId || !value) return; updateObjectGroup(groupRenameId, (group) => ({ ...group, name: value })); setGroupRenameId(null) }
  const moveGroup = (id: string, delta: -1 | 1) => {
    const target = objectGroups.find((group) => group.id === id); if (!target) return
    if (target.kind === 'song') setSortMode('manual'); else if (target.kind === 'playlist') setPlaylistSortMode('manual'); else setTagSortMode('manual')
    setObjectGroups((current) => {
      const same = current.filter((group) => group.kind === target.kind).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
      const index = same.findIndex((group) => group.id === id); const other = same[index + delta]; if (!other) return current
      const aOrder = same[index].sortOrder; const bOrder = other.sortOrder
      return current.map((group) => group.id === id ? { ...group, sortOrder: bOrder } : group.id === other.id ? { ...group, sortOrder: aOrder } : group)
    })
  }
  const moveGroupItem = (groupId: string, itemId: string, delta: -1 | 1) => updateObjectGroup(groupId, (group) => { const ids = [...group.itemIds]; const index = ids.indexOf(itemId); const other = index + delta; if (index < 0 || other < 0 || other >= ids.length) return group; [ids[index], ids[other]] = [ids[other], ids[index]]; return { ...group, itemIds: ids, sortMode: 'manual' } })
  const addItemToGroup = (groupId: string, itemId: string) => {
    const target = objectGroups.find((group) => group.id === groupId); if (!target || !objectFor(target.kind, itemId)) return
    setObjectGroups((current) => current.map((group) => {
      if (group.kind !== target.kind) return group
      if (group.id === groupId) return group.itemIds.includes(itemId) ? group : { ...group, itemIds: [...group.itemIds, itemId] }
      return { ...group, itemIds: group.itemIds.filter((id) => id !== itemId) }
    }).filter((group) => group.kind !== target.kind || group.id === groupId || group.itemIds.length >= 2))
  }
  const removeItemFromGroup = (groupId: string, itemId: string) => setObjectGroups((current) => current.map((group) => group.id === groupId ? { ...group, itemIds: group.itemIds.filter((id) => id !== itemId) } : group).filter((group) => group.id !== groupId || group.itemIds.length >= 2))
  const playObjectGroup = (group: ObjectGroup) => {
    if (group.kind !== 'song') return
    const ordered = orderedGroupItems(group, visibleSongs).map((item) => item.id)
    const ids = ordered.length ? ordered : group.itemIds.filter((id) => songs.some((song) => song.id === id))
    if (!ids.length) return
    setGroupPlaybackIds(ids); playSong(ids[0], true, true); setOverflowMenu(null)
  }

  const songGroups = sortedGroupsFor('song', visibleSongs)
  const groupedSongIds = new Set(songGroups.flatMap((group) => group.itemIds.filter((id) => visibleSongs.some((song) => song.id === id))))
  const ungroupedVisibleSongs = visibleSongs.filter((song) => !groupedSongIds.has(song.id))
  const playlistGroups = sortedGroupsFor('playlist', sidebarPlaylists)
  const groupedPlaylistIds = new Set(playlistGroups.flatMap((group) => group.itemIds))
  const ungroupedSidebarPlaylists = sidebarPlaylists.filter((playlist) => !groupedPlaylistIds.has(playlist.id))
  const tagGroups = sortedGroupsFor('tag', sidebarTags)
  const groupedTagIds = new Set(tagGroups.flatMap((group) => group.itemIds))
  const ungroupedSidebarTags = sidebarTags.filter((tag) => !groupedTagIds.has(tag.id))

  const renderGroupHeader = (group: ObjectGroup, allowed: Array<Song | Playlist | Tag>) => {
    const items = orderedGroupItems(group, allowed)
    return <div className="object-group-header"><div className="object-group-heading"><strong>{group.name}</strong><span>{items.length} Objekte · {formatTime(groupDuration(group, allowed))}</span></div>{groupMoveId === group.id && <div className="group-inline-tools"><button type="button" onClick={() => moveGroup(group.id, -1)}>↑</button><button type="button" onClick={() => moveGroup(group.id, 1)}>↓</button><button type="button" onClick={() => setGroupMoveId(null)}>Fertig</button></div>}{groupReorderId === group.id && <button className="group-finish" type="button" onClick={() => setGroupReorderId(null)}>Fertig</button>}<button className="overflow-button group-overflow" type="button" onClick={() => setOverflowMenu({ kind: 'group', id: group.id })}>•••</button></div>
  }
  const renderSongRow = (song: Song, index: number, groupId?: string) => {
    const groupReordering = groupId === groupReorderId
    return <div key={song.id} className={`song-row${song.isNew ? ' new-import' : ''}${selectedSongIds.has(song.id) ? ' selected-song' : ''}${groupId ? ' grouped-object-row' : ''}`}>{groupReordering && <div className="group-item-reorder"><button type="button" onClick={() => moveGroupItem(groupId!, song.id, -1)}>↑</button><button type="button" onClick={() => moveGroupItem(groupId!, song.id, 1)}>↓</button></div>}{!groupId && songEditMode && <button className="move-selector" type="button" onClick={() => setMoveCandidate({ kind: 'song', id: song.id, targetIndex: null })}>↕</button>}{selectionMode && <button className="selection-check" type="button" onClick={() => toggleSelected(song.id)}>{selectedSongIds.has(song.id) ? '✓' : ''}</button>}<button className="song-main" type="button" onClick={() => playSong(song.id)} disabled={(!groupId && songEditMode) || groupReordering}><span className="song-number">{song.id === currentSongId && isPlaying ? '▶' : index + 1}</span><span className="song-copy"><strong>{song.name}</strong><small className="song-subline"><span className="song-tag-dots">{songTags(song.id).map((tag) => <i key={tag.id} className="tag-dot" style={{ background: tag.color }} title={tag.name} />)}</span><span>{view === 'history' ? formatDate(song.addedAt) : membershipText(song.id)}</span></small></span><span className="song-meta"><small>{!song.file || song.file.size === 0 ? 'FEHLT' : formatTime(song.duration)}</small>{song.loopStart !== undefined && song.loopEnd !== undefined && <span className="loop-badge">↻</span>}</span></button><button className="overflow-button song-overflow" type="button" onClick={() => setOverflowMenu({ kind: 'song', id: song.id })}>•••</button>{activePlaylist && view === 'library' && !selectionMode && !songEditMode && <button className="remove-song" type="button" onClick={() => void removeSongFromActivePlaylist(song.id)}>Entfernen</button>}{activeTag && view === 'tag' && !selectionMode && <button className="remove-song" type="button" onClick={() => void removeSongFromActiveTag(song.id)}>Entfernen</button>}</div>
  }
  const renderPlaylistRow = (playlist: Playlist, index: number, groupId?: string) => {
    const groupReordering = groupId === groupReorderId
    const selected = selectedPlaylistIds.has(playlist.id)
    return <div className={`playlist-nav-row${groupId ? ' grouped-object-row' : ''}`} key={playlist.id}>{groupReordering && <div className="group-item-reorder"><button type="button" onClick={() => moveGroupItem(groupId!, playlist.id, -1)}>↑</button><button type="button" onClick={() => moveGroupItem(groupId!, playlist.id, 1)}>↓</button></div>}{sidebarSelectionKind === 'playlist' && <button className="selection-check sidebar-selection-check" type="button" onClick={() => toggleSidebarSelected('playlist', playlist.id)}>{selected ? '✓' : ''}</button>}{!groupId && sidebarSelectionKind !== 'playlist' && reorderScope === 'sidebar' && <button className="move-selector" type="button" onClick={() => setMoveCandidate({ kind: 'playlist', id: playlist.id, targetIndex: null })}>↕</button>}<button className={`nav-item${activePlaylistId === playlist.id && view === 'library' ? ' active' : ''}${selected ? ' selected-sidebar-object' : ''}`} type="button" onClick={() => sidebarSelectionKind === 'playlist' ? toggleSidebarSelected('playlist', playlist.id) : void openPlaylist(playlist.id)} disabled={reorderScope === 'sidebar' || groupReordering}><span className="playlist-nav-name">{coverUrls[playlist.id] ? <img src={coverUrls[playlist.id]} alt="" /> : <span className="playlist-mini-cover">♫</span>}<span className="nav-tag-dots">{playlistTags(playlist.id).map((tag) => <i key={tag.id} className="tag-dot" style={{ background: tag.color }} />)}</span><span>{playlist.name}</span></span><strong>{playlist.songIds.length}</strong></button>{sidebarSelectionKind !== 'playlist' && <button className="overflow-button row-overflow" type="button" onClick={() => setOverflowMenu({ kind: 'playlist', id: playlist.id })}>•••</button>}</div>
  }
  const renderTagRow = (tag: Tag, index: number, groupId?: string) => {
    const groupReordering = groupId === groupReorderId
    const selected = selectedTagIds.has(tag.id)
    return <div className={`playlist-nav-row tag-nav-row${groupId ? ' grouped-object-row' : ''}`} key={tag.id}>{groupReordering && <div className="group-item-reorder"><button type="button" onClick={() => moveGroupItem(groupId!, tag.id, -1)}>↑</button><button type="button" onClick={() => moveGroupItem(groupId!, tag.id, 1)}>↓</button></div>}{sidebarSelectionKind === 'tag' && <button className="selection-check sidebar-selection-check" type="button" onClick={() => toggleSidebarSelected('tag', tag.id)}>{selected ? '✓' : ''}</button>}{!groupId && sidebarSelectionKind !== 'tag' && tagEditMode && <button className="move-selector" type="button" onClick={() => setMoveCandidate({ kind: 'tag', id: tag.id, targetIndex: null })}>↕</button>}<button className={`nav-item${activeTagId === tag.id && view === 'tag' ? ' active' : ''}${selected ? ' selected-sidebar-object' : ''}`} type="button" onClick={() => sidebarSelectionKind === 'tag' ? toggleSidebarSelected('tag', tag.id) : void openTag(tag.id)} disabled={tagEditMode || groupReordering}><span className="tag-nav-name"><i className="tag-dot" style={{ background: tag.color }} /><span>{tag.name}</span></span><strong>{tag.songIds.filter((id) => songs.some((song) => song.id === id)).length}</strong></button>{sidebarSelectionKind !== 'tag' && <button className="overflow-button row-overflow" type="button" onClick={() => setOverflowMenu({ kind: 'tag', id: tag.id })}>•••</button>}</div>
  }
  const renderPlaylistCard = (playlist: Playlist) => <div className="playlist-card-wrap" key={playlist.id}><button className="playlist-card" type="button" onClick={() => void openPlaylist(playlist.id)}><span className="playlist-card-cover">{coverUrls[playlist.id] ? <img src={coverUrls[playlist.id]} alt="" /> : '♫'}</span><strong><span className="card-tag-dots">{playlistTags(playlist.id).map((tag) => <i key={tag.id} className="tag-dot" style={{ background: tag.color }} />)}</span>{playlist.name}</strong><small>{playlist.songIds.length} {playlist.songIds.length === 1 ? 'Lied' : 'Lieder'}</small></button><button className="overflow-button card-overflow" type="button" onClick={() => setOverflowMenu({ kind: 'playlist', id: playlist.id })}>•••</button></div>
'''
app = app.replace(marker, helpers)

# Replace sidebar playlist and tag rendering, plus color trigger.
playlist_old = re.search(r"      \{!playlistsCollapsed && <><div className=\"playlist-nav\">.*?</form></>\}", app, re.S)
if not playlist_old: raise SystemExit('missing playlist sidebar block')
playlist_new = '''      {!playlistsCollapsed && <><div className="playlist-nav grouped-sidebar-list">{playlistGroups.map((group) => <section className="object-group sidebar-object-group" key={group.id}>{renderGroupHeader(group, sidebarPlaylists)}{orderedGroupItems(group, sidebarPlaylists).map((item, index) => renderPlaylistRow(item as Playlist, index, group.id))}</section>)}{renderDropZone(0, 'playlist')}{ungroupedSidebarPlaylists.map((playlist, index) => <div key={playlist.id}>{renderPlaylistRow(playlist, index)}{renderDropZone(index + 1, 'playlist')}</div>)}</div>
      <form className="new-playlist" onSubmit={createPlaylist}><input value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} placeholder="Neue Playlist" /><button type="submit" disabled={!playlistName.trim()}>+</button></form></>}'''
app = app[:playlist_old.start()] + playlist_new + app[playlist_old.end():]
tag_old = re.search(r"      \{!tagsCollapsed && <><div className=\"tag-nav\">.*?</form></>\}", app, re.S)
if not tag_old: raise SystemExit('missing tag sidebar block')
tag_new = '''      {!tagsCollapsed && <><div className="tag-nav grouped-sidebar-list">{tagGroups.map((group) => <section className="object-group sidebar-object-group" key={group.id}>{renderGroupHeader(group, sidebarTags)}{orderedGroupItems(group, sidebarTags).map((item, index) => renderTagRow(item as Tag, index, group.id))}</section>)}{renderDropZone(0, 'tag')}{ungroupedSidebarTags.map((tag, index) => <div key={tag.id}>{renderTagRow(tag, index)}{renderDropZone(index + 1, 'tag')}</div>)}</div><form className="new-playlist new-tag" onSubmit={createTag}><input value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder="Neuer Tag" /><div className="tag-color-picker-wrap rainbow-ring"><button className="tag-color-trigger" type="button" style={{ background: tagColor }} onClick={() => setColorPickerTarget('create')} aria-label="Tag-Farbe wählen" /></div><button type="submit" disabled={!tagName.trim()}>+</button></form></>}'''
app = app[:tag_old.start()] + tag_new + app[tag_old.end():]

# Replace song list branch with grouped rendering.
song_branch = re.search(r": visibleSongs\.length \? <div className=\"song-list\">.*?</div> : <div className=\"empty-state\">", app, re.S)
if not song_branch: raise SystemExit('missing song branch')
song_new = ''': visibleSongs.length ? <div className="song-list grouped-song-list">{songGroups.map((group) => <section className="object-group song-object-group" key={group.id}>{renderGroupHeader(group, visibleSongs)}{orderedGroupItems(group, visibleSongs).map((item, index) => renderSongRow(item as Song, index, group.id))}</section>)}{bulkMoveMode ? renderBulkMoveDropZone(0) : renderDropZone(0, 'song')}{ungroupedVisibleSongs.map((song, index) => <div key={song.id}>{renderSongRow(song, index)}{bulkMoveMode ? renderBulkMoveDropZone(index + 1) : renderDropZone(index + 1, 'song')}</div>)}</div> : <div className="empty-state">'''
app = app[:song_branch.start()] + song_new + app[song_branch.end():]

# Playlist overview gets groups at top as well.
overview_old = re.search(r"    \{view === 'playlistOverview' && <section className=\"playlist-overview\">.*?</section>\}\n", app, re.S)
if not overview_old: raise SystemExit('missing playlist overview')
overview_new = '''    {view === 'playlistOverview' && <section className="playlist-overview"><div className="playlist-overview-heading"><p className="eyebrow">DEINE MUSIK</p><h1>Playlists</h1><p>{playlists.length} Playlists</p></div>{playlistGroups.map((group) => <section className="object-group overview-object-group" key={group.id}>{renderGroupHeader(group, sidebarPlaylists)}<div className="playlist-grid">{orderedGroupItems(group, sidebarPlaylists).map((item) => renderPlaylistCard(item as Playlist))}</div></section>)}<div className="playlist-grid">{ungroupedSidebarPlaylists.map(renderPlaylistCard)}</div></section>}
'''
app = app[:overview_old.start()] + overview_new + app[overview_old.end():]

# Enable grouping from song selection.
app = replace_once(app, '<button type="button" disabled>Gruppieren</button>', '<button type="button" onClick={() => createObjectGroup(\'song\', [...selectedSongIds])} disabled={selectedSongIds.size < 2}>Gruppieren</button>', 'song grouping selection action')

# Add selection option to playlist/tag heading menus.
app = replace_once(app,
"{overflowMenu.kind === 'playlists' && <><button type=\"button\" onClick={() => beginReorder('sidebar')}>Bearbeiten</button><button type=\"button\" onClick={() => { setOverflowMenu(null); navigateTo({ view: 'playlistOverview', playlistId: activePlaylistId, detailOpen: false }) }}>Übersicht</button></>}",
"{overflowMenu.kind === 'playlists' && <><button type=\"button\" onClick={() => startSidebarSelection('playlist')}>Auswählen</button><button type=\"button\" onClick={() => beginReorder('sidebar')}>Bearbeiten</button><button type=\"button\" onClick={() => { setOverflowMenu(null); navigateTo({ view: 'playlistOverview', playlistId: activePlaylistId, detailOpen: false }) }}>Übersicht</button></>}",
'playlist heading selection')
app = replace_once(app,
"{overflowMenu.kind === 'tags' && <button type=\"button\" onClick={() => beginReorder('tags')}>Bearbeiten</button>}",
"{overflowMenu.kind === 'tags' && <><button type=\"button\" onClick={() => startSidebarSelection('tag')}>Auswählen</button><button type=\"button\" onClick={() => beginReorder('tags')}>Bearbeiten</button></>}",
'tag heading selection')

# Insert group overflow actions at beginning of overflow menu.
app = replace_once(app,
'<div className="overflow-menu">',
'''<div className="overflow-menu">{overflowMenu.kind === 'group' && overflowMenu.id && (() => { const group = objectGroups.find((item) => item.id === overflowMenu.id); if (!group) return null; return <>{group.kind === 'song' && <button type="button" onClick={() => playObjectGroup(group)}>Gruppe abspielen</button>}<button type="button" onClick={() => openGroupRename(group)}>Gruppe umbenennen</button><button type="button" onClick={() => { setGroupSortId(group.id); setOverflowMenu(null) }}>Sortieren</button><button type="button" onClick={() => { setGroupReorderId(group.id); setGroupMoveId(null); setOverflowMenu(null) }}>Reihenfolge ändern</button><button type="button" onClick={() => { setGroupMoveId(group.id); setGroupReorderId(null); setOverflowMenu(null) }}>Gruppe bewegen</button><button type="button" onClick={() => { setGroupMembershipTarget({ groupId: group.id, mode: 'add' }); setOverflowMenu(null) }}>Objekte hinzufügen</button><button type="button" onClick={() => { setGroupMembershipTarget({ groupId: group.id, mode: 'remove' }); setOverflowMenu(null) }}>Objekte entfernen</button><button className="danger-menu-action" type="button" onClick={() => dissolveGroup(group.id)}>Gruppe auflösen</button></> })()}''',
'group overflow menu')

# Rename dialog uses spectrum trigger instead of palette.
app = replace_once(app,
"{renameTarget.kind === 'tag' && <div className=\"rename-tag-color\"><span>Farbe</span>{renderTagColorPalette(renameTagColor, setRenameTagColor)}</div>}",
"{renameTarget.kind === 'tag' && <div className=\"rename-tag-color\"><span>Farbe</span><div className=\"tag-color-picker-wrap rainbow-ring\"><button className=\"tag-color-trigger\" type=\"button\" style={{ background: renameTagColor }} onClick={() => setColorPickerTarget('rename')} aria-label=\"Tag-Farbe wählen\" /></div></div>}",
'rename tag spectrum trigger')

# Insert sidebar selection dock and group/color modals before repeat menu.
modal_marker = "    {repeatMenuOpen && <div className=\"modal-backdrop repeat-choice-backdrop\""
if modal_marker not in app: raise SystemExit('missing modal marker')
modals = r'''    {sidebarSelectionKind && <div className="sidebar-selection-dock"><strong>{sidebarSelectionKind === 'playlist' ? selectedPlaylistIds.size : selectedTagIds.size} ausgewählt</strong><button type="button" onClick={stopSidebarSelection}>Abbrechen</button><div className="selection-more-wrap"><button className="selection-more-button" type="button" onClick={() => setSidebarSelectionMenuOpen((value) => !value)}>•••</button>{sidebarSelectionMenuOpen && <><button className="selection-menu-shield" type="button" onClick={() => setSidebarSelectionMenuOpen(false)} /><div className="selection-action-menu sidebar-selection-action-menu"><button type="button" disabled={(sidebarSelectionKind === 'playlist' ? selectedPlaylistIds.size : selectedTagIds.size) < 2} onClick={() => createObjectGroup(sidebarSelectionKind, [...(sidebarSelectionKind === 'playlist' ? selectedPlaylistIds : selectedTagIds)])}>Gruppieren</button></div></>}</div></div>}
    {groupRenameId && <div className="modal-backdrop" onMouseDown={() => setGroupRenameId(null)}><form className="confirm-dialog rename-dialog" onSubmit={saveGroupRename} onMouseDown={(event) => event.stopPropagation()}><h2>Gruppe umbenennen</h2><input value={groupRenameValue} onChange={(event) => setGroupRenameValue(event.target.value)} autoFocus /><div className="dialog-actions"><button type="button" onClick={() => setGroupRenameId(null)}>Abbrechen</button><button type="submit" disabled={!groupRenameValue.trim()}>Speichern</button></div></form></div>}
    {groupSortId && (() => { const group = objectGroups.find((item) => item.id === groupSortId); if (!group) return null; const labels = group.kind === 'song' ? sortLabels : group.kind === 'playlist' ? playlistSortLabels : tagSortLabels; return <div className="modal-backdrop" onMouseDown={() => setGroupSortId(null)}><div className="confirm-dialog group-sort-dialog" onMouseDown={(event) => event.stopPropagation()}><h2>Gruppe sortieren</h2><div className="sidebar-sort-controls"><select value={group.sortMode} onChange={(event) => updateObjectGroup(group.id, (item) => ({ ...item, sortMode: event.target.value as GroupSortMode }))}><option value="general">Allgemeine Sortierung</option>{(Object.keys(labels) as SortMode[]).map((mode) => <option key={mode} value={mode}>{labels[mode]}</option>)}</select><button type="button" disabled={group.sortMode === 'general' || group.sortMode === 'manual'} onClick={() => updateObjectGroup(group.id, (item) => ({ ...item, sortDirection: item.sortDirection === 'down' ? 'up' : 'down' }))}>{group.sortMode === 'general' || group.sortMode === 'manual' ? '—' : group.sortDirection === 'down' ? '↓' : '↑'}</button></div><p>„Allgemeine Sortierung“ übernimmt automatisch die Sortierung der gesamten Liste.</p><div className="dialog-actions"><button type="button" onClick={() => setGroupSortId(null)}>Fertig</button></div></div></div> })()}
    {groupMembershipTarget && (() => { const group = objectGroups.find((item) => item.id === groupMembershipTarget.groupId); if (!group) return null; const allItems: Array<Song | Playlist | Tag> = group.kind === 'song' ? songs : group.kind === 'playlist' ? playlists : tags; const candidates = groupMembershipTarget.mode === 'add' ? allItems.filter((item) => !group.itemIds.includes(item.id)) : orderedGroupItems(group, allItems); return <div className="playlist-chooser-backdrop group-membership-backdrop" onMouseDown={() => setGroupMembershipTarget(null)}><section className="playlist-chooser group-membership-dialog" onMouseDown={(event) => event.stopPropagation()}><div className="playlist-chooser-heading"><div><p className="eyebrow">GRUPPE</p><h2>{groupMembershipTarget.mode === 'add' ? 'Objekte hinzufügen' : 'Objekte entfernen'}</h2></div><button type="button" onClick={() => setGroupMembershipTarget(null)}>×</button></div><div className="group-membership-list">{candidates.map((item) => <button type="button" key={item.id} onClick={() => groupMembershipTarget.mode === 'add' ? addItemToGroup(group.id, item.id) : removeItemFromGroup(group.id, item.id)}><span>{item.name}</span><strong>{groupMembershipTarget.mode === 'add' ? '+' : '−'}</strong></button>)}{!candidates.length && <p>Keine passenden Objekte.</p>}</div></section></div> })()}
    {colorPickerTarget && <ColorSpectrumPicker initialColor={colorPickerTarget === 'create' ? tagColor : renameTagColor} onCancel={() => setColorPickerTarget(null)} onDone={(color) => { if (colorPickerTarget === 'create') setTagColor(color); else setRenameTagColor(color); setColorPickerTarget(null) }} />}
'''
app = app.replace(modal_marker, modals + modal_marker, 1)

# CSS for spectrum and groups.
css += r'''

/* Spectrum tag color picker */
.rainbow-ring { display:grid; place-items:center; width:34px; height:34px; padding:3px; border-radius:50%; background:conic-gradient(#ef4444,#f59e0b,#eab308,#22c55e,#06b6d4,#3b82f6,#8b5cf6,#ec4899,#ef4444); }
.rainbow-ring .tag-color-trigger { width:28px; height:28px; border:2px solid #111827; border-radius:50%; cursor:pointer; }
.color-spectrum-backdrop { z-index:260 !important; }
.color-spectrum-dialog { width:min(620px,calc(100vw - 24px)); }
.color-spectrum-field { position:relative; width:100%; aspect-ratio:1.6; min-height:240px; padding:0; overflow:hidden; border:1px solid #4b5563; border-radius:16px; cursor:crosshair; touch-action:none; background:linear-gradient(to bottom,#fff 0%,rgba(255,255,255,0) 50%,#000 100%),linear-gradient(to right,#f00 0%,#ff0 16.66%,#0f0 33.33%,#0ff 50%,#00f 66.66%,#f0f 83.33%,#f00 100%); }
.color-spectrum-point { position:absolute; width:18px; height:18px; margin:-9px 0 0 -9px; border:3px solid #fff; border-radius:50%; box-shadow:0 0 0 2px #111827,0 2px 8px rgba(0,0,0,.45); pointer-events:none; }
.color-spectrum-preview { display:flex; align-items:center; gap:10px; margin:14px 0; color:#cbd5e1; }
.color-spectrum-preview i { width:30px; height:30px; border:1px solid #64748b; border-radius:50%; }

/* Independent object groups */
.object-group { overflow:hidden; margin:0 0 14px; border:1px solid #cbd5e1; border-radius:12px; background:#d8dde5; color:#111827; }
.object-group-header { display:flex; align-items:center; gap:8px; min-height:40px; padding:5px 7px 5px 11px; border-bottom:1px solid #cbd5e1; background:#f8fafc; color:#111827; }
.object-group-heading { display:flex; flex:1; min-width:0; align-items:center; justify-content:space-between; gap:10px; }
.object-group-heading strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; }
.object-group-heading span { flex:0 0 auto; color:#475569; font-size:10px; }
.group-overflow { color:#111827 !important; }
.group-inline-tools,.group-item-reorder { display:flex; gap:3px; }
.group-inline-tools button,.group-finish,.group-item-reorder button { min-width:28px; min-height:28px; padding:0 6px; border:1px solid #94a3b8; border-radius:7px; background:#fff; color:#111827; cursor:pointer; }
.object-group .grouped-object-row,.object-group .song-row,.object-group .nav-item { background:#d8dde5 !important; color:#111827 !important; }
.object-group .song-row { border-bottom-color:#c1c7d0; }
.object-group .song-copy small,.object-group .song-meta,.object-group .nav-item > strong { color:#475569 !important; }
.object-group .overflow-button { color:#334155; }
.object-group .playlist-nav-row { background:#d8dde5; }
.song-object-group { margin:10px; }
.sidebar-object-group { margin:6px 0 10px; }
.sidebar-object-group .object-group-header { padding-left:8px; }
.sidebar-object-group .object-group-heading { display:grid; gap:1px; }
.sidebar-object-group .object-group-heading span { font-size:9px; }
.overview-object-group { margin-bottom:26px; padding-bottom:14px; }
.overview-object-group .playlist-grid { padding:14px; }
.overview-object-group .playlist-card { color:#111827; }
.grouped-sidebar-list { display:grid; }
.selected-sidebar-object { box-shadow:inset 3px 0 0 #7c3aed; }
.sidebar-selection-check { margin-left:4px; }
.sidebar-selection-dock { position:fixed; right:22px; bottom:182px; z-index:175; display:flex; align-items:center; gap:9px; padding:9px 10px 9px 14px; border:1px solid #475569; border-radius:999px; background:#171b24; box-shadow:0 16px 44px rgba(0,0,0,.45); }
.sidebar-selection-dock > strong { font-size:12px; }
.sidebar-selection-dock > button { min-height:38px; padding:0 11px; border:1px solid #3b4354; border-radius:999px; background:#252a36; cursor:pointer; }
.sidebar-selection-action-menu { bottom:56px; }
.group-membership-dialog { max-height:min(720px,82dvh); }
.group-membership-list { display:grid; max-height:600px; overflow:auto; padding:12px; }
.group-membership-list > button { display:flex; align-items:center; justify-content:space-between; min-height:46px; padding:0 12px; border:0; border-radius:9px; background:transparent; text-align:left; cursor:pointer; }
.group-membership-list > button:hover { background:#1c222e; }
.group-membership-list > button strong { display:grid; place-items:center; width:26px; height:26px; border-radius:50%; background:#303747; }
.group-membership-list > p { padding:20px; color:#8d96a6; text-align:center; }
.group-sort-dialog { width:min(500px,calc(100vw - 28px)); }
@media (max-width:620px) { .sidebar-selection-dock { right:12px; bottom:322px; max-width:calc(100vw - 24px); } .object-group-heading { align-items:flex-start; flex-direction:column; } .color-spectrum-field { min-height:200px; } }
'''

# Documentation updates.
architecture += r'''

## Objektgruppen und Farbfeld

Lieder, Playlists und Tags können jeweils innerhalb ihres eigenen Typs zu persistenten Objektgruppen zusammengefasst werden. Gruppen sind reine lokale Metadaten in `localStorage` und enthalten ID, Typ, Namen, Objekt-IDs, manuelle Gruppenposition sowie eine interne Sortierung. Audiodateien, Playlist-Inhalte und Tag-Zuordnungen werden dadurch nicht dupliziert. Ein Objekt kann innerhalb seines Typs höchstens einer Gruppe angehören; beim Hinzufügen zu einer anderen Gruppe wird es aus der vorherigen entfernt. Gruppen stehen in der jeweiligen Liste immer vor ungruppierten Objekten und werden untereinander nach der Sortierung der Gesamtliste angeordnet. Innerhalb der Gruppe kann `Allgemeine Sortierung` verwendet werden oder eine eigene Sortierung inklusive manueller Reihenfolge.

Die Gruppenzeile zeigt Name, Anzahl der aktuell dargestellten Objekte und deren Gesamtdauer. Gruppen für Songs können als temporäre Player-Queue abgespielt werden. Weitere Gruppenaktionen sind Umbenennen, Sortieren, Reihenfolge ändern, Gruppe bewegen, Objekte hinzufügen/entfernen und Auflösen. Playlists und Tags besitzen dafür einen eigenen Mehrfachauswahlmodus mit einem schwebenden `•••` unten rechts.

Die Tag-Farbauswahl verwendet keine feste Palette mehr. Ein zweidimensionales Spektrum wird rein im Frontend dargestellt; ein Tippen setzt einen nicht interaktiven Zielpunkt. Erst `Fertig` übernimmt die Farbe unter diesem Punkt, `Abbrechen` verwirft sie.

Die endliche Wiederholung verwendet zusätzlich einen synchronen Restzähler in einem Ref. Dadurch liest insbesondere das native `ended`-Ereignis bei normalen, nicht geloopten Songs immer den aktuellen Wert und startet das Audio zuverlässig neu, bevor nach Erreichen von 0 zum nächsten Song gewechselt wird.
'''
concept += r'''

## Gruppen

Mehrere ausgewählte Lieder, Playlists oder Tags können über `••• → Gruppieren` zu einer eigenen Gruppe zusammengefasst werden. Die drei Typen werden nie vermischt, und ein Objekt liegt immer nur in einer Gruppe seines Typs. Neue Gruppen heißen zunächst **Unbenannt**. Gruppen stehen vor allen ungruppierten Objekten; untereinander folgen sie der Sortierung der Gesamtliste.

Die fast weiße Gruppenzeile zeigt Gruppenname, Objektanzahl und Gesamtdauer. Die enthaltenen Objekte liegen auf einem hellgrauen Hintergrund. Das `•••` der Gruppe bietet bei Liedern **Gruppe abspielen** sowie für alle Typen **Gruppe umbenennen**, **Sortieren**, **Reihenfolge ändern**, **Gruppe bewegen**, **Objekte hinzufügen**, **Objekte entfernen** und **Gruppe auflösen**. Die interne Sortierung besitzt zusätzlich **Allgemeine Sortierung**, wodurch die Gruppe automatisch die Sortierung der gesamten Liste übernimmt.

Playlists und Tags erhalten über das `•••` ihrer Überschrift einen Auswahlmodus. Während dieser Auswahl erscheint wie bei Liedern ein eigener Drei-Punkte-Knopf unten rechts, über den gruppiert werden kann.

## Freie Tag-Farbe

Die frühere Palette entfällt. Der Farbkreis öffnet ein großes Spektrum mit praktisch allen Farbtönen von hell bis dunkel. Ein Tippen setzt einen rein visuellen, nicht greifbaren Punkt. **Fertig** übernimmt die Farbe unter dem Punkt in den Kreis; **Abbrechen** verwirft die Auswahl.

## Endliche Wiederholung ohne Loop

Die eingegebene Wiederholungszahl zählt auch bei unbearbeiteten Liedern zuverlässig pro vollständigem Durchlauf herunter. Solange der Restwert größer als 0 ist, startet dasselbe Lied erneut. Erst bei 0 wird zum nächsten Lied gewechselt. Für gespeicherte Loops bleibt dasselbe Prinzip pro Loop-Durchlauf bestehen.
'''

app_path.write_text(app)
css_path.write_text(css)
architecture_path.write_text(architecture)
concept_path.write_text(concept)
