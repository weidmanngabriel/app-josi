import { useEffect, useMemo, useRef, useState } from 'react'
import {
  deletePlaylist,
  getPlaylists,
  getSongs,
  savePlaylist,
  saveSong,
  saveSongOrder,
  saveSongs,
  type Playlist,
  type Song,
} from './musicDb'
import './enhancements.css'

function formatTime(seconds?: number) {
  if (!Number.isFinite(seconds)) return '--:--'
  const value = Math.max(0, seconds ?? 0)
  const minutes = Math.floor(value / 60)
  const rest = Math.floor(value % 60)
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)
}

type View = 'library' | 'history' | 'loops' | 'playlistOverview'
type NavigationEntry = { view: View; playlistId: string | null; detailOpen: boolean }
type ReorderScope = 'library' | 'playlist' | 'sidebar' | null
type MoveCandidate = { kind: 'song' | 'playlist'; id: string; targetIndex: number | null } | null
type Snapshot = { songs: Song[]; playlists: Playlist[] }
type PlaylistChooserMode = 'current' | 'bulk' | null
type SortMode = 'manual' | 'azStart' | 'azEnd' | 'plays' | 'duration' | 'chronology'
type SortDirection = 'down' | 'up'
type OverflowMenu = { kind: 'song' | 'playlist' | 'playlists'; id?: string } | null

type LoopSuggestion = { start: number; end: number; confidence: number }

async function decodeDuration(song: Song) {
  const context = new AudioContext()
  try {
    const decoded = await context.decodeAudioData((await song.file.arrayBuffer()).slice(0))
    return decoded.duration
  } finally {
    void context.close()
  }
}

async function suggestLoop(song: Song): Promise<LoopSuggestion> {
  const context = new AudioContext()
  try {
    const decoded = await context.decodeAudioData((await song.file.arrayBuffer()).slice(0))
    const duration = decoded.duration
    if (duration < 8) throw new Error('too-short')
    const channel = decoded.getChannelData(0)
    const sampleRate = decoded.sampleRate
    const points = 120
    const windowSamples = Math.max(128, Math.floor(Math.min(0.6, duration / 18) * sampleRate))
    const signature = (time: number) => {
      const start = Math.max(0, Math.min(channel.length - windowSamples - 1, Math.floor(time * sampleRate)))
      const stride = Math.max(1, Math.floor(windowSamples / 60))
      const values: number[] = []
      for (let i = 0; i < windowSamples; i += stride) values.push(channel[start + i])
      const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)
      const centered = values.map((value) => value - mean)
      const energy = Math.sqrt(centered.reduce((sum, value) => sum + value * value, 0) / Math.max(centered.length, 1)) || 1
      return centered.map((value) => value / energy)
    }
    const starts = Array.from({ length: points }, (_, i) => duration * (0.05 + 0.45 * i / (points - 1)))
    const ends = Array.from({ length: points }, (_, i) => duration * (0.55 + 0.4 * i / (points - 1)))
    const startSignatures = starts.map(signature)
    const endSignatures = ends.map(signature)
    let best = { score: Infinity, start: starts[0], end: ends[0] }
    for (let i = 0; i < starts.length; i += 1) {
      for (let j = 0; j < ends.length; j += 1) {
        const gap = ends[j] - starts[i]
        if (gap < Math.min(6, duration * 0.18)) continue
        const a = startSignatures[i]
        const b = endSignatures[j]
        let error = 0
        const count = Math.min(a.length, b.length)
        for (let k = 0; k < count; k += 1) {
          const diff = a[k] - b[k]
          error += diff * diff
        }
        error /= Math.max(count, 1)
        const score = error + Math.abs(gap - duration * 0.55) / duration * 0.08
        if (score < best.score) best = { score, start: starts[i], end: ends[j] }
      }
    }
    return { start: best.start, end: best.end, confidence: Math.round(Math.max(15, Math.min(92, 92 - best.score * 16))) }
  } finally {
    void context.close()
  }
}

function reverseText(value: string) {
  return [...value].reverse().join('')
}

function groupPlaylists(playlists: Playlist[]) {
  const sorted = [...playlists].sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' }))
  const groups = new Map<string, Playlist[]>()
  sorted.forEach((playlist) => {
    const first = playlist.name.trim().charAt(0).toUpperCase()
    const group = /[A-ZÄÖÜ]/.test(first) ? first : /[0-9]/.test(first) ? '0–9' : '#'
    groups.set(group, [...(groups.get(group) ?? []), playlist])
  })
  const order = (key: string) => key === '#' ? 0 : key === '0–9' ? 1 : 2
  return [...groups.entries()].sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0], 'de'))
}

