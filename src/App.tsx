import { useEffect, useMemo, useRef, useState } from 'react'
import {
  deletePlaylist,
  deleteSong,
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
import './loopEditor.css'

function formatTime(seconds?: number) {
  if (!Number.isFinite(seconds)) return '--:--'
  const value = Math.max(0, seconds ?? 0)
  const minutes = Math.floor(value / 60)
  const rest = Math.floor(value % 60)
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

function formatPrecise(seconds: number) {
  const value = Math.max(0, seconds)
  const minutes = Math.floor(value / 60)
  const rest = value - minutes * 60
  return `${minutes}:${rest.toFixed(3).padStart(6, '0')}`
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)
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

type View = 'library' | 'history' | 'loops' | 'playlistOverview'
type NavigationEntry = { view: View; playlistId: string | null; detailOpen: boolean }
type ReorderScope = 'library' | 'playlist' | 'sidebar' | null
type MoveCandidate = { kind: 'song' | 'playlist'; id: string; targetIndex: number | null } | null
type Snapshot = { songs: Song[]; playlists: Playlist[] }
type PlaylistChooserMode = 'current' | 'bulk' | null
type SortMode = 'manual' | 'azStart' | 'azEnd' | 'plays' | 'duration' | 'chronology'
type SortDirection = 'down' | 'up'
type OverflowMenu = { kind: 'song' | 'playlist' | 'playlists'; id?: string } | null
type LoopDrag = { kind: 'move' | 'start' | 'end' | 'cursor' | 'focus'; offset: number } | null
type RenameTarget = { kind: 'song' | 'playlist'; id: string } | null
type ShareNavigator = Navigator & {
  share?: (data: { title?: string; text?: string; files?: File[] }) => Promise<void>
  canShare?: (data: { title?: string; text?: string; files?: File[] }) => boolean
}

function extensionForType(type: string) {
  if (type.includes('mp4') || type.includes('m4a')) return 'm4a'
  if (type.includes('aac')) return 'aac'
  if (type.includes('wav')) return 'wav'
  if (type.includes('ogg')) return 'ogg'
  if (type.includes('flac')) return 'flac'
  return 'mp3'
}

const LOOP_PLAYBACK_RATES = [0.1, 0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.5, 2] as const

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
  const [repeatSelectionIds, setRepeatSelectionIds] = useState<Set<string>>(new Set())
  const [shuffle, setShuffle] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playlistName, setPlaylistName] = useState('')
  const [editingName, setEditingName] = useState('')
  const [isEditingPlaylist, setIsEditingPlaylist] = useState(false)
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null)
  const [songToDelete, setSongToDelete] = useState<Song | null>(null)
  const [renameTarget, setRenameTarget] = useState<RenameTarget>(null)
  const [renameValue, setRenameValue] = useState('')
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
  const [overflowMenu, setOverflowMenu] = useState<OverflowMenu>(null)
  const [sortMode, setSortMode] = useState<SortMode>(() => (localStorage.getItem('josi-sort-mode') as SortMode) || 'manual')
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => (localStorage.getItem('josi-sort-direction') as SortDirection) || 'down')

  const [loopEditorSongId, setLoopEditorSongId] = useState<string | null>(null)
  const [loopDraftStart, setLoopDraftStart] = useState(0)
  const [loopDraftEnd, setLoopDraftEnd] = useState(0)
  const [loopCursor, setLoopCursor] = useState(0)
  const [loopFocus, setLoopFocus] = useState(0)
  const [loopZoom, setLoopZoom] = useState(1)
  const [loopSelectionLocked, setLoopSelectionLocked] = useState(false)
  const [markersEnabled, setMarkersEnabled] = useState(true)
  const [cursorLoopEnabled, setCursorLoopEnabled] = useState(true)
  const [focusFollowsCursor, setFocusFollowsCursor] = useState(true)
  const [loopMarkers, setLoopMarkers] = useState<number[]>([])
  const [activeLoopEdge, setActiveLoopEdge] = useState<'start' | 'end'>('start')
  const [previewLead, setPreviewLead] = useState('1')
  const [edgeStep, setEdgeStep] = useState('0,01')
  const [waveform, setWaveform] = useState<number[]>([])
  const [waveformStatus, setWaveformStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle')
  const [loopPlaybackRate, setLoopPlaybackRate] = useState(1)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const shouldAutoPlayRef = useRef(false)
  const loopTimelineRef = useRef<HTMLDivElement>(null)
  const loopFocusRef = useRef<HTMLDivElement>(null)
  const loopTimelineScrollRef = useRef<HTMLDivElement>(null)
  const loopDragRef = useRef<LoopDrag>(null)
  const repeatHoldTimerRef = useRef<number | null>(null)
  const repeatHoldTriggeredRef = useRef(false)

  useEffect(() => {
    Promise.all([getSongs(), getPlaylists()]).then(([storedSongs, storedPlaylists]) => {
      setSongs(storedSongs)
      setPlaylists(storedPlaylists)
      if (storedSongs.some((song) => !song.file || song.file.size === 0)) setMessage('Mindestens eine lokal gespeicherte Audiodatei ist nicht mehr verfügbar. Diese Lieder müssen neu importiert werden.')
    }).catch(() => setMessage('Lokale Musikdaten konnten nicht geladen werden.'))
  }, [])

  useEffect(() => { localStorage.setItem('josi-sort-mode', sortMode) }, [sortMode])
  useEffect(() => { localStorage.setItem('josi-sort-direction', sortDirection) }, [sortDirection])

  const currentSong = songs.find((song) => song.id === currentSongId) ?? null
  const activePlaylist = playlists.find((playlist) => playlist.id === activePlaylistId) ?? null
  const editorSong = songs.find((song) => song.id === loopEditorSongId) ?? null
  const editorDuration = loopEditorSongId && loopEditorSongId === currentSongId ? (duration || editorSong?.duration || 0) : (editorSong?.duration || 0)

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
  const repeatSelectionQueue = repeatSelectionIds.size ? playerQueue.filter((song) => repeatSelectionIds.has(song.id)) : []
  const currentSongPlaylists = useMemo(() => currentSong ? playlists.filter((playlist) => playlist.songIds.includes(currentSong.id)) : [], [currentSong, playlists])
  const groupedPlaylists = useMemo(() => groupPlaylists(playlists), [playlists])

  useEffect(() => {
    const urls: Record<string, string> = {}
    playlists.forEach((playlist) => { if (playlist.cover) urls[playlist.id] = URL.createObjectURL(playlist.cover) })
    setCoverUrls(urls)
    return () => Object.values(urls).forEach((url) => URL.revokeObjectURL(url))
  }, [playlists])

  useEffect(() => {
    const file = currentSong?.file
    if (!file || file.size === 0) { setCurrentUrl(null); return }
    const url = URL.createObjectURL(file)
    setCurrentUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [currentSong?.id, currentSong?.file])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentUrl) return
    audio.load()
    if (shouldAutoPlayRef.current) void audio.play().catch(() => setIsPlaying(false))
  }, [currentUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = loopEditorSongId ? loopPlaybackRate : 1
  }, [loopEditorSongId, loopPlaybackRate, currentUrl])

  useEffect(() => {
    if (!editorSong || !editorDuration) return
    const existingStart = editorSong.loopStart
    const existingEnd = editorSong.loopEnd
    let initialCursor = 0
    if (existingStart !== undefined && existingEnd !== undefined && existingEnd > existingStart) {
      const start = Math.max(0, Math.min(existingStart, editorDuration))
      setLoopDraftStart(start)
      setLoopDraftEnd(Math.max(start, Math.min(existingEnd, editorDuration)))
      initialCursor = start
    } else {
      const start = Math.min(editorDuration * .2, Math.max(0, editorDuration - 2))
      const length = Math.min(Math.max(editorDuration * .22, 2), 20, Math.max(2, editorDuration - start))
      setLoopDraftStart(start)
      setLoopDraftEnd(Math.min(editorDuration, start + length))
      initialCursor = start
    }
    setLoopCursor(initialCursor)
    setLoopFocus(initialCursor)
    setLoopMarkers((editorSong.loopMarkers ?? []).filter((value) => value >= 0 && value <= editorDuration))
    setLoopZoom(1)
    setLoopSelectionLocked(false)
    setMarkersEnabled(true)
    setCursorLoopEnabled(true)
    setFocusFollowsCursor(true)
    setLoopPlaybackRate(1)
    setActiveLoopEdge('start')
  }, [loopEditorSongId, editorDuration])

  useEffect(() => {
    if (!loopEditorSongId || !editorSong?.file || editorSong.file.size === 0) {
      setWaveform([])
      setWaveformStatus('idle')
      return
    }
    let cancelled = false
    setWaveform([])
    setWaveformStatus('loading')
    const buildWaveform = async () => {
      const AudioContextClass = window.AudioContext
      if (!AudioContextClass) throw new Error('no-audio-context')
      const context = new AudioContextClass()
      try {
        const buffer = await context.decodeAudioData((await editorSong.file.arrayBuffer()).slice(0))
        const channel = buffer.getChannelData(0)
        const buckets = 720
        const block = Math.max(1, Math.floor(channel.length / buckets))
        const peaks = Array.from({ length: buckets }, (_, bucket) => {
          const start = bucket * block
          const end = Math.min(channel.length, start + block)
          let peak = 0
          for (let index = start; index < end; index += Math.max(1, Math.floor(block / 120))) peak = Math.max(peak, Math.abs(channel[index]))
          return peak
        })
        const max = Math.max(...peaks, .001)
        if (!cancelled) {
          setWaveform(peaks.map((value) => Math.max(.04, value / max)))
          setWaveformStatus('ready')
        }
      } finally {
        void context.close()
      }
    }
    void buildWaveform().catch(() => { if (!cancelled) setWaveformStatus('unavailable') })
    return () => { cancelled = true }
  }, [loopEditorSongId, editorSong?.id, editorSong?.file])

  useEffect(() => {
    if (!loopEditorSongId || !editorDuration || !focusFollowsCursor) return
    setLoopFocus(loopCursor)
    const frame = requestAnimationFrame(() => {
      const scroller = loopTimelineScrollRef.current
      const timeline = loopTimelineRef.current
      if (!scroller || !timeline) return
      const target = (loopCursor / editorDuration) * timeline.offsetWidth - scroller.clientWidth / 2
      scroller.scrollLeft = Math.max(0, Math.min(target, scroller.scrollWidth - scroller.clientWidth))
    })
    return () => cancelAnimationFrame(frame)
  }, [loopCursor, focusFollowsCursor, loopEditorSongId, editorDuration])

  useEffect(() => {
    if (!loopEditorSongId || !editorDuration) return
    const frame = requestAnimationFrame(() => {
      const scroller = loopTimelineScrollRef.current
      const timeline = loopTimelineRef.current
      if (!scroller || !timeline) return
      const target = (loopFocus / editorDuration) * timeline.offsetWidth - scroller.clientWidth / 2
      scroller.scrollLeft = Math.max(0, Math.min(target, scroller.scrollWidth - scroller.clientWidth))
    })
    return () => cancelAnimationFrame(frame)
  }, [loopZoom])

  const snapshot = (): Snapshot => ({ songs: songs.map((song) => ({ ...song, loopMarkers: song.loopMarkers ? [...song.loopMarkers] : undefined })), playlists: playlists.map((playlist) => ({ ...playlist, songIds: [...playlist.songIds] })) })
  const recordHistory = () => { setUndoStack((items) => [...items, snapshot()].slice(-50)); setRedoStack([]) }
  const restoreSnapshot = async (target: Snapshot) => {
    const previousSongs = songs
    const previousPlaylists = playlists
    setSongs(target.songs)
    setPlaylists(target.playlists)
    const songIds = new Set(target.songs.map((song) => song.id))
    const playlistIds = new Set(target.playlists.map((playlist) => playlist.id))
    await Promise.all(previousSongs.filter((song) => !songIds.has(song.id)).map((song) => deleteSong(song.id)))
    await saveSongOrder(target.songs)
    await Promise.all(previousPlaylists.filter((playlist) => !playlistIds.has(playlist.id)).map((playlist) => deletePlaylist(playlist.id)))
    await Promise.all(target.playlists.map(savePlaylist))
  }
  const undo = async () => { const target = undoStack.at(-1); if (!target || moveCandidate) return; setUndoStack((items) => items.slice(0, -1)); setRedoStack((items) => [...items, snapshot()].slice(-50)); await restoreSnapshot(target) }
  const redo = async () => { const target = redoStack.at(-1); if (!target || moveCandidate) return; setRedoStack((items) => items.slice(0, -1)); setUndoStack((items) => [...items, snapshot()].slice(-50)); await restoreSnapshot(target) }

  const applyNavigation = (entry: NavigationEntry) => {
    setView(entry.view); setActivePlaylistId(entry.playlistId); setDetailOpen(entry.detailOpen); setSelectionMode(false); setSelectedSongIds(new Set()); setOverflowMenu(null); setLoopEditorSongId(null)
  }
  const navigateTo = (entry: NavigationEntry) => {
    const current = navigation[navigationIndex]
    if (current && current.view === entry.view && current.playlistId === entry.playlistId && current.detailOpen === entry.detailOpen) return
    const next = [...navigation.slice(0, navigationIndex + 1), entry].slice(-60)
    setNavigation(next); setNavigationIndex(next.length - 1); applyNavigation(entry)
  }
  const navigateBack = () => { if (loopEditorSongId) { setLoopEditorSongId(null); return } if (navigationIndex <= 0) return; const next = navigationIndex - 1; setNavigationIndex(next); applyNavigation(navigation[next]) }
  const navigateForward = () => { if (navigationIndex >= navigation.length - 1) return; const next = navigationIndex + 1; setNavigationIndex(next); applyNavigation(navigation[next]) }

  const updateSong = async (updated: Song, addHistory = false) => { if (addHistory) recordHistory(); setSongs((items) => items.map((song) => song.id === updated.id ? updated : song)); await saveSong(updated) }
  const updatePlaylist = async (updated: Playlist, addHistory = false) => { if (addHistory) recordHistory(); setPlaylists((items) => items.map((playlist) => playlist.id === updated.id ? updated : playlist)); await savePlaylist(updated) }

  const toggleSelected = (id: string) => setSelectedSongIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const playSong = (id: string, remember = true) => {
    if (selectionMode) return toggleSelected(id)
    const song = songs.find((item) => item.id === id)
    if (!song?.file || song.file.size === 0) { setMessage('Diese Audiodatei ist lokal nicht mehr verfügbar. Bitte importiere sie erneut.'); return }
    if (id === currentSongId && audioRef.current) return void audioRef.current.play().catch(() => setMessage(`„${song.name}“ konnte nicht gestartet werden.`))
    if (remember && currentSongId) setPlayHistory((items) => [...items, currentSongId].slice(-50))
    shouldAutoPlayRef.current = true; setCurrentSongId(id); setCurrentTime(0)
  }
  const playQueueSong = (song: Song) => {
    if (song.id === currentSongId && audioRef.current) {
      audioRef.current.currentTime = 0
      setCurrentTime(0)
      void audioRef.current.play().catch(() => setMessage(`„${song.name}“ konnte nicht erneut gestartet werden.`))
      return
    }
    playSong(song.id)
  }
  const moveSong = (direction: 1 | -1) => {
    if (!playerQueue.length) return
    const queue = repeatSelectionQueue.length ? repeatSelectionQueue : playerQueue
    const currentIndex = queue.findIndex((song) => song.id === currentSongId)
    if (!repeatSelectionQueue.length && shuffle && direction === 1 && playerQueue.length > 1) {
      const options = playerQueue.filter((song) => song.id !== currentSongId && song.file?.size)
      if (options.length) return playSong(options[Math.floor(Math.random() * options.length)].id)
    }
    const nextIndex = currentIndex < 0 ? (direction === 1 ? 0 : queue.length - 1) : currentIndex + direction
    if (nextIndex >= 0 && nextIndex < queue.length) return playQueueSong(queue[nextIndex])
    if (repeatSelectionQueue.length) return playQueueSong(queue[direction === 1 ? 0 : queue.length - 1])
    if (repeatQueue) return playSong(playerQueue[direction === 1 ? 0 : playerQueue.length - 1].id)
    shouldAutoPlayRef.current = false; setIsPlaying(false)
  }
  const togglePlayback = () => {
    const audio = audioRef.current
    if (!currentSong) return playerQueue[0] && playSong(playerQueue[0].id)
    if (!audio) return
    if (audio.paused) void audio.play().catch(() => setMessage(`„${currentSong.name}“ konnte nicht gestartet werden.`))
    else audio.pause()
  }
  const seek = (value: number) => { if (!audioRef.current) return; const next = Math.max(0, Math.min(duration || 0, value)); audioRef.current.currentTime = next; setCurrentTime(next); if (loopEditorSongId) setLoopCursor(next) }
  const skipSeconds = (seconds: number) => seek(currentTime + seconds)
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

  const openImportPicker = () => { const input = fileInputRef.current; if (!input) return; input.value = ''; input.click() }
  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const audioFiles = Array.from(files).filter((file) => file.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(file.name))
    if (!audioFiles.length) return setMessage('Keine unterstützten Audiodateien ausgewählt.')
    try {
      const previousNew = songs.filter((song) => song.isNew)
      if (previousNew.length) await Promise.all(previousNew.map((song) => saveSong({ ...song, isNew: false })))
      const imported = await saveSongs(audioFiles)
      setSongs([...songs.map((song) => ({ ...song, isNew: false })), ...imported])
      setMessage(`${imported.length} ${imported.length === 1 ? 'Song wurde' : 'Songs wurden'} importiert.`)
    } catch (error) {
      const quota = error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'UnknownError')
      setMessage(quota ? 'Import fehlgeschlagen: Der lokale Browser-Speicher ist wahrscheinlich voll oder wurde von iPadOS begrenzt.' : 'Import fehlgeschlagen. Bitte wähle die Dateien erneut über „Auswählen“ und „Öffnen“.')
    } finally { if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  const markSeen = async (id?: string) => {
    if (id) { const song = songs.find((item) => item.id === id); if (song) await updateSong({ ...song, isNew: false }) }
    else {
      const changed = songs.filter((song) => song.isNew)
      if (changed.length) await Promise.all(changed.map((song) => saveSong({ ...song, isNew: false })))
      setSongs((items) => items.map((song) => song.isNew ? { ...song, isNew: false } : song))
    }
    setOverflowMenu(null)
  }

  const beginRename = (kind: 'song' | 'playlist', id: string) => {
    const name = kind === 'song' ? songs.find((song) => song.id === id)?.name : playlists.find((playlist) => playlist.id === id)?.name
    if (!name) return
    setRenameTarget({ kind, id }); setRenameValue(name); setOverflowMenu(null)
  }
  const confirmRename = async (event: React.FormEvent) => {
    event.preventDefault()
    const name = renameValue.trim()
    if (!renameTarget || !name) return
    if (renameTarget.kind === 'song') {
      const song = songs.find((item) => item.id === renameTarget.id)
      if (song) await updateSong({ ...song, name }, true)
    } else {
      const playlist = playlists.find((item) => item.id === renameTarget.id)
      if (playlist) await updatePlaylist({ ...playlist, name, lastUsedAt: Date.now() }, true)
    }
    setRenameTarget(null)
  }

  const copySong = async (id: string) => {
    const song = songs.find((item) => item.id === id)
    if (!song?.file || song.file.size === 0) { setMessage('Diese Datei kann nicht kopiert werden, weil der lokale Audioblob fehlt.'); setOverflowMenu(null); return }
    recordHistory()
    const now = Date.now()
    const copy: Song = { ...song, id: crypto.randomUUID(), name: `${song.name} Kopie`, addedAt: now, libraryOrder: now, importBatchId: crypto.randomUUID(), isNew: false, completedPlays: 0, loopMarkers: song.loopMarkers ? [...song.loopMarkers] : undefined }
    await saveSong(copy)
    setSongs((items) => [...items, copy])
    setOverflowMenu(null)
    setMessage(`„${song.name}“ wurde kopiert.`)
  }

  const copyPlaylist = async (id: string) => {
    const playlist = playlists.find((item) => item.id === id)
    if (!playlist) return
    recordHistory()
    const copy: Playlist = { ...playlist, id: crypto.randomUUID(), name: `${playlist.name} Kopie`, songIds: [...playlist.songIds], createdAt: Date.now(), lastUsedAt: Date.now(), sortOrder: -Date.now() }
    await savePlaylist(copy)
    setPlaylists((items) => [copy, ...items])
    setOverflowMenu(null)
  }

  const shareSong = async (id: string) => {
    const song = songs.find((item) => item.id === id)
    const nav = navigator as ShareNavigator
    if (!song?.file || song.file.size === 0) { setMessage('Diese Audiodatei ist lokal nicht mehr verfügbar.'); setOverflowMenu(null); return }
    if (!nav.share) { setMessage('Die System-Freigabe wird in diesem Browser nicht unterstützt.'); setOverflowMenu(null); return }
    const file = new File([song.file], `${song.name}.${extensionForType(song.type)}`, { type: song.type || 'audio/mpeg' })
    const data = { title: song.name, files: [file] }
    if (nav.canShare && !nav.canShare(data)) { setMessage('Diese Audiodatei kann von iPadOS hier nicht direkt geteilt werden.'); setOverflowMenu(null); return }
    try { await nav.share(data) } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('Teilen konnte nicht geöffnet werden.') }
    setOverflowMenu(null)
  }

  const sharePlaylist = async (id: string) => {
    const playlist = playlists.find((item) => item.id === id)
    const nav = navigator as ShareNavigator
    if (!playlist) return
    if (!nav.share) { setMessage('Die System-Freigabe wird in diesem Browser nicht unterstützt.'); setOverflowMenu(null); return }
    const byId = new Map(songs.map((song) => [song.id, song.name]))
    const list = playlist.songIds.map((songId, index) => `${index + 1}. ${byId.get(songId) ?? 'Unbekanntes Lied'}`).join('\n')
    try { await nav.share({ title: playlist.name, text: `${playlist.name}\n\n${list || 'Keine Lieder'}` }) } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('Teilen konnte nicht geöffnet werden.') }
    setOverflowMenu(null)
  }

  const confirmDeleteSong = async () => {
    if (!songToDelete) return
    recordHistory()
    await deleteSong(songToDelete.id)
    const affected = playlists.filter((playlist) => playlist.songIds.includes(songToDelete.id)).map((playlist) => ({ ...playlist, songIds: playlist.songIds.filter((id) => id !== songToDelete.id) }))
    if (affected.length) await Promise.all(affected.map(savePlaylist))
    setPlaylists((items) => items.map((playlist) => affected.find((changed) => changed.id === playlist.id) ?? playlist))
    setSongs((items) => items.filter((song) => song.id !== songToDelete.id))
    if (currentSongId === songToDelete.id) { audioRef.current?.pause(); setCurrentSongId(null); setCurrentUrl(null); setCurrentTime(0); setDuration(0) }
    if (loopEditorSongId === songToDelete.id) setLoopEditorSongId(null)
    setSelectedSongIds((items) => { const next = new Set(items); next.delete(songToDelete.id); return next })
    setSongToDelete(null)
  }

  const openLoopEditor = (id: string) => {
    const song = songs.find((item) => item.id === id)
    if (!song) return
    if (!song.file || song.file.size === 0) { setMessage('Für diesen Song fehlt die lokale Audiodatei.'); setOverflowMenu(null); return }
    shouldAutoPlayRef.current = false
    setCurrentSongId(id); setDetailOpen(false); setOverflowMenu(null); setLoopEditorSongId(id); setCurrentTime(0)
  }

  const timelineTime = (clientX: number) => {
    const element = loopTimelineRef.current
    if (!element || !editorDuration) return 0
    const rect = element.getBoundingClientRect()
    return Math.max(0, Math.min(editorDuration, ((clientX - rect.left) / Math.max(rect.width, 1)) * editorDuration))
  }
  const focusTime = (clientX: number) => {
    const element = loopFocusRef.current
    if (!element || !editorDuration) return 0
    const rect = element.getBoundingClientRect()
    return Math.max(0, Math.min(editorDuration, ((clientX - rect.left) / Math.max(rect.width, 1)) * editorDuration))
  }
  const beginLoopDrag = (event: React.PointerEvent, kind: 'move' | 'start' | 'end' | 'cursor' | 'focus') => {
    if (!editorDuration) return
    if (loopSelectionLocked && kind !== 'cursor' && kind !== 'focus') return
    if (kind === 'focus' && focusFollowsCursor) return
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId)
    const time = kind === 'focus' ? focusTime(event.clientX) : timelineTime(event.clientX)
    if (kind === 'start' || kind === 'end') setActiveLoopEdge(kind)
    if (kind === 'cursor') { setLoopCursor(time); seek(time) }
    if (kind === 'focus') setLoopFocus(time)
    loopDragRef.current = { kind, offset: kind === 'move' ? time - loopDraftStart : 0 }
  }
  const moveLoopDrag = (event: React.PointerEvent) => {
    const drag = loopDragRef.current
    if (!drag || !editorDuration) return
    if (drag.kind === 'focus') { setLoopFocus(focusTime(event.clientX)); return }
    const time = timelineTime(event.clientX)
    const minLength = Math.min(.5, Math.max(.05, editorDuration * .002))
    if (drag.kind === 'cursor') { setLoopCursor(time); seek(time); return }
    if (drag.kind === 'start') { setLoopDraftStart(Math.max(0, Math.min(time, loopDraftEnd - minLength))); return }
    if (drag.kind === 'end') { setLoopDraftEnd(Math.min(editorDuration, Math.max(time, loopDraftStart + minLength))); return }
    const length = Math.max(minLength, loopDraftEnd - loopDraftStart)
    const start = Math.max(0, Math.min(editorDuration - length, time - drag.offset))
    setLoopDraftStart(start); setLoopDraftEnd(start + length)
  }
  const endLoopDrag = () => { loopDragRef.current = null }
  const moveCursorTo = (value: number, play = false) => {
    const next = Math.max(0, Math.min(editorDuration || 0, value))
    setLoopCursor(next); seek(next)
    if (play) void audioRef.current?.play().catch(() => setMessage('Die Vorschau konnte nicht gestartet werden.'))
  }
  const parsedEdgeStep = () => Math.max(.001, Math.min(60, Number.parseFloat(edgeStep.replace(',', '.')) || .01))
  const nudgeActiveEdge = (delta: number) => {
    if (loopSelectionLocked || !editorDuration) return
    const minLength = .001
    if (activeLoopEdge === 'start') setLoopDraftStart((value) => Math.max(0, Math.min(value + delta, loopDraftEnd - minLength)))
    else setLoopDraftEnd((value) => Math.min(editorDuration, Math.max(value + delta, loopDraftStart + minLength)))
  }
  const setMarker = () => {
    if (!markersEnabled || !editorDuration) return
    setLoopMarkers((items) => [...items, loopCursor].sort((a, b) => a - b))
  }
  const previewBoundary = (boundary: 'start' | 'end') => {
    const lead = Math.max(0, Number.parseFloat(previewLead.replace(',', '.')) || 0)
    moveCursorTo(Math.max(0, (boundary === 'start' ? loopDraftStart : loopDraftEnd) - lead), true)
  }
  const saveLoopDraft = async () => {
    if (!editorSong || !editorDuration || loopDraftEnd <= loopDraftStart) return
    const wasPlaying = Boolean(audioRef.current && !audioRef.current.paused)
    await updateSong({ ...editorSong, loopStart: loopDraftStart, loopEnd: loopDraftEnd, loopEnabled: true, loopConfidence: undefined, loopMarkers: [...loopMarkers] }, true)
    setLoopEditorSongId(null)
    if (wasPlaying) void audioRef.current?.play().catch(() => undefined)
    setMessage(`Loop für „${editorSong.name}“ gespeichert.`)
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
    } else if (reorderScope === 'playlist' && activePlaylist) await updatePlaylist({ ...activePlaylist, songIds: reorderIds(activePlaylist.songIds, moveCandidate.id, moveCandidate.targetIndex) })
    else { const ids = reorderIds(songs.map((song) => song.id), moveCandidate.id, moveCandidate.targetIndex); const byId = new Map(songs.map((song) => [song.id, song])); const updated = ids.map((id, index) => ({ ...byId.get(id)!, libraryOrder: index })); setSongs(updated); await saveSongOrder(updated) }
    setMoveCandidate(null)
  }
  const renderDropZone = (index: number, kind: 'song' | 'playlist') => !moveCandidate || moveCandidate.kind !== kind ? null : <button className={`drop-zone${moveCandidate.targetIndex === index ? ' selected' : ''}`} type="button" onClick={() => setMoveCandidate({ ...moveCandidate, targetIndex: index })}><span /></button>

  const membershipText = (songId: string) => { const names = playlists.filter((playlist) => playlist.songIds.includes(songId)).map((playlist) => playlist.name); return names.length ? names.join(' · ') : 'In keiner Playlist' }
  const startSelection = () => { setSelectionMode(true); setSelectedSongIds(new Set()) }
  const stopSelection = () => { setSelectionMode(false); setSelectedSongIds(new Set()); setPlaylistChooserMode(null) }
  const clearRepeatHold = () => {
    if (repeatHoldTimerRef.current !== null) window.clearTimeout(repeatHoldTimerRef.current)
    repeatHoldTimerRef.current = null
  }
  const activateRepeatSelection = () => {
    const chosen = selectionMode && selectedSongIds.size
      ? playerQueue.filter((song) => selectedSongIds.has(song.id)).map((song) => song.id)
      : currentSongId ? [currentSongId] : []
    if (!chosen.length) return
    const sameSelection = chosen.length === repeatSelectionIds.size && chosen.every((id) => repeatSelectionIds.has(id))
    setRepeatSelectionIds(sameSelection ? new Set() : new Set(chosen))
    if (!sameSelection) setRepeatQueue(false)
    if (selectionMode) {
      setSelectionMode(false)
      setSelectedSongIds(new Set())
      setPlaylistChooserMode(null)
    }
  }
  const beginRepeatHold = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    clearRepeatHold()
    repeatHoldTriggeredRef.current = false
    repeatHoldTimerRef.current = window.setTimeout(() => {
      repeatHoldTriggeredRef.current = true
      repeatHoldTimerRef.current = null
      activateRepeatSelection()
    }, 650)
  }
  const endRepeatHold = () => clearRepeatHold()
  const handleRepeatClick = () => {
    if (repeatHoldTriggeredRef.current) {
      repeatHoldTriggeredRef.current = false
      return
    }
    clearRepeatHold()
    if (repeatSelectionIds.size) {
      setRepeatSelectionIds(new Set())
      setRepeatQueue(false)
      return
    }
    setRepeatQueue((value) => !value)
  }
  const selectAllVisible = () => setSelectedSongIds(new Set(visibleSongs.map((song) => song.id)))
  const assignSelectedToPlaylist = async (playlist: Playlist) => { const ids = [...selectedSongIds]; if (!ids.length) return; recordHistory(); const merged = [...playlist.songIds]; ids.forEach((id) => { if (!merged.includes(id)) merged.push(id) }); await updatePlaylist({ ...playlist, songIds: merged, lastUsedAt: Date.now() }); setPlaylistChooserMode(null); stopSelection() }
  const toggleCurrentInPlaylist = async (playlist: Playlist) => { if (!currentSong) return; const contains = playlist.songIds.includes(currentSong.id); await updatePlaylist({ ...playlist, songIds: contains ? playlist.songIds.filter((id) => id !== currentSong.id) : [...playlist.songIds, currentSong.id], lastUsedAt: Date.now() }, true) }
  const toggleSongLoop = async (id: string) => { const song = songs.find((item) => item.id === id); if (!song || song.loopStart === undefined || song.loopEnd === undefined) return; await updateSong({ ...song, loopEnabled: !song.loopEnabled }, true); setOverflowMenu(null) }
  const toggleCurrentLoop = async () => { if (!currentSong || currentSong.loopStart === undefined || currentSong.loopEnd === undefined) return; await updateSong({ ...currentSong, loopEnabled: !currentSong.loopEnabled }, true) }
  const removeCurrentLoop = async () => { if (!currentSong) return; await updateSong({ ...currentSong, loopStart: undefined, loopEnd: undefined, loopConfidence: undefined, loopEnabled: false }, true) }

  const songEditMode = reorderScope === (activePlaylist ? 'playlist' : 'library') && view === 'library'
  const title = view === 'history' ? 'Verlauf' : view === 'loops' ? 'Loops' : activePlaylist?.name ?? 'Bibliothek'
  const sortLabels: Record<SortMode, string> = { manual: 'Manuell', azStart: 'A–Z Anfang', azEnd: 'A–Z Ende', plays: 'Anzahl des Hörens', duration: 'Dauer', chronology: 'Chronik' }
  const loopLeft = editorDuration ? (loopDraftStart / editorDuration) * 100 : 0
  const loopWidth = editorDuration ? Math.max(0, ((loopDraftEnd - loopDraftStart) / editorDuration) * 100) : 0
  const cursorLeft = editorDuration ? (loopCursor / editorDuration) * 100 : 0
  const focusLeft = editorDuration ? (loopFocus / editorDuration) * 100 : 0
  const edgeStepSeconds = parsedEdgeStep()

  return <div className="app-shell">
    <header className="site-header">
      <div className="history-controls" aria-label="Navigation und Verlauf"><button type="button" onClick={navigateBack} disabled={navigationIndex === 0 && !loopEditorSongId}>‹</button><button type="button" onClick={navigateForward} disabled={navigationIndex >= navigation.length - 1 || Boolean(loopEditorSongId)}>›</button><button type="button" onClick={() => void undo()} disabled={!undoStack.length || Boolean(moveCandidate) || Boolean(loopEditorSongId)}>↶</button><button type="button" onClick={() => void redo()} disabled={!redoStack.length || Boolean(moveCandidate) || Boolean(loopEditorSongId)}>↷</button>{moveCandidate && <><button className="confirm-move" type="button" onClick={() => void confirmPendingMove()} disabled={moveCandidate.targetIndex === null}>✓</button><button className="cancel-move" type="button" onClick={() => setMoveCandidate(null)}>×</button></>}</div>
      <button className="import-button" type="button" onClick={openImportPicker}>+ Musik importieren</button><input ref={fileInputRef} className="file-input" type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac" multiple onChange={(event) => void importFiles(event.target.files)} />
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
      <div className="playlist-actions">{!selectionMode && <button type="button" onClick={startSelection}>Auswählen</button>}{selectionMode && <><button type="button" onClick={selectAllVisible}>Alle</button><button type="button" onClick={stopSelection}>Abbrechen</button></>}{activePlaylist && view === 'library' && !selectionMode && <><button type="button" onClick={startEditingPlaylist}>Name ändern</button><button type="button" onClick={() => coverInputRef.current?.click()}>Bild ändern</button><button type="button" onClick={() => reorderScope === 'playlist' ? finishReorder() : beginReorder('playlist')}>{reorderScope === 'playlist' ? 'Fertig' : 'Reihenfolge ändern'}</button><input ref={coverInputRef} className="file-input" type="file" accept="image/*" onChange={(event) => void changePlaylistCover(event.target.files)} /></>}{!activePlaylist && view === 'library' && !selectionMode && <button type="button" onClick={() => reorderScope === 'library' ? finishReorder() : beginReorder('library')}>{reorderScope === 'library' ? 'Fertig' : 'Reihenfolge ändern'}</button>}</div>
    </div>
    <div className="sort-bar"><span>Sortierung</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>{(Object.keys(sortLabels) as SortMode[]).map((mode) => <option key={mode} value={mode}>{sortLabels[mode]}</option>)}</select><button type="button" className="sort-direction" disabled={sortMode === 'manual'} onClick={() => setSortDirection((value) => value === 'down' ? 'up' : 'down')}>{sortMode === 'manual' ? '—' : sortDirection === 'down' ? '↓' : '↑'}</button></div>
    {message && <div className="message">{message}</div>}{selectionMode && <div className="selection-hint">{selectedSongIds.size} ausgewählt. Die Zuordnung erfolgt unten rechts über „Alle Playlists“.</div>}
    {visibleSongs.length ? <div className="song-list">{renderDropZone(0, 'song')}{visibleSongs.map((song, index) => <div key={song.id} className={`song-row${song.isNew ? ' new-import' : ''}${selectedSongIds.has(song.id) ? ' selected-song' : ''}${repeatSelectionIds.has(song.id) ? ' repeat-selected-song' : ''}`}>{songEditMode && <button className="move-selector" type="button" onClick={() => setMoveCandidate({ kind: 'song', id: song.id, targetIndex: null })}>↕</button>}{selectionMode && <button className="selection-check" type="button" onClick={() => toggleSelected(song.id)}>{selectedSongIds.has(song.id) ? '✓' : ''}</button>}<button className="song-main" type="button" onClick={() => playSong(song.id)} disabled={songEditMode}><span className="song-number">{song.id === currentSongId && isPlaying ? '▶' : index + 1}</span><span className="song-copy"><strong>{song.name}</strong><small>{view === 'history' ? formatDate(song.addedAt) : membershipText(song.id)}</small></span><span className="song-meta"><small>{!song.file || song.file.size === 0 ? 'FEHLT' : formatTime(song.duration)}</small>{song.loopStart !== undefined && song.loopEnd !== undefined && <span className="loop-badge">↻</span>}</span></button><button className="overflow-button song-overflow" type="button" onClick={() => setOverflowMenu({ kind: 'song', id: song.id })}>•••</button>{activePlaylist && view === 'library' && !selectionMode && !songEditMode && <button className="remove-song" type="button" onClick={() => void removeSongFromActivePlaylist(song.id)}>Entfernen</button>}{renderDropZone(index + 1, 'song')}</div>)}</div> : <div className="empty-state"><div className="empty-icon">♫</div><h2>{view === 'loops' ? 'Noch keine Loops gespeichert.' : 'Noch keine Musik hier.'}</h2></div>}
    </section></main>}

    {view === 'playlistOverview' && <section className="playlist-overview"><div className="playlist-overview-heading"><p className="eyebrow">DEINE MUSIK</p><h1>Playlists</h1><p>{playlists.length} Playlists</p></div><div className="playlist-grid">{sidebarPlaylists.map((playlist) => <div className="playlist-card-wrap" key={playlist.id}><button className="playlist-card" type="button" onClick={() => void openPlaylist(playlist.id)}><span className="playlist-card-cover">{coverUrls[playlist.id] ? <img src={coverUrls[playlist.id]} alt="" /> : '♫'}</span><strong>{playlist.name}</strong><small>{playlist.songIds.length} {playlist.songIds.length === 1 ? 'Lied' : 'Lieder'}</small></button><button className="overflow-button card-overflow" type="button" onClick={() => setOverflowMenu({ kind: 'playlist', id: playlist.id })}>•••</button></div>)}</div></section>}

    <section className={`player${currentSong ? ' visible' : ''}`}><audio ref={audioRef} src={currentUrl ?? undefined} playsInline onTimeUpdate={(event) => { const audio = event.currentTarget; const song = currentSong; if (loopEditorSongId === song?.id && cursorLoopEnabled && loopDraftEnd > loopDraftStart && audio.currentTime >= loopDraftEnd) audio.currentTime = loopDraftStart; else if (!loopEditorSongId && song?.loopEnabled && song.loopStart !== undefined && song.loopEnd !== undefined && audio.currentTime >= song.loopEnd) audio.currentTime = song.loopStart; setCurrentTime(audio.currentTime); if (loopEditorSongId) setLoopCursor(audio.currentTime) }} onLoadedMetadata={(event) => { const value = event.currentTarget.duration; setDuration(value); if (currentSong && Number.isFinite(value) && (!currentSong.duration || Math.abs(currentSong.duration - value) > .5)) void updateSong({ ...currentSong, duration: value }) }} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onError={() => currentSong && setMessage(`„${currentSong.name}“ kann aus dem lokalen Speicher nicht geladen werden.`)} onEnded={() => { if (currentSong) void updateSong({ ...currentSong, completedPlays: (currentSong.completedPlays ?? 0) + 1 }); moveSong(1) }} />
      <button className="now-playing" type="button" onClick={() => currentSong && navigateTo({ view, playlistId: activePlaylistId, detailOpen: true })} disabled={!currentSong}><span className="cover-placeholder">♫</span><span className="now-playing-copy"><small>JETZT</small><span className="marquee"><strong>{currentSong?.name ?? 'Kein Song ausgewählt'}</strong></span></span></button>
      <div className="transport"><div className="transport-buttons"><button className={shuffle ? 'active-control' : ''} onClick={() => setShuffle((value) => !value)}>⇄</button><button onClick={() => moveSong(-1)}>⏮</button><button className="play-button" onClick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button><button onClick={() => moveSong(1)}>⏭</button><button className={repeatQueue || repeatSelectionIds.size ? 'active-control repeat-control' : 'repeat-control'} onPointerDown={beginRepeatHold} onPointerUp={endRepeatHold} onPointerCancel={endRepeatHold} onContextMenu={(event) => event.preventDefault()} onClick={handleRepeatClick} aria-label={repeatSelectionIds.size ? 'Ausgewählte Lieder wiederholen' : 'Liste wiederholen'}><span className={`repeat-symbol${repeatSelectionIds.size ? ' repeat-one-symbol' : ''}`}>↻{repeatSelectionIds.size > 0 && <b>1</b>}</span></button></div><div className="progress-row"><span>{formatTime(currentTime)}</span><input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(Number(event.target.value))} /><span>{formatTime(duration)}</span></div></div>
      <div className="quick-playlists"><button className="all-playlists-button" type="button" onClick={() => setPlaylistChooserMode(selectionMode ? 'bulk' : 'current')} disabled={selectionMode ? !selectedSongIds.size : !currentSong}><span>Alle Playlists</span><strong>›</strong></button></div>
    </section>

    {detailOpen && currentSong && <section className="song-detail"><div className="detail-topbar"><button type="button" onClick={navigateBack}>‹ Zurück</button></div><div className="detail-content"><p className="detail-label">JETZT</p><h2>{currentSong.name}</h2><div className="playlist-membership"><span>IN PLAYLISTS</span><strong>{currentSongPlaylists.length ? currentSongPlaylists.map((playlist) => playlist.name).join(' · ') : 'In keiner Playlist'}</strong></div><div className="detail-progress"><input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(Number(event.target.value))} /><div><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div></div><div className="detail-controls"><button onClick={playPreviousFromHistory} disabled={!playHistory.length}>⏮</button><button onClick={() => skipSeconds(-10)}>↶<small>10</small></button><button className="detail-play" onClick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button><button onClick={() => skipSeconds(10)}>↷<small>10</small></button><button onClick={() => moveSong(1)}>⏭</button></div><div className="loop-panel"><div><span className="loop-panel-label">LOOP</span><h3>{currentSong.loopStart !== undefined && currentSong.loopEnd !== undefined ? `${formatTime(currentSong.loopStart)} – ${formatTime(currentSong.loopEnd)}` : 'Noch kein Loop'}</h3><p>Den Bereich legst du präzise im Loop-Editor fest.</p></div><div className="loop-actions"><button type="button" onClick={() => openLoopEditor(currentSong.id)}>{currentSong.loopStart !== undefined ? 'Loop bearbeiten' : 'Loop erstellen'}</button>{currentSong.loopStart !== undefined && currentSong.loopEnd !== undefined && <><button className={currentSong.loopEnabled ? 'loop-active' : ''} type="button" onClick={() => void toggleCurrentLoop()}>{currentSong.loopEnabled ? 'Loop aktiv' : 'Loop aktivieren'}</button><button className="danger-button" type="button" onClick={() => void removeCurrentLoop()}>Loop entfernen</button></>}</div></div></div></section>}

    {loopEditorSongId && editorSong && <section className="loop-editor" aria-label="Loop bearbeiten"><div className="loop-editor-inner"><div className="loop-editor-top"><button type="button" onClick={() => setLoopEditorSongId(null)}>‹ Zurück</button><h1>{editorSong.name}</h1></div><p className="loop-editor-copy">Der rote Bereich ist der Loop. Den blauen Abspielcursor verschiebst du nur noch über seinen blauen Punkt. Der grüne Fokus unter der Zeitleiste bestimmt, welcher Bereich beim Zoomen in der Mitte bleibt.</p>
      <div className="loop-toolbar"><label>Zoom <input type="range" min="1" max="16" step="1" value={loopZoom} onChange={(event) => setLoopZoom(Number(event.target.value))} /><strong>{loopZoom}×</strong></label><button className={loopSelectionLocked ? 'toggle-on' : ''} type="button" onClick={() => setLoopSelectionLocked((value) => !value)}>Loop-Kasten {loopSelectionLocked ? 'gesperrt' : 'beweglich'}</button><button className={markersEnabled ? 'toggle-on marker-toggle' : ''} type="button" onClick={() => setMarkersEnabled((value) => !value)}>Markierungen {markersEnabled ? 'an' : 'aus'}</button><button className={cursorLoopEnabled ? 'toggle-on cursor-loop-toggle' : ''} type="button" onClick={() => setCursorLoopEnabled((value) => !value)}>Cursor-Loop {cursorLoopEnabled ? 'an' : 'aus'}</button><button className={focusFollowsCursor ? 'toggle-on focus-toggle' : ''} type="button" onClick={() => { const next = !focusFollowsCursor; setFocusFollowsCursor(next); if (next) setLoopFocus(loopCursor) }}>Fokus folgt Cursor {focusFollowsCursor ? 'an' : 'aus'}</button></div>
      <div className="loop-timeline-wrap"><div className="waveform-status">{waveformStatus === 'loading' ? 'Wellenform wird berechnet…' : waveformStatus === 'unavailable' ? 'Wellenform für diese Datei nicht verfügbar – Wiedergabe bleibt unverändert.' : 'Wellenform: Amplitude über Zeit'}</div><div ref={loopTimelineScrollRef} className="loop-timeline-scroll"><div ref={loopTimelineRef} className="loop-timeline precision" style={{ width: `${loopZoom * 100}%` }} onPointerMove={moveLoopDrag} onPointerUp={endLoopDrag} onPointerCancel={endLoopDrag}>
        {waveform.length > 0 && <div className="loop-waveform" aria-hidden="true">{waveform.map((height, index) => <i key={index} style={{ height: `${Math.max(4, height * 92)}%` }} />)}</div>}
        {markersEnabled && loopMarkers.map((marker, index) => <button key={`${marker}-${index}`} className="loop-marker" type="button" style={{ left: `${editorDuration ? marker / editorDuration * 100 : 0}%` }} title={formatPrecise(marker)} onPointerDown={(event) => event.stopPropagation()} onClick={() => moveCursorTo(marker)}><span /></button>)}
        <div className={`loop-selection${loopSelectionLocked ? ' locked' : ''}`} style={{ left: `${loopLeft}%`, width: `${loopWidth}%` }} onPointerDown={(event) => beginLoopDrag(event, 'move')}><button className={`loop-handle start${activeLoopEdge === 'start' ? ' active-edge' : ''}`} type="button" aria-label="Loop-Start verschieben" onPointerDown={(event) => beginLoopDrag(event, 'start')} /><span className="loop-window-label">LOOP</span><button className={`loop-handle end${activeLoopEdge === 'end' ? ' active-edge' : ''}`} type="button" aria-label="Loop-Ende verschieben" onPointerDown={(event) => beginLoopDrag(event, 'end')} /></div>
        <button className="loop-cursor" type="button" style={{ left: `${cursorLeft}%` }} aria-label="Abspielposition verschieben"><span onPointerDown={(event) => beginLoopDrag(event, 'cursor')} /></button>
      </div><div ref={loopFocusRef} className={`loop-focus-track${focusFollowsCursor ? ' follows-cursor' : ''}`} style={{ width: `${loopZoom * 100}%` }} onPointerDown={(event) => beginLoopDrag(event, 'focus')} onPointerMove={moveLoopDrag} onPointerUp={endLoopDrag} onPointerCancel={endLoopDrag}><span className="focus-line-label">ZOOM-FOKUS</span><button type="button" className="loop-focus-cursor" style={{ left: `${focusLeft}%` }} aria-label="Zoom-Fokus verschieben" onPointerDown={(event) => beginLoopDrag(event, 'focus')}><span /></button></div></div><div className="loop-time-labels"><span>0:00</span><span>{formatTime(editorDuration)}</span></div>
      <div className="loop-editor-range"><div><span>Start</span><strong>{formatPrecise(loopDraftStart)}</strong></div><div><span>Cursor</span><strong className="cursor-time">{formatPrecise(loopCursor)}</strong></div><div><span>Fokus</span><strong className="focus-time">{formatPrecise(loopFocus)}</strong></div><div><span>Ende</span><strong>{formatPrecise(loopDraftEnd)}</strong></div></div>
      <div className="loop-transport"><button type="button" onClick={() => moveCursorTo(loopCursor - 5)}>−5 s</button><button className="play-loop" type="button" onClick={togglePlayback}>{isPlaying ? '❚❚ Pause' : '▶ Start'}</button><button type="button" onClick={() => moveCursorTo(loopCursor + 5)}>+5 s</button></div>
      <div className="loop-speed-box"><div className="loop-speed-heading"><span>CURSOR-GESCHWINDIGKEIT</span><strong>{Math.round(loopPlaybackRate * 100)}%</strong></div><div className="loop-speed-options">{LOOP_PLAYBACK_RATES.map((rate) => <button key={rate} className={loopPlaybackRate === rate ? 'active-speed' : ''} type="button" onClick={() => setLoopPlaybackRate(rate)}>{Math.round(rate * 100)}%</button>)}</div><small>100% ist Normalgeschwindigkeit. Die Wiedergabe läuft mit 1 × gewähltem Prozentwert.</small></div>
      <div className="marker-controls"><button type="button" onClick={setMarker} disabled={!markersEnabled}>Markierung setzen</button><span>{loopMarkers.length} Markierungen</span>{loopMarkers.length > 0 && <button type="button" onClick={() => setLoopMarkers((items) => items.slice(0, -1))} disabled={!markersEnabled}>Letzte entfernen</button>}</div>
      <div className="precision-controls"><div className="precision-block"><span>Zuletzt berührte rote Kante: <strong>{activeLoopEdge === 'start' ? 'Start' : 'Ende'}</strong></span><label className="step-input"><span>Sprungweite</span><input aria-label="Sprungweite der roten Kante in Sekunden" value={edgeStep} onChange={(event) => setEdgeStep(event.target.value)} inputMode="decimal" /><b>s</b></label><div><button type="button" onClick={() => nudgeActiveEdge(-edgeStepSeconds)} disabled={loopSelectionLocked}>− Schritt</button><button type="button" onClick={() => nudgeActiveEdge(edgeStepSeconds)} disabled={loopSelectionLocked}>+ Schritt</button></div><small>Beispiele: 0,01 = 10 ms · 0,1 = 100 ms · 1 = 1 Sekunde</small></div><div className="preview-block"><span>Vor einer Kante abspielen</span><div className="preview-row"><button type="button" onClick={() => previewBoundary('start')}>▶ vor Start</button><input aria-label="Sekunden vor Start oder Ende" value={previewLead} onChange={(event) => setPreviewLead(event.target.value)} inputMode="decimal" /><b>s</b></div><div className="preview-row"><button type="button" onClick={() => previewBoundary('end')}>▶ vor Ende</button><input value={previewLead} onChange={(event) => setPreviewLead(event.target.value)} inputMode="decimal" /><b>s</b></div></div></div>
      <div className="loop-editor-actions"><button className="save-loop" type="button" onClick={() => void saveLoopDraft()} disabled={!editorDuration || loopDraftEnd <= loopDraftStart}>Loop speichern</button><button type="button" onClick={() => setLoopEditorSongId(null)}>Abbrechen</button></div></div></div></section>}

    {playlistChooserMode && <div className="playlist-chooser-backdrop" onMouseDown={() => setPlaylistChooserMode(null)}><section className="playlist-chooser" onMouseDown={(event) => event.stopPropagation()}><div className="playlist-chooser-heading"><div><p className="eyebrow">PLAYLISTS</p><h2>{playlistChooserMode === 'bulk' ? `${selectedSongIds.size} Lieder zuordnen` : 'Alle Playlists'}</h2></div><button type="button" onClick={() => setPlaylistChooserMode(null)}>×</button></div><div className="playlist-groups">{groupedPlaylists.map(([group, items]) => <div className="playlist-group" key={group}><strong>{group}</strong><div>{items.map((playlist) => { const contains = currentSong ? playlist.songIds.includes(currentSong.id) : false; return <button key={playlist.id} type="button" onClick={() => playlistChooserMode === 'bulk' ? void assignSelectedToPlaylist(playlist) : void toggleCurrentInPlaylist(playlist)}><span>{playlist.name}</span>{playlistChooserMode === 'current' && <b>{contains ? '−' : '+'}</b>}</button> })}</div></div>)}</div></section></div>}

    {overflowMenu && <><button className="menu-shield" type="button" onClick={() => setOverflowMenu(null)} /><div className="overflow-menu">{overflowMenu.kind === 'playlists' && <><button type="button" onClick={() => beginReorder('sidebar')}>Bearbeiten</button><button type="button" onClick={() => { setOverflowMenu(null); navigateTo({ view: 'playlistOverview', playlistId: activePlaylistId, detailOpen: false }) }}>Übersicht</button></>}{overflowMenu.kind === 'song' && overflowMenu.id && (() => { const song = songs.find((item) => item.id === overflowMenu.id); if (!song) return null; return <><button type="button" onClick={() => beginRename('song', song.id)}>Umbenennen</button><button type="button" onClick={() => void copySong(song.id)}>Kopieren</button><button type="button" onClick={() => void shareSong(song.id)}>Teilen</button><button type="button" onClick={() => openLoopEditor(song.id)}>{song.loopStart !== undefined ? 'Loop bearbeiten' : 'Loop erstellen'}</button>{song.loopStart !== undefined && song.loopEnd !== undefined && <button type="button" onClick={() => void toggleSongLoop(song.id)}>{song.loopEnabled ? 'Loop deaktivieren' : 'Loop aktivieren'}</button>}{song.isNew && <><button className="blue-menu-action" type="button" onClick={() => void markSeen(song.id)}>Als gelesen markieren</button><button className="blue-menu-action" type="button" onClick={() => void markSeen()}>Alle als gelesen markieren</button></>}<button className="danger-menu-action" type="button" onClick={() => { setSongToDelete(song); setOverflowMenu(null) }}>Löschen</button></> })()}{overflowMenu.kind === 'playlist' && overflowMenu.id && (() => { const playlist = playlists.find((item) => item.id === overflowMenu.id); if (!playlist) return null; return <><button type="button" onClick={() => beginRename('playlist', playlist.id)}>Umbenennen</button><button type="button" onClick={() => void copyPlaylist(playlist.id)}>Kopieren</button><button type="button" onClick={() => void sharePlaylist(playlist.id)}>Teilen</button><button className="danger-menu-action" type="button" onClick={() => { setPlaylistToDelete(playlist); setOverflowMenu(null) }}>Löschen</button></> })()}</div></>}

    {renameTarget && <div className="modal-backdrop" onMouseDown={() => setRenameTarget(null)}><form className="confirm-dialog rename-dialog" onSubmit={confirmRename} onMouseDown={(event) => event.stopPropagation()}><h2>Umbenennen</h2><input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} autoFocus /><div className="dialog-actions"><button type="button" onClick={() => setRenameTarget(null)}>Abbrechen</button><button type="submit" disabled={!renameValue.trim()}>Speichern</button></div></form></div>}
    {songToDelete && <div className="modal-backdrop" onMouseDown={() => setSongToDelete(null)}><div className="confirm-dialog" onMouseDown={(event) => event.stopPropagation()}><h2>Lied löschen?</h2><p>„{songToDelete.name}“ und seine lokal gespeicherte Audiodatei werden gelöscht. Der Song wird außerdem aus allen Playlists entfernt.</p><div className="dialog-actions"><button type="button" onClick={() => setSongToDelete(null)}>Abbrechen</button><button className="danger-button" type="button" onClick={() => void confirmDeleteSong()}>Lied löschen</button></div></div></div>}
    {playlistToDelete && <div className="modal-backdrop" onMouseDown={() => setPlaylistToDelete(null)}><div className="confirm-dialog" onMouseDown={(event) => event.stopPropagation()}><h2>Playlist löschen?</h2><p>„{playlistToDelete.name}“ wird gelöscht. Die Musikdateien bleiben erhalten.</p><div className="dialog-actions"><button type="button" onClick={() => setPlaylistToDelete(null)}>Abbrechen</button><button className="danger-button" type="button" onClick={() => void confirmDeletePlaylist()}>Playlist löschen</button></div></div></div>}
  </div>
}

export default App
