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

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
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

type LoopSuggestion = { start: number; end: number; confidence: number }

async function suggestLoop(song: Song): Promise<LoopSuggestion> {
  const buffer = await song.file.arrayBuffer()
  const audioContext = new AudioContext()
  try {
    const decoded = await audioContext.decodeAudioData(buffer.slice(0))
    const duration = decoded.duration
    if (duration < 8) throw new Error('too-short')

    const channel = decoded.getChannelData(0)
    const sampleRate = decoded.sampleRate
    const featureCount = 140
    const windowSeconds = Math.min(0.65, duration / 18)
    const windowSamples = Math.max(128, Math.floor(windowSeconds * sampleRate))

    const signature = (time: number) => {
      const start = Math.max(0, Math.min(channel.length - windowSamples - 1, Math.floor(time * sampleRate)))
      const stride = Math.max(1, Math.floor(windowSamples / 64))
      const values: number[] = []
      for (let i = 0; i < windowSamples; i += stride) values.push(channel[start + i])
      const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)
      const centered = values.map((value) => value - mean)
      const energy = Math.sqrt(centered.reduce((sum, value) => sum + value * value, 0) / Math.max(centered.length, 1)) || 1
      return centered.map((value) => value / energy)
    }

    const starts = Array.from({ length: featureCount }, (_, index) => duration * (0.06 + (0.46 * index) / (featureCount - 1)))
    const ends = Array.from({ length: featureCount }, (_, index) => duration * (0.55 + (0.40 * index) / (featureCount - 1)))
    const startSignatures = starts.map(signature)
    const endSignatures = ends.map(signature)

    let best = { score: Number.POSITIVE_INFINITY, start: starts[0], end: ends[0] }
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
        const lengthPenalty = Math.abs(gap - duration * 0.55) / duration * 0.08
        const score = error + lengthPenalty
        if (score < best.score) best = { score, start: starts[i], end: ends[j] }
      }
    }

    const confidence = Math.round(Math.max(15, Math.min(92, 92 - best.score * 16)))
    return { start: best.start, end: best.end, confidence }
  } finally {
    void audioContext.close()
  }
}