function App() {
  const [songs, setSongs] = useState<Song[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null)
  const [view, setView] = useState<View>('library')
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentSongId, setCurrentSongId] = useState<string | null>(null)
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({})
  const [isPlaying, setIsPlaying] = useState(false)
  const [repeatQueue, setRepeatQueue] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playlistName, setPlaylistName] = useState('')
  const [editingName, setEditingName] = useState('')
  const [isEditingPlaylist, setIsEditingPlaylist] = useState(false)
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null)
  const [message, setMessage] = useState('')
  const [playHistory, setPlayHistory] = useState<string[]>([])
  const [reorderScope, setReorderScope] = useState<ReorderScope>(null)
  const [moveCandidate, setMoveCandidate] = useState<MoveCandidate>(null)
  const [undoStack, setUndoStack] = useState<Snapshot[]>([])
  const [redoStack, setRedoStack] = useState<Snapshot[]>([])
  const [navigation, setNavigation] = useState<NavigationEntry[]>([{ view: 'library', playlistId: null, detailOpen: false }])
  const [navigationIndex, setNavigationIndex] = useState(0)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set())
  const [playlistChooserMode, setPlaylistChooserMode] = useState<PlaylistChooserMode>(null)
  const [loopAnalyzingId, setLoopAnalyzingId] = useState<string | null>(null)
  const [overflowMenu, setOverflowMenu] = useState<OverflowMenu>(null)
  const [sortMode, setSortMode] = useState<SortMode>(() => (localStorage.getItem('josi-sort-mode') as SortMode) || 'manual')
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => (localStorage.getItem('josi-sort-direction') as SortDirection) || 'down')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const shouldAutoPlayRef = useRef(false)

  useEffect(() => {
    Promise.all([getSongs(), getPlaylists()]).then(([storedSongs, storedPlaylists]) => {
      setSongs(storedSongs)
      setPlaylists(storedPlaylists)
    }).catch(() => setMessage('Lokale Musikdaten konnten nicht geladen werden.'))
  }, [])

  useEffect(() => { localStorage.setItem('josi-sort-mode', sortMode) }, [sortMode])
  useEffect(() => { localStorage.setItem('josi-sort-direction', sortDirection) }, [sortDirection])

  const currentSong = songs.find((song) => song.id === currentSongId) ?? null
  const activePlaylist = playlists.find((playlist) => playlist.id === activePlaylistId) ?? null
  const sidebarPlaylists = useMemo(() => [...playlists].sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) || b.lastUsedAt - a.lastUsedAt), [playlists])
  const manualQueue = useMemo(() => {
    if (!activePlaylist) return [...songs].sort((a, b) => (a.libraryOrder ?? a.addedAt) - (b.libraryOrder ?? b.addedAt))
    const byId = new Map(songs.map((song) => [song.id, song]))
    return activePlaylist.songIds.map((id) => byId.get(id)).filter((song): song is Song => Boolean(song))
  }, [activePlaylist, songs])

  const baseVisibleSongs = useMemo(() => {
    if (view === 'history') return [...songs]
    if (view === 'loops') return songs.filter((song) => song.loopStart !== undefined && song.loopEnd !== undefined)
    return manualQueue
  }, [view, songs, manualQueue])

  const visibleSongs = useMemo(() => {
    const items = [...baseVisibleSongs]
    if (sortMode === 'manual') return items
    const direction = sortDirection === 'down' ? 1 : -1
    const compare = (a: Song, b: Song) => {
      if (sortMode === 'azStart') return a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' })
      if (sortMode === 'azEnd') return reverseText(a.name).localeCompare(reverseText(b.name), 'de', { numeric: true, sensitivity: 'base' })
      if (sortMode === 'plays') return (a.completedPlays ?? 0) - (b.completedPlays ?? 0) || a.name.localeCompare(b.name, 'de')
      if (sortMode === 'duration') return (a.duration ?? Number.MAX_SAFE_INTEGER) - (b.duration ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'de')
      return a.addedAt - b.addedAt
    }
    return items.sort((a, b) => compare(a, b) * direction)
  }, [baseVisibleSongs, sortMode, sortDirection])

  const playerQueue = activePlaylist ? manualQueue : [...songs].sort((a, b) => (a.libraryOrder ?? a.addedAt) - (b.libraryOrder ?? b.addedAt))
  const currentSongPlaylists = useMemo(() => currentSong ? playlists.filter((playlist) => playlist.songIds.includes(currentSong.id)) : [], [currentSong, playlists])
  const groupedPlaylists = useMemo(() => groupPlaylists(playlists), [playlists])

  useEffect(() => {
    const urls: Record<string, string> = {}
    playlists.forEach((playlist) => { if (playlist.cover) urls[playlist.id] = URL.createObjectURL(playlist.cover) })
    setCoverUrls(urls)
    return () => Object.values(urls).forEach((url) => URL.revokeObjectURL(url))
  }, [playlists])

  useEffect(() => {
    if (!currentSong) return setCurrentUrl(null)
    const url = URL.createObjectURL(currentSong.file)
    setCurrentUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [currentSong])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentUrl) return
    audio.load()
    if (shouldAutoPlayRef.current) void audio.play().catch(() => setIsPlaying(false))
  }, [currentUrl])

  const snapshot = (): Snapshot => ({ songs: songs.map((song) => ({ ...song })), playlists: playlists.map((playlist) => ({ ...playlist, songIds: [...playlist.songIds] })) })
  const recordHistory = () => { setUndoStack((items) => [...items, snapshot()].slice(-50)); setRedoStack([]) }
  const restoreSnapshot = async (target: Snapshot) => {
    const previous = playlists
    setSongs(target.songs)
    setPlaylists(target.playlists)
    await saveSongOrder(target.songs)
    const targetIds = new Set(target.playlists.map((playlist) => playlist.id))
    await Promise.all(previous.filter((playlist) => !targetIds.has(playlist.id)).map((playlist) => deletePlaylist(playlist.id)))
    await Promise.all(target.playlists.map(savePlaylist))
  }
  const undo = async () => { const target = undoStack.at(-1); if (!target || moveCandidate) return; setUndoStack((items) => items.slice(0, -1)); setRedoStack((items) => [...items, snapshot()].slice(-50)); await restoreSnapshot(target) }
  const redo = async () => { const target = redoStack.at(-1); if (!target || moveCandidate) return; setRedoStack((items) => items.slice(0, -1)); setUndoStack((items) => [...items, snapshot()].slice(-50)); await restoreSnapshot(target) }

  const applyNavigation = (entry: NavigationEntry) => {
    setView(entry.view); setActivePlaylistId(entry.playlistId); setDetailOpen(entry.detailOpen); setSelectionMode(false); setSelectedSongIds(new Set()); setOverflowMenu(null)
  }
  const navigateTo = (entry: NavigationEntry) => {
    const current = navigation[navigationIndex]
    if (current && current.view === entry.view && current.playlistId === entry.playlistId && current.detailOpen === entry.detailOpen) return
    const next = [...navigation.slice(0, navigationIndex + 1), entry].slice(-60)
    setNavigation(next); setNavigationIndex(next.length - 1); applyNavigation(entry)
  }
  const navigateBack = () => { if (navigationIndex <= 0) return; const next = navigationIndex - 1; setNavigationIndex(next); applyNavigation(navigation[next]) }
  const navigateForward = () => { if (navigationIndex >= navigation.length - 1) return; const next = navigationIndex + 1; setNavigationIndex(next); applyNavigation(navigation[next]) }

  const updateSong = async (updated: Song, addHistory = false) => { if (addHistory) recordHistory(); setSongs((items) => items.map((song) => song.id === updated.id ? updated : song)); await saveSong(updated) }
  const updatePlaylist = async (updated: Playlist, addHistory = false) => { if (addHistory) recordHistory(); setPlaylists((items) => items.map((playlist) => playlist.id === updated.id ? updated : playlist)); await savePlaylist(updated) }

  const toggleSelected = (id: string) => setSelectedSongIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const playSong = (id: string, remember = true) => {
    if (selectionMode) return toggleSelected(id)
    if (id === currentSongId && audioRef.current) return void audioRef.current.play()
    if (remember && currentSongId) setPlayHistory((items) => [...items, currentSongId].slice(-50))
    shouldAutoPlayRef.current = true; setCurrentSongId(id); setCurrentTime(0)
  }
  const moveSong = (direction: 1 | -1) => {
    if (!playerQueue.length) return
    const currentIndex = playerQueue.findIndex((song) => song.id === currentSongId)
    if (shuffle && direction === 1 && playerQueue.length > 1) {
      const options = playerQueue.filter((song) => song.id !== currentSongId)
      return playSong(options[Math.floor(Math.random() * options.length)].id)
    }
    const nextIndex = currentIndex < 0 ? (direction === 1 ? 0 : playerQueue.length - 1) : currentIndex + direction
    if (nextIndex >= 0 && nextIndex < playerQueue.length) return playSong(playerQueue[nextIndex].id)
    if (repeatQueue) return playSong(playerQueue[direction === 1 ? 0 : playerQueue.length - 1].id)
    shouldAutoPlayRef.current = false; setIsPlaying(false)
  }
  const togglePlayback = () => { const audio = audioRef.current; if (!currentSong) return playerQueue[0] && playSong(playerQueue[0].id); if (!audio) return; if (audio.paused) void audio.play(); else audio.pause() }
  const seek = (value: number) => { if (!audioRef.current) return; audioRef.current.currentTime = value; setCurrentTime(value) }
  const skipSeconds = (seconds: number) => seek(Math.max(0, Math.min(duration || 0, currentTime + seconds)))
  const playPreviousFromHistory = () => { const previous = playHistory.at(-1); if (!previous) return; setPlayHistory((items) => items.slice(0, -1)); playSong(previous, false) }

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = currentSong ? new MediaMetadata({ title: currentSong.name, artist: 'Josi' }) : null
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler | null]> = [
      ['play', () => void audioRef.current?.play()], ['pause', () => audioRef.current?.pause()], ['previoustrack', () => moveSong(-1)], ['nexttrack', () => moveSong(1)],
      ['seekbackward', (event) => skipSeconds(-(event.seekOffset ?? 10))], ['seekforward', (event) => skipSeconds(event.seekOffset ?? 10)], ['seekto', (event) => event.seekTime !== undefined && seek(event.seekTime)],
    ]
    handlers.forEach(([action, handler]) => { try { navigator.mediaSession.setActionHandler(action, handler) } catch { /* unsupported */ } })
    return () => handlers.forEach(([action]) => { try { navigator.mediaSession.setActionHandler(action, null) } catch { /* unsupported */ } })
  }, [currentSong?.id, isPlaying, playerQueue, shuffle, repeatQueue, currentTime, duration])

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const audioFiles = Array.from(files).filter((file) => file.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(file.name))
    if (!audioFiles.length) return setMessage('Keine unterstützten Audiodateien ausgewählt.')
    try {
      const normalized = songs.map((song) => ({ ...song, isNew: false }))
      await saveSongOrder(normalized)
      const imported = await saveSongs(audioFiles)
      const measured = await Promise.all(imported.map(async (song) => {
        try { const songDuration = await decodeDuration(song); const updated = { ...song, duration: songDuration }; await saveSong(updated); return updated } catch { return song }
      }))
      setSongs([...normalized, ...measured])
      setMessage(`${measured.length} ${measured.length === 1 ? 'Song wurde' : 'Songs wurden'} importiert.`)
    } catch { setMessage('Import fehlgeschlagen. Möglicherweise ist der lokale Speicher voll.') }
    finally { if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  const markSeen = async (id?: string) => { const updated = songs.map((song) => !id || song.id === id ? { ...song, isNew: false } : song); setSongs(updated); await saveSongOrder(updated); setOverflowMenu(null) }
  const createLoopForSong = async (id: string) => {
    const song = songs.find((item) => item.id === id)
    if (!song || loopAnalyzingId) return
    setLoopAnalyzingId(id); setOverflowMenu(null)
    try { const suggestion = await suggestLoop(song); await updateSong({ ...song, loopStart: suggestion.start, loopEnd: suggestion.end, loopConfidence: suggestion.confidence, loopEnabled: false }, true) }
    catch { setMessage('Für dieses Lied konnte kein sinnvoller Loop-Vorschlag berechnet werden.') }
    finally { setLoopAnalyzingId(null) }
  }

  const createPlaylist = async (event: React.FormEvent) => {
    event.preventDefault(); const name = playlistName.trim(); if (!name) return; recordHistory()
    const playlist: Playlist = { id: crypto.randomUUID(), name, songIds: [], createdAt: Date.now(), lastUsedAt: Date.now(), sortOrder: -Date.now() }
    await savePlaylist(playlist); setPlaylists((items) => [playlist, ...items]); setPlaylistName(''); navigateTo({ view: 'library', playlistId: playlist.id, detailOpen: false })
  }
  const openPlaylist = async (id: string | null) => { if (reorderScope === 'sidebar') return; navigateTo({ view: 'library', playlistId: id, detailOpen: false }); const playlist = playlists.find((item) => item.id === id); if (playlist) await updatePlaylist({ ...playlist, lastUsedAt: Date.now() }) }
  const removeSongFromActivePlaylist = async (songId: string) => { if (!activePlaylist) return; await updatePlaylist({ ...activePlaylist, songIds: activePlaylist.songIds.filter((id) => id !== songId), lastUsedAt: Date.now() }, true) }
  const startEditingPlaylist = () => { if (!activePlaylist) return; setEditingName(activePlaylist.name); setIsEditingPlaylist(true) }
  const savePlaylistName = async (event: React.FormEvent) => { event.preventDefault(); if (!activePlaylist || !editingName.trim()) return; await updatePlaylist({ ...activePlaylist, name: editingName.trim(), lastUsedAt: Date.now() }, true); setIsEditingPlaylist(false) }
  const changePlaylistCover = async (files: FileList | null) => { if (!activePlaylist || !files?.[0] || !files[0].type.startsWith('image/')) return; await updatePlaylist({ ...activePlaylist, cover: files[0], lastUsedAt: Date.now() }, true); if (coverInputRef.current) coverInputRef.current.value = '' }
  const confirmDeletePlaylist = async () => { if (!playlistToDelete) return; recordHistory(); await deletePlaylist(playlistToDelete.id); setPlaylists((items) => items.filter((playlist) => playlist.id !== playlistToDelete.id)); if (activePlaylistId === playlistToDelete.id) navigateTo({ view: 'library', playlistId: null, detailOpen: false }); setPlaylistToDelete(null) }

  const beginReorder = (scope: Exclude<ReorderScope, null>) => { setReorderScope(scope); setMoveCandidate(null); setOverflowMenu(null); setSortMode('manual') }
  const finishReorder = () => { setReorderScope(null); setMoveCandidate(null) }
  const reorderIds = (ids: string[], sourceId: string, targetIndex: number) => { const sourceIndex = ids.indexOf(sourceId); if (sourceIndex < 0) return ids; const next = [...ids]; const [moved] = next.splice(sourceIndex, 1); next.splice(Math.max(0, Math.min(targetIndex > sourceIndex ? targetIndex - 1 : targetIndex, next.length)), 0, moved); return next }
  const confirmPendingMove = async () => {
    if (!moveCandidate || moveCandidate.targetIndex === null) return; recordHistory()
    if (moveCandidate.kind === 'playlist') {
      const ids = reorderIds(sidebarPlaylists.map((playlist) => playlist.id), moveCandidate.id, moveCandidate.targetIndex); const order = new Map(ids.map((id, index) => [id, index])); const updated = playlists.map((playlist) => ({ ...playlist, sortOrder: order.get(playlist.id) ?? playlist.sortOrder })); setPlaylists(updated); await Promise.all(updated.map(savePlaylist))
    } else if (reorderScope === 'playlist' && activePlaylist) {
      await updatePlaylist({ ...activePlaylist, songIds: reorderIds(activePlaylist.songIds, moveCandidate.id, moveCandidate.targetIndex) })
    } else {
      const ids = reorderIds(songs.map((song) => song.id), moveCandidate.id, moveCandidate.targetIndex); const byId = new Map(songs.map((song) => [song.id, song])); const updated = ids.map((id, index) => ({ ...byId.get(id)!, libraryOrder: index })); setSongs(updated); await saveSongOrder(updated)
    }
    setMoveCandidate(null)
  }
  const renderDropZone = (index: number, kind: 'song' | 'playlist') => !moveCandidate || moveCandidate.kind !== kind ? null : <button className={`drop-zone${moveCandidate.targetIndex === index ? ' selected' : ''}`} type="button" onClick={() => setMoveCandidate({ ...moveCandidate, targetIndex: index })}><span /></button>

  const membershipText = (songId: string) => { const names = playlists.filter((playlist) => playlist.songIds.includes(songId)).map((playlist) => playlist.name); return names.length ? names.join(' · ') : 'In keiner Playlist' }
  const startSelection = () => { setSelectionMode(true); setSelectedSongIds(new Set()) }
  const stopSelection = () => { setSelectionMode(false); setSelectedSongIds(new Set()); setPlaylistChooserMode(null) }
  const selectAllVisible = () => setSelectedSongIds(new Set(visibleSongs.map((song) => song.id)))
  const assignSelectedToPlaylist = async (playlist: Playlist) => { const ids = [...selectedSongIds]; if (!ids.length) return; recordHistory(); const merged = [...playlist.songIds]; ids.forEach((id) => { if (!merged.includes(id)) merged.push(id) }); await updatePlaylist({ ...playlist, songIds: merged, lastUsedAt: Date.now() }); setPlaylistChooserMode(null); stopSelection() }
  const toggleCurrentInPlaylist = async (playlist: Playlist) => { if (!currentSong) return; const contains = playlist.songIds.includes(currentSong.id); await updatePlaylist({ ...playlist, songIds: contains ? playlist.songIds.filter((id) => id !== currentSong.id) : [...playlist.songIds, currentSong.id], lastUsedAt: Date.now() }, true) }

  const toggleCurrentLoop = async () => { if (!currentSong || currentSong.loopStart === undefined || currentSong.loopEnd === undefined) return; await updateSong({ ...currentSong, loopEnabled: !currentSong.loopEnabled }, true) }
  const removeCurrentLoop = async () => { if (!currentSong) return; await updateSong({ ...currentSong, loopStart: undefined, loopEnd: undefined, loopConfidence: undefined, loopEnabled: false }, true) }

  const songEditMode = reorderScope === (activePlaylist ? 'playlist' : 'library') && view === 'library'
  const title = view === 'history' ? 'Verlauf' : view === 'loops' ? 'Loops' : activePlaylist?.name ?? 'Bibliothek'
  const sortLabels: Record<SortMode, string> = { manual: 'Manuell', azStart: 'A–Z Anfang', azEnd: 'A–Z Ende', plays: 'Anzahl des Hörens', duration: 'Dauer', chronology: 'Chronik' }

  return <div className="app-shell">
    <header className="site-header">
      <div className="history-controls" aria-label="Navigation und Verlauf">
        <button type="button" onClick={navigateBack} disabled={navigationIndex === 0}>‹</button><button type="button" onClick={navigateForward} disabled={navigationIndex >= navigation.length - 1}>›</button><button type="button" onClick={() => void undo()} disabled={!undoStack.length || Boolean(moveCandidate)}>↶</button><button type="button" onClick={() => void redo()} disabled={!redoStack.length || Boolean(moveCandidate)}>↷</button>
        {moveCandidate && <><button className="confirm-move" type="button" onClick={() => void confirmPendingMove()} disabled={moveCandidate.targetIndex === null}>✓</button><button className="cancel-move" type="button" onClick={() => setMoveCandidate(null)}>×</button></>}
      </div>
      <button className="import-button" type="button" onClick={() => fileInputRef.current?.click()}>+ Musik importieren</button><input ref={fileInputRef} className="file-input" type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac" multiple onChange={(event) => void importFiles(event.target.files)} />
    </header>

    {view !== 'playlistOverview' && <main className="music-layout"><aside className="sidebar">
      <button className={`nav-item${view === 'library' && !activePlaylistId ? ' active' : ''}`} type="button" onClick={() => navigateTo({ view: 'library', playlistId: null, detailOpen: false })}><span>Bibliothek</span><strong>{songs.length}</strong></button>
      <button className={`nav-item history-nav${view === 'history' ? ' active' : ''}`} type="button" onClick={() => navigateTo({ view: 'history', playlistId: null, detailOpen: false })}><span>Verlauf</span><strong>{songs.filter((song) => song.isNew).length}</strong></button>
      <button className={`nav-item history-nav${view === 'loops' ? ' active' : ''}`} type="button" onClick={() => navigateTo({ view: 'loops', playlistId: null, detailOpen: false })}><span>Loops</span><strong>{songs.filter((song) => song.loopStart !== undefined && song.loopEnd !== undefined).length}</strong></button>
      <div className="sidebar-heading"><span className="heading-label">Playlists</span><button className="overflow-button small-overflow" type="button" onClick={() => setOverflowMenu({ kind: 'playlists' })}>•••</button>{reorderScope === 'sidebar' && <button className="finish-inline" type="button" onClick={finishReorder}>Fertig</button>}</div>
      <div className="playlist-nav">{renderDropZone(0, 'playlist')}{sidebarPlaylists.map((playlist, index) => <div className="playlist-nav-row" key={playlist.id}>{reorderScope === 'sidebar' && <button className="move-selector" type="button" onClick={() => setMoveCandidate({ kind: 'playlist', id: playlist.id, targetIndex: null })}>↕</button>}<button className={`nav-item${activePlaylistId === playlist.id && view === 'library' ? ' active' : ''}`} type="button" onClick={() => void openPlaylist(playlist.id)} disabled={reorderScope === 'sidebar'}><span className="playlist-nav-name">{coverUrls[playlist.id] ? <img src={coverUrls[playlist.id]} alt="" /> : <span className="playlist-mini-cover">♫</span>}<span>{playlist.name}</span></span><strong>{playlist.songIds.length}</strong></button><button className="overflow-button row-overflow" type="button" onClick={() => setOverflowMenu({ kind: 'playlist', id: playlist.id })}>•••</button>{renderDropZone(index + 1, 'playlist')}</div>)}</div>
      <form className="new-playlist" onSubmit={createPlaylist}><input value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} placeholder="Neue Playlist" /><button type="submit" disabled={!playlistName.trim()}>+</button></form>
    </aside>

    <section className="library-panel"><div className={`library-heading${activePlaylist ? ' playlist-heading' : ''}`}>
      {activePlaylist && view === 'library' && <button className="playlist-cover" type="button" onClick={() => coverInputRef.current?.click()}>{coverUrls[activePlaylist.id] ? <img src={coverUrls[activePlaylist.id]} alt="" /> : <span>+ Bild</span>}</button>}
      <div className="library-title"><p className="eyebrow">{view === 'history' ? 'IMPORTIERT' : view === 'loops' ? 'GESPEICHERTE LOOPS' : activePlaylist ? 'PLAYLIST' : 'DEINE MUSIK'}</p>{activePlaylist && view === 'library' && isEditingPlaylist ? <form className="rename-playlist" onSubmit={savePlaylistName}><input value={editingName} onChange={(event) => setEditingName(event.target.value)} autoFocus /><button type="submit">Speichern</button><button type="button" onClick={() => setIsEditingPlaylist(false)}>Abbrechen</button></form> : <h1>{title}</h1>}<p>{visibleSongs.length} {visibleSongs.length === 1 ? 'Lied' : 'Lieder'}</p></div>
      <div className="playlist-actions">{!selectionMode && <button type="button" onClick={startSelection}>Auswählen</button>}{selectionMode && <><button type="button" onClick={selectAllVisible}>Alle</button><button type="button" onClick={stopSelection}>Abbrechen</button></>}{activePlaylist && view === 'library' && !selectionMode && <><button type="button" onClick={startEditingPlaylist}>Name ändern</button><button type="button" onClick={() => coverInputRef.current?.click()}>Bild ändern</button><button type="button" onClick={() => reorderScope === 'playlist' ? finishReorder() : beginReorder('playlist')}>{reorderScope === 'playlist' ? 'Fertig' : 'Reihenfolge ändern'}</button><button className="danger-button" type="button" onClick={() => setPlaylistToDelete(activePlaylist)}>Playlist löschen</button><input ref={coverInputRef} className="file-input" type="file" accept="image/*" onChange={(event) => void changePlaylistCover(event.target.files)} /></>}{!activePlaylist && view === 'library' && !selectionMode && <button type="button" onClick={() => reorderScope === 'library' ? finishReorder() : beginReorder('library')}>{reorderScope === 'library' ? 'Fertig' : 'Reihenfolge ändern'}</button>}</div>
    </div>

    <div className="sort-bar"><span>Sortierung</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>{(Object.keys(sortLabels) as SortMode[]).map((mode) => <option key={mode} value={mode}>{sortLabels[mode]}</option>)}</select><button type="button" className="sort-direction" disabled={sortMode === 'manual'} onClick={() => setSortDirection((value) => value === 'down' ? 'up' : 'down')} title={sortMode === 'manual' ? 'Manuelle Reihenfolge wird nicht umgekehrt' : 'Sortierreihenfolge umkehren'}>{sortMode === 'manual' ? '—' : sortDirection === 'down' ? '↓' : '↑'}</button></div>
    {message && <div className="message">{message}</div>}{selectionMode && <div className="selection-hint">{selectedSongIds.size} ausgewählt. Die Zuordnung erfolgt unten rechts über „Alle Playlists“.</div>}
    {visibleSongs.length ? <div className="song-list">{renderDropZone(0, 'song')}{visibleSongs.map((song, index) => <div key={song.id} className={`song-row${song.isNew ? ' new-import' : ''}${selectedSongIds.has(song.id) ? ' selected-song' : ''}`}>{songEditMode && <button className="move-selector" type="button" onClick={() => setMoveCandidate({ kind: 'song', id: song.id, targetIndex: null })}>↕</button>}{selectionMode && <button className="selection-check" type="button" onClick={() => toggleSelected(song.id)}>{selectedSongIds.has(song.id) ? '✓' : ''}</button>}<button className="song-main" type="button" onClick={() => playSong(song.id)} disabled={songEditMode}><span className="song-number">{song.id === currentSongId && isPlaying ? '▶' : index + 1}</span><span className="song-copy"><strong>{song.name}</strong><small>{view === 'history' ? formatDate(song.addedAt) : membershipText(song.id)}</small></span><span className="song-meta"><small>{formatTime(song.duration)}</small>{song.loopStart !== undefined && song.loopEnd !== undefined && <span className="loop-badge">↻</span>}</span></button><button className="overflow-button song-overflow" type="button" onClick={() => setOverflowMenu({ kind: 'song', id: song.id })}>•••</button>{activePlaylist && view === 'library' && !selectionMode && !songEditMode && <button className="remove-song" type="button" onClick={() => void removeSongFromActivePlaylist(song.id)}>Entfernen</button>}{renderDropZone(index + 1, 'song')}</div>)}</div> : <div className="empty-state"><div className="empty-icon">♫</div><h2>{view === 'loops' ? 'Noch keine Loops gespeichert.' : 'Noch keine Musik hier.'}</h2></div>}
    </section></main>}

    {view === 'playlistOverview' && <section className="playlist-overview"><div className="playlist-overview-heading"><p className="eyebrow">DEINE MUSIK</p><h1>Playlists</h1><p>{playlists.length} Playlists</p></div><div className="playlist-grid">{sidebarPlaylists.map((playlist) => <div className="playlist-card-wrap" key={playlist.id}><button className="playlist-card" type="button" onClick={() => void openPlaylist(playlist.id)}><span className="playlist-card-cover">{coverUrls[playlist.id] ? <img src={coverUrls[playlist.id]} alt="" /> : '♫'}</span><strong>{playlist.name}</strong><small>{playlist.songIds.length} {playlist.songIds.length === 1 ? 'Lied' : 'Lieder'}</small></button><button className="overflow-button card-overflow" type="button" onClick={() => setOverflowMenu({ kind: 'playlist', id: playlist.id })}>•••</button></div>)}</div></section>}

    <section className={`player${currentSong ? ' visible' : ''}`}><audio ref={audioRef} src={currentUrl ?? undefined} playsInline onTimeUpdate={(event) => { const audio = event.currentTarget; const song = currentSong; if (song?.loopEnabled && song.loopStart !== undefined && song.loopEnd !== undefined && audio.currentTime >= song.loopEnd) audio.currentTime = song.loopStart; setCurrentTime(audio.currentTime) }} onLoadedMetadata={(event) => { const value = event.currentTarget.duration; setDuration(value); if (currentSong && (!currentSong.duration || Math.abs(currentSong.duration - value) > 0.5)) void updateSong({ ...currentSong, duration: value }) }} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => { if (currentSong) void updateSong({ ...currentSong, completedPlays: (currentSong.completedPlays ?? 0) + 1 }); moveSong(1) }} />
      <button className="now-playing" type="button" onClick={() => currentSong && navigateTo({ view, playlistId: activePlaylistId, detailOpen: true })} disabled={!currentSong}><span className="cover-placeholder">♫</span><span className="now-playing-copy"><small>JETZT</small><span className="marquee"><strong>{currentSong?.name ?? 'Kein Song ausgewählt'}</strong></span></span></button>
      <div className="transport"><div className="transport-buttons"><button className={shuffle ? 'active-control' : ''} onClick={() => setShuffle((value) => !value)}>⇄</button><button onClick={() => moveSong(-1)}>⏮</button><button className="play-button" onClick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button><button onClick={() => moveSong(1)}>⏭</button><button className={repeatQueue ? 'active-control' : ''} onClick={() => setRepeatQueue((value) => !value)}>↻</button></div><div className="progress-row"><span>{formatTime(currentTime)}</span><input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(Number(event.target.value))} /><span>{formatTime(duration)}</span></div></div>
      <div className="quick-playlists"><button className="all-playlists-button" type="button" onClick={() => setPlaylistChooserMode(selectionMode ? 'bulk' : 'current')} disabled={selectionMode ? !selectedSongIds.size : !currentSong}><span>Alle Playlists</span><strong>›</strong></button></div>
    </section>

    {detailOpen && currentSong && <section className="song-detail"><div className="detail-topbar"><button type="button" onClick={navigateBack}>‹ Zurück</button></div><div className="detail-content"><p className="detail-label">JETZT</p><h2>{currentSong.name}</h2><div className="playlist-membership"><span>IN PLAYLISTS</span><strong>{currentSongPlaylists.length ? currentSongPlaylists.map((playlist) => playlist.name).join(' · ') : 'In keiner Playlist'}</strong></div><div className="detail-progress"><input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(Number(event.target.value))} /><div><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div></div><div className="detail-controls"><button onClick={playPreviousFromHistory} disabled={!playHistory.length}>⏮</button><button onClick={() => skipSeconds(-10)}>↶<small>10</small></button><button className="detail-play" onClick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button><button onClick={() => skipSeconds(10)}>↷<small>10</small></button><button onClick={() => moveSong(1)}>⏭</button></div><div className="loop-panel"><div><span className="loop-panel-label">LOOP</span><h3>{currentSong.loopStart !== undefined && currentSong.loopEnd !== undefined ? `${formatTime(currentSong.loopStart)} – ${formatTime(currentSong.loopEnd)}` : 'Noch kein Vorschlag'}</h3>{currentSong.loopConfidence !== undefined && <p>{currentSong.loopConfidence}% Übereinstimmung – experimenteller Vorschlag</p>}</div><div className="loop-actions">{currentSong.loopStart === undefined || currentSong.loopEnd === undefined ? <button type="button" onClick={() => void createLoopForSong(currentSong.id)} disabled={loopAnalyzingId === currentSong.id}>{loopAnalyzingId === currentSong.id ? 'Analysiere…' : 'Loop erstellen'}</button> : <><button className={currentSong.loopEnabled ? 'loop-active' : ''} type="button" onClick={() => void toggleCurrentLoop()}>{currentSong.loopEnabled ? 'Loop aktiv' : 'Loop aktivieren'}</button><button type="button" onClick={() => void createLoopForSong(currentSong.id)} disabled={loopAnalyzingId === currentSong.id}>Neu analysieren</button><button className="danger-button" type="button" onClick={() => void removeCurrentLoop()}>Loop entfernen</button></>}</div></div></div></section>}

    {playlistChooserMode && <div className="playlist-chooser-backdrop" onMouseDown={() => setPlaylistChooserMode(null)}><section className="playlist-chooser" onMouseDown={(event) => event.stopPropagation()}><div className="playlist-chooser-heading"><div><p className="eyebrow">PLAYLISTS</p><h2>{playlistChooserMode === 'bulk' ? `${selectedSongIds.size} Lieder zuordnen` : 'Alle Playlists'}</h2></div><button type="button" onClick={() => setPlaylistChooserMode(null)}>×</button></div><div className="playlist-groups">{groupedPlaylists.map(([group, items]) => <div className="playlist-group" key={group}><strong>{group}</strong><div>{items.map((playlist) => { const contains = currentSong ? playlist.songIds.includes(currentSong.id) : false; return <button key={playlist.id} type="button" onClick={() => playlistChooserMode === 'bulk' ? void assignSelectedToPlaylist(playlist) : void toggleCurrentInPlaylist(playlist)}><span>{playlist.name}</span>{playlistChooserMode === 'current' && <b>{contains ? '−' : '+'}</b>}</button> })}</div></div>)}</div></section></div>}

    {overflowMenu && <><button className="menu-shield" type="button" onClick={() => setOverflowMenu(null)} /><div className="overflow-menu">{overflowMenu.kind === 'playlists' && <><button type="button" onClick={() => beginReorder('sidebar')}>Bearbeiten</button><button type="button" onClick={() => { setOverflowMenu(null); navigateTo({ view: 'playlistOverview', playlistId: activePlaylistId, detailOpen: false }) }}>Übersicht</button></>}{overflowMenu.kind === 'song' && overflowMenu.id && <>{songs.find((song) => song.id === overflowMenu.id)?.isNew && <button type="button" onClick={() => void markSeen(overflowMenu.id)}>Als gesehen markieren</button>}<button type="button" onClick={() => void markSeen()}>Alle als gesehen markieren</button><button type="button" onClick={() => void createLoopForSong(overflowMenu.id!)}>{songs.find((song) => song.id === overflowMenu.id)?.loopStart !== undefined ? 'Loop neu erstellen' : 'Loop erstellen'}</button>{songs.find((song) => song.id === overflowMenu.id)?.loopStart !== undefined && <button type="button" onClick={() => { setCurrentSongId(overflowMenu.id!); setOverflowMenu(null); navigateTo({ view, playlistId: activePlaylistId, detailOpen: true }) }}>Loop ansehen</button>}{activePlaylist && view === 'library' && <button type="button" onClick={() => { const id = overflowMenu.id!; setOverflowMenu(null); void removeSongFromActivePlaylist(id) }}>Aus Playlist entfernen</button>}</>}{overflowMenu.kind === 'playlist' && overflowMenu.id && <><button type="button" onClick={() => { const id = overflowMenu.id!; setOverflowMenu(null); void openPlaylist(id) }}>Playlist öffnen</button><button type="button" onClick={() => { const playlist = playlists.find((item) => item.id === overflowMenu.id); if (playlist) setPlaylistToDelete(playlist); setOverflowMenu(null) }}>Playlist löschen</button></>}</div></>}

    {playlistToDelete && <div className="modal-backdrop" onMouseDown={() => setPlaylistToDelete(null)}><div className="confirm-dialog" onMouseDown={(event) => event.stopPropagation()}><h2>Playlist löschen?</h2><p>„{playlistToDelete.name}“ wird gelöscht. Die Musikdateien bleiben erhalten.</p><div className="dialog-actions"><button type="button" onClick={() => setPlaylistToDelete(null)}>Abbrechen</button><button className="danger-button" type="button" onClick={() => void confirmDeletePlaylist()}>Playlist löschen</button></div></div></div>}
  </div>
}

export default App