function groupPlaylists(playlists: Playlist[]) {
  const sorted = [...playlists].sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' }))
  const groups = new Map<string, Playlist[]>()
  sorted.forEach((playlist) => {
    const first = playlist.name.trim().charAt(0).toUpperCase()
    const group = /[A-ZÄÖÜ]/.test(first) ? first : /[0-9]/.test(first) ? '0–9' : '#'
    groups.set(group, [...(groups.get(group) ?? []), playlist])
  })
  return [...groups.entries()]
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
  const [playlistMenuOpen, setPlaylistMenuOpen] = useState(false)
  const [songMenuId, setSongMenuId] = useState<string | null>(null)
  const [songMenuPosition, setSongMenuPosition] = useState({ x: 20, y: 100 })
  const [reorderScope, setReorderScope] = useState<ReorderScope>(null)
  const [moveCandidate, setMoveCandidate] = useState<MoveCandidate>(null)
  const [undoStack, setUndoStack] = useState<Snapshot[]>([])
  const [redoStack, setRedoStack] = useState<Snapshot[]>([])
  const [navigation, setNavigation] = useState<NavigationEntry[]>([{ view: 'library', playlistId: null, detailOpen: false }])
  const [navigationIndex, setNavigationIndex] = useState(0)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set())
  const [playlistChooserMode, setPlaylistChooserMode] = useState<PlaylistChooserMode>(null)
  const [loopAnalyzing, setLoopAnalyzing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const shouldAutoPlayRef = useRef(false)
  const playlistLongPressRef = useRef<number | null>(null)
  const songLongPressRef = useRef<number | null>(null)

  useEffect(() => {
    Promise.all([getSongs(), getPlaylists()])
      .then(([storedSongs, storedPlaylists]) => {
        setSongs(storedSongs)
        setPlaylists(storedPlaylists)
      })
      .catch(() => setMessage('Lokale Musikdaten konnten nicht geladen werden.'))
  }, [])

  const currentSong = songs.find((song) => song.id === currentSongId) ?? null
  const activePlaylist = playlists.find((playlist) => playlist.id === activePlaylistId) ?? null
  const sidebarPlaylists = useMemo(() => [...playlists].sort((a, b) => {
    if (a.sortOrder !== undefined || b.sortOrder !== undefined) {
      return (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) || b.lastUsedAt - a.lastUsedAt
    }
    return b.lastUsedAt - a.lastUsedAt
  }), [playlists])

  const playlistQueue = useMemo(() => {
    if (!activePlaylist) return songs
    const byId = new Map(songs.map((song) => [song.id, song]))
    return activePlaylist.songIds.map((id) => byId.get(id)).filter((song): song is Song => Boolean(song))
  }, [activePlaylist, songs])

  const visibleSongs = useMemo(() => {
    if (view === 'history') return [...songs].sort((a, b) => b.addedAt - a.addedAt)
    if (view === 'loops') return songs.filter((song) => song.loopStart !== undefined && song.loopEnd !== undefined)
    return playlistQueue
  }, [view, songs, playlistQueue])

  const playerQueue = activePlaylist ? playlistQueue : songs
  const currentSongPlaylists = useMemo(() => currentSong ? playlists.filter((playlist) => playlist.songIds.includes(currentSong.id)) : [], [currentSong, playlists])
  const groupedPlaylists = useMemo(() => groupPlaylists(playlists), [playlists])

  useEffect(() => {
    const urls: Record<string, string> = {}
    playlists.forEach((playlist) => {
      if (playlist.cover) urls[playlist.id] = URL.createObjectURL(playlist.cover)
    })
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
    if (shouldAutoPlayRef.current) audio.play().catch(() => setIsPlaying(false))
  }, [currentUrl])

  const snapshot = (): Snapshot => ({ songs: songs.map((song) => ({ ...song })), playlists: playlists.map((playlist) => ({ ...playlist, songIds: [...playlist.songIds] })) })
  const recordHistory = () => {
    setUndoStack((items) => [...items, snapshot()].slice(-50))
    setRedoStack([])
  }
  const persistSnapshot = async (target: Snapshot, previous: Playlist[]) => {
    await saveSongOrder(target.songs)
    const ids = new Set(target.playlists.map((playlist) => playlist.id))
    await Promise.all(previous.filter((playlist) => !ids.has(playlist.id)).map((playlist) => deletePlaylist(playlist.id)))
    await Promise.all(target.playlists.map((playlist) => savePlaylist(playlist)))
  }
  const restoreSnapshot = async (target: Snapshot) => {
    const previous = playlists
    setSongs(target.songs)
    setPlaylists(target.playlists)
    await persistSnapshot(target, previous)
  }
  const undo = async () => {
    const target = undoStack.at(-1)
    if (!target || moveCandidate) return
    setUndoStack((items) => items.slice(0, -1))
    setRedoStack((items) => [...items, snapshot()].slice(-50))
    await restoreSnapshot(target)
  }
  const redo = async () => {
    const target = redoStack.at(-1)
    if (!target || moveCandidate) return
    setRedoStack((items) => items.slice(0, -1))
    setUndoStack((items) => [...items, snapshot()].slice(-50))
    await restoreSnapshot(target)
  }

  const applyNavigation = (entry: NavigationEntry) => {
    setView(entry.view)
    setActivePlaylistId(entry.playlistId)
    setDetailOpen(entry.detailOpen)
    setSelectionMode(false)
    setSelectedSongIds(new Set())
    setPlaylistMenuOpen(false)
  }
  const navigateTo = (entry: NavigationEntry) => {
    const current = navigation[navigationIndex]
    if (current && current.view === entry.view && current.playlistId === entry.playlistId && current.detailOpen === entry.detailOpen) return
    const next = [...navigation.slice(0, navigationIndex + 1), entry].slice(-60)
    setNavigation(next)
    setNavigationIndex(next.length - 1)
    applyNavigation(entry)
  }
  const navigateBack = () => {
    if (navigationIndex <= 0) return
    const next = navigationIndex - 1
    setNavigationIndex(next)
    applyNavigation(navigation[next])
  }
  const navigateForward = () => {
    if (navigationIndex >= navigation.length - 1) return
    const next = navigationIndex + 1
    setNavigationIndex(next)
    applyNavigation(navigation[next])
  }

  const updateSong = async (updated: Song, addHistory = false) => {
    if (addHistory) recordHistory()
    setSongs((items) => items.map((song) => song.id === updated.id ? updated : song))
    await saveSong(updated)
  }
  const updatePlaylist = async (updated: Playlist, addHistory = false) => {
    if (addHistory) recordHistory()
    setPlaylists((items) => items.map((playlist) => playlist.id === updated.id ? updated : playlist))
    await savePlaylist(updated)
  }

  const playSong = (id: string, remember = true) => {
    if (selectionMode) return toggleSelected(id)
    if (id === currentSongId && audioRef.current) return void audioRef.current.play()
    if (remember && currentSongId) setPlayHistory((items) => [...items, currentSongId].slice(-50))
    shouldAutoPlayRef.current = true
    setCurrentSongId(id)
    setCurrentTime(0)
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
    shouldAutoPlayRef.current = false
    setIsPlaying(false)
  }
  const togglePlayback = () => {
    const audio = audioRef.current
    if (!currentSong) return playerQueue[0] && playSong(playerQueue[0].id)
    if (!audio) return
    if (audio.paused) void audio.play()
    else audio.pause()
  }
  const seek = (value: number) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = value
    setCurrentTime(value)
  }
  const skipSeconds = (seconds: number) => seek(Math.max(0, Math.min(duration || 0, currentTime + seconds)))
  const playPreviousFromHistory = () => {
    const previous = playHistory.at(-1)
    if (!previous) return
    setPlayHistory((items) => items.slice(0, -1))
    playSong(previous, false)
  }

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = currentSong ? new MediaMetadata({ title: currentSong.name, artist: 'Josi' }) : null
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler | null]> = [
      ['play', () => void audioRef.current?.play()],
      ['pause', () => audioRef.current?.pause()],
      ['previoustrack', () => moveSong(-1)],
      ['nexttrack', () => moveSong(1)],
      ['seekbackward', (event) => skipSeconds(-(event.seekOffset ?? 10))],
      ['seekforward', (event) => skipSeconds(event.seekOffset ?? 10)],
      ['seekto', (event) => event.seekTime !== undefined && seek(event.seekTime)],
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
      if (normalized.some((song, index) => song.isNew !== songs[index]?.isNew)) await saveSongOrder(normalized)
      const imported = await saveSongs(audioFiles)
      setSongs([...normalized, ...imported])
      setMessage(`${imported.length} ${imported.length === 1 ? 'Song wurde' : 'Songs wurden'} importiert.`)
    } catch {
      setMessage('Import fehlgeschlagen. Möglicherweise ist der lokale Speicher voll.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const markSeen = async (id?: string) => {
    const updated = songs.map((song) => !id || song.id === id ? { ...song, isNew: false } : song)
    setSongs(updated)
    await saveSongOrder(updated)
    setSongMenuId(null)
  }

  const openSongMenu = (songId: string, x: number, y: number) => {
    if (selectionMode) return
    if (songLongPressRef.current !== null) window.clearTimeout(songLongPressRef.current)
    songLongPressRef.current = window.setTimeout(() => {
      setSongMenuId(songId)
      setSongMenuPosition({ x: Math.min(x, window.innerWidth - 250), y: Math.min(y, window.innerHeight - 150) })
      songLongPressRef.current = null
    }, 1000)
  }
  const cancelSongLongPress = () => {
    if (songLongPressRef.current !== null) window.clearTimeout(songLongPressRef.current)
    songLongPressRef.current = null
  }

  const startPlaylistLongPress = () => {
    if (playlistLongPressRef.current !== null) window.clearTimeout(playlistLongPressRef.current)
    playlistLongPressRef.current = window.setTimeout(() => { setPlaylistMenuOpen(true); playlistLongPressRef.current = null }, 1000)
  }
  const cancelPlaylistLongPress = () => {
    if (playlistLongPressRef.current !== null) window.clearTimeout(playlistLongPressRef.current)
    playlistLongPressRef.current = null
  }

  const createPlaylist = async (event: React.FormEvent) => {
    event.preventDefault()
    const name = playlistName.trim()
    if (!name) return
    recordHistory()
    const playlist: Playlist = { id: crypto.randomUUID(), name, songIds: [], createdAt: Date.now(), lastUsedAt: Date.now(), sortOrder: -Date.now() }
    await savePlaylist(playlist)
    setPlaylists((items) => [playlist, ...items])
    setPlaylistName('')
    navigateTo({ view: 'library', playlistId: playlist.id, detailOpen: false })
  }
  const openPlaylist = async (id: string | null) => {
    if (reorderScope === 'sidebar') return
    navigateTo({ view: 'library', playlistId: id, detailOpen: false })
    const playlist = playlists.find((item) => item.id === id)
    if (playlist) await updatePlaylist({ ...playlist, lastUsedAt: Date.now() })
  }
  const removeSongFromActivePlaylist = async (songId: string) => {
    if (!activePlaylist) return
    await updatePlaylist({ ...activePlaylist, songIds: activePlaylist.songIds.filter((id) => id !== songId), lastUsedAt: Date.now() }, true)
  }

  const startEditingPlaylist = () => {
    if (!activePlaylist) return
    setEditingName(activePlaylist.name)
    setIsEditingPlaylist(true)
  }
  const savePlaylistName = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!activePlaylist || !editingName.trim()) return
    await updatePlaylist({ ...activePlaylist, name: editingName.trim(), lastUsedAt: Date.now() }, true)
    setIsEditingPlaylist(false)
  }
  const changePlaylistCover = async (files: FileList | null) => {
    if (!activePlaylist || !files?.[0] || !files[0].type.startsWith('image/')) return
    await updatePlaylist({ ...activePlaylist, cover: files[0], lastUsedAt: Date.now() }, true)
    if (coverInputRef.current) coverInputRef.current.value = ''
  }
  const confirmDeletePlaylist = async () => {
    if (!playlistToDelete) return
    recordHistory()
    await deletePlaylist(playlistToDelete.id)
    setPlaylists((items) => items.filter((playlist) => playlist.id !== playlistToDelete.id))
    if (activePlaylistId === playlistToDelete.id) navigateTo({ view: 'library', playlistId: null, detailOpen: false })
    setPlaylistToDelete(null)
  }

  const beginReorder = (scope: Exclude<ReorderScope, null>) => { setReorderScope(scope); setMoveCandidate(null); setPlaylistMenuOpen(false) }
  const finishReorder = () => { setReorderScope(null); setMoveCandidate(null) }
  const reorderIds = (ids: string[], sourceId: string, targetIndex: number) => {
    const sourceIndex = ids.indexOf(sourceId)
    if (sourceIndex < 0) return ids
    const next = [...ids]
    const [moved] = next.splice(sourceIndex, 1)
    next.splice(Math.max(0, Math.min(targetIndex > sourceIndex ? targetIndex - 1 : targetIndex, next.length)), 0, moved)
    return next
  }
  const confirmPendingMove = async () => {
    if (!moveCandidate || moveCandidate.targetIndex === null) return
    recordHistory()
    if (moveCandidate.kind === 'playlist') {
      const ids = reorderIds(sidebarPlaylists.map((playlist) => playlist.id), moveCandidate.id, moveCandidate.targetIndex)
      const order = new Map(ids.map((id, index) => [id, index]))
      const updated = playlists.map((playlist) => ({ ...playlist, sortOrder: order.get(playlist.id) ?? playlist.sortOrder }))
      setPlaylists(updated)
      await Promise.all(updated.map(savePlaylist))
    } else if (reorderScope === 'playlist' && activePlaylist) {
      const updated = { ...activePlaylist, songIds: reorderIds(activePlaylist.songIds, moveCandidate.id, moveCandidate.targetIndex) }
      await updatePlaylist(updated)
    } else {
      const ids = reorderIds(songs.map((song) => song.id), moveCandidate.id, moveCandidate.targetIndex)
      const byId = new Map(songs.map((song) => [song.id, song]))
      const updated = ids.map((id, index) => ({ ...byId.get(id)!, libraryOrder: index }))
      setSongs(updated)
      await saveSongOrder(updated)
    }
    setMoveCandidate(null)
  }
  const renderDropZone = (index: number, kind: 'song' | 'playlist') => !moveCandidate || moveCandidate.kind !== kind ? null : (
    <button className={`drop-zone${moveCandidate.targetIndex === index ? ' selected' : ''}`} type="button" onClick={() => setMoveCandidate({ ...moveCandidate, targetIndex: index })}><span /></button>
  )

  const membershipText = (songId: string) => {
    const names = playlists.filter((playlist) => playlist.songIds.includes(songId)).map((playlist) => playlist.name)
    return names.length ? names.join(' · ') : 'In keiner Playlist'
  }

  const toggleSelected = (id: string) => setSelectedSongIds((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const startSelection = () => { setSelectionMode(true); setSelectedSongIds(new Set()) }
  const stopSelection = () => { setSelectionMode(false); setSelectedSongIds(new Set()) }
  const selectAllVisible = () => setSelectedSongIds(new Set(visibleSongs.map((song) => song.id)))
  const assignSelectedToPlaylist = async (playlist: Playlist) => {
    const ids = [...selectedSongIds]
    if (!ids.length) return
    recordHistory()
    const merged = [...playlist.songIds]
    ids.forEach((id) => { if (!merged.includes(id)) merged.push(id) })
    await updatePlaylist({ ...playlist, songIds: merged, lastUsedAt: Date.now() })
    setPlaylistChooserMode(null)
    stopSelection()
  }
  const toggleCurrentInPlaylist = async (playlist: Playlist) => {
    if (!currentSong) return
    const contains = playlist.songIds.includes(currentSong.id)
    await updatePlaylist({ ...playlist, songIds: contains ? playlist.songIds.filter((id) => id !== currentSong.id) : [...playlist.songIds, currentSong.id], lastUsedAt: Date.now() }, true)
  }

  const analyzeCurrentLoop = async () => {
    if (!currentSong || loopAnalyzing) return
    setLoopAnalyzing(true)
    try {
      const suggestion = await suggestLoop(currentSong)
      await updateSong({ ...currentSong, loopStart: suggestion.start, loopEnd: suggestion.end, loopConfidence: suggestion.confidence, loopEnabled: false }, true)
    } catch {
      setMessage('Für dieses Lied konnte kein sinnvoller Loop-Vorschlag berechnet werden.')
    } finally {
      setLoopAnalyzing(false)
    }
  }
  const toggleCurrentLoop = async () => {
    if (!currentSong || currentSong.loopStart === undefined || currentSong.loopEnd === undefined) return
    await updateSong({ ...currentSong, loopEnabled: !currentSong.loopEnabled }, true)
  }
  const removeCurrentLoop = async () => {
    if (!currentSong) return
    const updated = { ...currentSong, loopStart: undefined, loopEnd: undefined, loopConfidence: undefined, loopEnabled: false }
    await updateSong(updated, true)
  }

  const songEditMode = reorderScope === (activePlaylist ? 'playlist' : 'library') && view === 'library'
  const title = view === 'history' ? 'Verlauf' : view === 'loops' ? 'Loops' : activePlaylist?.name ?? 'Bibliothek'

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="history-controls" aria-label="Navigation und Verlauf">
          <button type="button" onClick={navigateBack} disabled={navigationIndex === 0} aria-label="Zurück">‹</button>
          <button type="button" onClick={navigateForward} disabled={navigationIndex >= navigation.length - 1} aria-label="Vor">›</button>
          <button type="button" onClick={() => void undo()} disabled={!undoStack.length || Boolean(moveCandidate)} aria-label="Rückgängig">↶</button>
          <button type="button" onClick={() => void redo()} disabled={!redoStack.length || Boolean(moveCandidate)} aria-label="Wiederholen">↷</button>
          {moveCandidate && <>
            <button className="confirm-move" type="button" onClick={() => void confirmPendingMove()} disabled={moveCandidate.targetIndex === null}>✓</button>
            <button className="cancel-move" type="button" onClick={() => setMoveCandidate(null)}>×</button>
          </>}
        </div>
        <button className="import-button" type="button" onClick={() => fileInputRef.current?.click()}>+ Musik importieren</button>
        <input ref={fileInputRef} className="file-input" type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac" multiple onChange={(event) => void importFiles(event.target.files)} />
      </header>

      {view !== 'playlistOverview' && <main className="music-layout">
        <aside className="sidebar">
          <button className={`nav-item${view === 'library' && !activePlaylistId ? ' active' : ''}`} type="button" onClick={() => navigateTo({ view: 'library', playlistId: null, detailOpen: false })}><span>Bibliothek</span><strong>{songs.length}</strong></button>
          <button className={`nav-item history-nav${view === 'history' ? ' active' : ''}`} type="button" onClick={() => navigateTo({ view: 'history', playlistId: null, detailOpen: false })}><span>Verlauf</span><strong>{songs.filter((song) => song.isNew).length}</strong></button>
          <button className={`nav-item history-nav${view === 'loops' ? ' active' : ''}`} type="button" onClick={() => navigateTo({ view: 'loops', playlistId: null, detailOpen: false })}><span>Loops</span><strong>{songs.filter((song) => song.loopStart !== undefined && song.loopEnd !== undefined).length}</strong></button>

          <div className="sidebar-heading">
            <button className="heading-longpress" type="button" onPointerDown={startPlaylistLongPress} onPointerUp={cancelPlaylistLongPress} onPointerCancel={cancelPlaylistLongPress} onPointerLeave={cancelPlaylistLongPress}>Playlists</button>
            {reorderScope === 'sidebar' && <button className="finish-inline" type="button" onClick={finishReorder}>Fertig</button>}
            {playlistMenuOpen && <div className="edit-popover playlist-menu"><button type="button" onClick={() => beginReorder('sidebar')}>Bearbeiten</button><button type="button" onClick={() => navigateTo({ view: 'playlistOverview', playlistId: activePlaylistId, detailOpen: false })}>Übersicht</button></div>}
          </div>
          <div className="playlist-nav">
            {renderDropZone(0, 'playlist')}
            {sidebarPlaylists.map((playlist, index) => <div className="playlist-nav-row" key={playlist.id}>
              {reorderScope === 'sidebar' && <button className="move-selector" type="button" onClick={() => setMoveCandidate({ kind: 'playlist', id: playlist.id, targetIndex: null })}>↕</button>}
              <button className={`nav-item${activePlaylistId === playlist.id && view === 'library' ? ' active' : ''}`} type="button" onClick={() => void openPlaylist(playlist.id)} disabled={reorderScope === 'sidebar'}>
                <span className="playlist-nav-name">{coverUrls[playlist.id] ? <img src={coverUrls[playlist.id]} alt="" /> : <span className="playlist-mini-cover">♫</span>}<span>{playlist.name}</span></span><strong>{playlist.songIds.length}</strong>
              </button>
              {renderDropZone(index + 1, 'playlist')}
            </div>)}
          </div>
          <form className="new-playlist" onSubmit={createPlaylist}><input value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} placeholder="Neue Playlist" /><button type="submit" disabled={!playlistName.trim()}>+</button></form>
        </aside>

        <section className="library-panel">
          <div className={`library-heading${activePlaylist ? ' playlist-heading' : ''}`}>
            {activePlaylist && view === 'library' && <button className="playlist-cover" type="button" onClick={() => coverInputRef.current?.click()}>{coverUrls[activePlaylist.id] ? <img src={coverUrls[activePlaylist.id]} alt="" /> : <span>+ Bild</span>}</button>}
            <div className="library-title"><p className="eyebrow">{view === 'history' ? 'IMPORTIERT' : view === 'loops' ? 'GESPEICHERTE LOOPS' : activePlaylist ? 'PLAYLIST' : 'DEINE MUSIK'}</p>
              {activePlaylist && view === 'library' && isEditingPlaylist ? <form className="rename-playlist" onSubmit={savePlaylistName}><input value={editingName} onChange={(event) => setEditingName(event.target.value)} autoFocus /><button type="submit">Speichern</button><button type="button" onClick={() => setIsEditingPlaylist(false)}>Abbrechen</button></form> : <h1>{title}</h1>}
              <p>{visibleSongs.length} {visibleSongs.length === 1 ? 'Lied' : 'Lieder'}</p>
            </div>
            <div className="playlist-actions">
              {!selectionMode && <button type="button" onClick={startSelection}>Auswählen</button>}
              {selectionMode && <><button type="button" onClick={selectAllVisible}>Alle</button><button type="button" disabled={!selectedSongIds.size} onClick={() => setPlaylistChooserMode('bulk')}>Zu Playlist</button><button type="button" onClick={stopSelection}>Abbrechen</button></>}
              {activePlaylist && view === 'library' && !selectionMode && <><button type="button" onClick={startEditingPlaylist}>Name ändern</button><button type="button" onClick={() => coverInputRef.current?.click()}>Bild ändern</button><button type="button" onClick={() => reorderScope === 'playlist' ? finishReorder() : beginReorder('playlist')}>{reorderScope === 'playlist' ? 'Fertig' : 'Reihenfolge ändern'}</button><button className="danger-button" type="button" onClick={() => setPlaylistToDelete(activePlaylist)}>Playlist löschen</button><input ref={coverInputRef} className="file-input" type="file" accept="image/*" onChange={(event) => void changePlaylistCover(event.target.files)} /></>}
              {!activePlaylist && view === 'library' && !selectionMode && <button type="button" onClick={() => reorderScope === 'library' ? finishReorder() : beginReorder('library')}>{reorderScope === 'library' ? 'Fertig' : 'Reihenfolge ändern'}</button>}
            </div>
          </div>
          {message && <div className="message">{message}</div>}
          {selectionMode && <div className="selection-hint">{selectedSongIds.size} ausgewählt. Tippe weitere Lieder an oder wähle anschließend „Zu Playlist“.</div>}
          {visibleSongs.length ? <div className="song-list">
            {renderDropZone(0, 'song')}
            {visibleSongs.map((song, index) => <div key={song.id} className={`song-row${song.isNew ? ' new-import' : ''}${selectedSongIds.has(song.id) ? ' selected-song' : ''}`} onPointerDown={(event) => openSongMenu(song.id, event.clientX, event.clientY)} onPointerUp={cancelSongLongPress} onPointerCancel={cancelSongLongPress} onPointerLeave={cancelSongLongPress}>
              {songEditMode && <button className="move-selector" type="button" onClick={() => setMoveCandidate({ kind: 'song', id: song.id, targetIndex: null })}>↕</button>}
              {selectionMode && <button className="selection-check" type="button" onClick={() => toggleSelected(song.id)}>{selectedSongIds.has(song.id) ? '✓' : ''}</button>}
              <button className="song-main" type="button" onClick={() => playSong(song.id)} disabled={songEditMode}>
                <span className="song-number">{song.id === currentSongId && isPlaying ? '▶' : index + 1}</span>
                <span className="song-copy"><strong>{song.name}</strong><small>{view === 'history' ? formatDate(song.addedAt) : membershipText(song.id)}</small></span>
                <span className="song-actions-end">{song.loopStart !== undefined && song.loopEnd !== undefined && <span className="loop-badge" title="Loop gespeichert">↻</span>}<span className="song-action">▶</span></span>
              </button>
              {activePlaylist && view === 'library' && !selectionMode && !songEditMode && <button className="remove-song" type="button" onClick={() => void removeSongFromActivePlaylist(song.id)}>Entfernen</button>}
              {renderDropZone(index + 1, 'song')}
            </div>)}
          </div> : <div className="empty-state"><div className="empty-icon">♫</div><h2>{view === 'loops' ? 'Noch keine Loops gespeichert.' : 'Noch keine Musik hier.'}</h2></div>}
        </section>
      </main>}

      {view === 'playlistOverview' && <section className="playlist-overview"><div className="playlist-overview-heading"><p className="eyebrow">DEINE MUSIK</p><h1>Playlists</h1><p>{playlists.length} Playlists</p></div><div className="playlist-grid">{sidebarPlaylists.map((playlist) => <button className="playlist-card" key={playlist.id} type="button" onClick={() => void openPlaylist(playlist.id)}><span className="playlist-card-cover">{coverUrls[playlist.id] ? <img src={coverUrls[playlist.id]} alt="" /> : '♫'}</span><strong>{playlist.name}</strong><small>{playlist.songIds.length} {playlist.songIds.length === 1 ? 'Lied' : 'Lieder'}</small></button>)}</div></section>}

      <section className={`player${currentSong ? ' visible' : ''}`}>
        <audio ref={audioRef} src={currentUrl ?? undefined} playsInline onTimeUpdate={(event) => {
          const audio = event.currentTarget
          const song = currentSong
          if (song?.loopEnabled && song.loopStart !== undefined && song.loopEnd !== undefined && audio.currentTime >= song.loopEnd) audio.currentTime = song.loopStart
          setCurrentTime(audio.currentTime)
        }} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => moveSong(1)} />
        <button className="now-playing" type="button" onClick={() => currentSong && navigateTo({ view, playlistId: activePlaylistId, detailOpen: true })} disabled={!currentSong}><span className="cover-placeholder">♫</span><span className="now-playing-copy"><small>JETZT</small><span className="marquee"><strong>{currentSong?.name ?? 'Kein Song ausgewählt'}</strong></span></span></button>
        <div className="transport"><div className="transport-buttons"><button className={shuffle ? 'active-control' : ''} onClick={() => setShuffle((value) => !value)}>⇄</button><button onClick={() => moveSong(-1)}>⏮</button><button className="play-button" onClick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button><button onClick={() => moveSong(1)}>⏭</button><button className={repeatQueue ? 'active-control' : ''} onClick={() => setRepeatQueue((value) => !value)}>↻</button></div><div className="progress-row"><span>{formatTime(currentTime)}</span><input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(Number(event.target.value))} /><span>{formatTime(duration)}</span></div></div>
        <div className="quick-playlists"><button className="all-playlists-button" type="button" onClick={() => setPlaylistChooserMode('current')} disabled={!currentSong}><span>Alle Playlists</span><strong>›</strong></button></div>
      </section>

      {detailOpen && currentSong && <section className="song-detail"><div className="detail-topbar"><button type="button" onClick={navigateBack}>‹ Zurück</button></div><div className="detail-content"><p className="detail-label">JETZT</p><h2>{currentSong.name}</h2><div className="playlist-membership"><span>IN PLAYLISTS</span><strong>{currentSongPlaylists.length ? currentSongPlaylists.map((playlist) => playlist.name).join(' · ') : 'In keiner Playlist'}</strong></div><div className="detail-progress"><input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(Number(event.target.value))} /><div><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div></div><div className="detail-controls"><button onClick={playPreviousFromHistory} disabled={!playHistory.length}>⏮</button><button onClick={() => skipSeconds(-10)}>↶<small>10</small></button><button className="detail-play" onClick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button><button onClick={() => skipSeconds(10)}>↷<small>10</small></button><button onClick={() => moveSong(1)}>⏭</button></div>
        <div className="loop-panel"><div><span className="loop-panel-label">LOOP</span><h3>{currentSong.loopStart !== undefined && currentSong.loopEnd !== undefined ? `${formatTime(currentSong.loopStart)} – ${formatTime(currentSong.loopEnd)}` : 'Noch kein Vorschlag'}</h3>{currentSong.loopConfidence !== undefined && <p>{currentSong.loopConfidence}% Übereinstimmung – experimenteller Vorschlag</p>}</div><div className="loop-actions">{currentSong.loopStart === undefined || currentSong.loopEnd === undefined ? <button type="button" onClick={() => void analyzeCurrentLoop()} disabled={loopAnalyzing}>{loopAnalyzing ? 'Analysiere…' : 'Loop vorschlagen'}</button> : <><button className={currentSong.loopEnabled ? 'loop-active' : ''} type="button" onClick={() => void toggleCurrentLoop()}>{currentSong.loopEnabled ? 'Loop aktiv' : 'Loop aktivieren'}</button><button type="button" onClick={() => void analyzeCurrentLoop()} disabled={loopAnalyzing}>Neu analysieren</button><button className="danger-button" type="button" onClick={() => void removeCurrentLoop()}>Loop entfernen</button></>}</div></div>
      </div></section>}

      {playlistChooserMode && <div className="playlist-chooser-backdrop" onMouseDown={() => setPlaylistChooserMode(null)}><section className="playlist-chooser" onMouseDown={(event) => event.stopPropagation()}><div className="playlist-chooser-heading"><div><p className="eyebrow">PLAYLISTS</p><h2>{playlistChooserMode === 'bulk' ? `${selectedSongIds.size} Lieder zuordnen` : 'Alle Playlists'}</h2></div><button type="button" onClick={() => setPlaylistChooserMode(null)}>×</button></div><div className="playlist-groups">{groupedPlaylists.map(([group, items]) => <div className="playlist-group" key={group}><strong>{group}</strong><div>{items.map((playlist) => {
        const contains = currentSong ? playlist.songIds.includes(currentSong.id) : false
        return <button key={playlist.id} type="button" onClick={() => playlistChooserMode === 'bulk' ? void assignSelectedToPlaylist(playlist) : void toggleCurrentInPlaylist(playlist)}><span>{playlist.name}</span>{playlistChooserMode === 'current' && <b>{contains ? '−' : '+'}</b>}</button>
      })}</div></div>)}</div></section></div>}

      {songMenuId && <><button className="song-menu-shield" type="button" onClick={() => setSongMenuId(null)} /><div className="song-context-menu" style={{ left: songMenuPosition.x, top: songMenuPosition.y }}><button type="button" onClick={() => void markSeen(songMenuId)}>Als gesehen markieren</button><button type="button" onClick={() => void markSeen()}>Alle als gesehen markieren</button></div></>}
      {playlistMenuOpen && <button className="edit-popover-shield" type="button" onClick={() => setPlaylistMenuOpen(false)} />}
      {playlistToDelete && <div className="modal-backdrop" onMouseDown={() => setPlaylistToDelete(null)}><div className="confirm-dialog" onMouseDown={(event) => event.stopPropagation()}><h2>Playlist löschen?</h2><p>„{playlistToDelete.name}“ wird gelöscht. Die Musikdateien bleiben erhalten.</p><div className="dialog-actions"><button type="button" onClick={() => setPlaylistToDelete(null)}>Abbrechen</button><button className="danger-button" type="button" onClick={() => void confirmDeletePlaylist()}>Playlist löschen</button></div></div></div>}
    </div>
  )
}

export default App
