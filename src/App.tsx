import { useEffect, useMemo, useRef, useState } from 'react'
import {
  deletePlaylist,
  deleteSong,
  deleteTag,
  getPlaylists,
  getSongs,
  getTags,
  getTrashedPlaylists,
  getTrashedSongs,
  getTrashedTags,
  savePlaylist,
  saveSong,
  saveSongOrder,
  saveSongs,
  saveTag,
  type Playlist,
  type Song,
  type Tag,
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

type View = 'library' | 'history' | 'loops' | 'trash' | 'tag' | 'playlistOverview'
type NavigationEntry = { view: View; playlistId: string | null; tagId?: string | null; detailOpen: boolean }
type ReorderScope = 'library' | 'playlist' | 'sidebar' | 'tags' | null
type MoveCandidate = { kind: 'song' | 'playlist' | 'tag'; id: string; targetIndex: number | null } | null
type Snapshot = { songs: Song[]; playlists: Playlist[]; tags: Tag[] }
type PlaylistChooserMode = 'current' | 'bulk' | null
type SortMode = 'manual' | 'azStart' | 'azEnd' | 'plays' | 'duration' | 'chronology'
type SortDirection = 'down' | 'up'
type OverflowMenu = { kind: 'song' | 'playlist' | 'playlists' | 'tag' | 'tags'; id?: string } | null
type ClipboardItem = { kind: 'song'; song: Song } | { kind: 'playlist'; playlist: Playlist }
type TagChooserTarget = { kind: 'song' | 'playlist'; ids: string[] } | null
type DuplicateAction =
  | { kind: 'tag-add'; tagId: string; targetKind: 'song' | 'playlist'; ids: string[] }
  | { kind: 'paste-song'; source: Song; targetPlaylistId: string | null }
  | { kind: 'paste-playlist'; source: Playlist }
type DuplicateConflict = { action: DuplicateAction; names: string[] } | null
type LoopDrag = { kind: 'move' | 'start' | 'end' | 'cursor' | 'focus'; offset: number } | null
type FocusFollowMode = 'center' | 'page' | 'off'
type LoopEditorSnapshot = { start: number; end: number; cursor: number; focus: number; markers: number[]; zoom: number }
type LoopConfirmation = 'save' | 'delete' | 'deleteMarkers' | null
type SelectionConfirmation = 'switchManual' | 'deleteSelected' | null
type RenameTarget = { kind: 'song' | 'playlist' | 'tag'; id: string } | null
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

const LOOP_ZOOM_LEVELS = Array.from({ length: 15 }, (_, index) => index + 1)
const LOOP_PLAYBACK_RATES = [0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 5, 10, 50] as const
const LOOP_STEP_OPTIONS = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10] as const
const CURSOR_STEP_OPTIONS = [...LOOP_STEP_OPTIONS, 30, 60] as const
const LOOP_PREVIEW_OPTIONS = [0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5, 10] as const
const SEEK_SECOND_OPTIONS = [5, 10, 15, 30, 60] as const
const LOOP_OVERLAP_SECONDS = .18
const AUTO_LOOP_SEARCH_RADIUS_SECONDS = .6
const TAG_COLORS = ['#60a5fa', '#f472b6', '#f59e0b', '#34d399', '#a78bfa', '#fb7185', '#22d3ee', '#facc15'] as const

function App() {
  const [songs, setSongs] = useState<Song[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [trashedSongs, setTrashedSongs] = useState<Song[]>([])
  const [trashedPlaylists, setTrashedPlaylists] = useState<Playlist[]>([])
  const [trashedTags, setTrashedTags] = useState<Tag[]>([])
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null)
  const [activeTagId, setActiveTagId] = useState<string | null>(null)
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
  const [tagName, setTagName] = useState('')
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [seekSeconds, setSeekSeconds] = useState(() => Number(localStorage.getItem('josi-seek-seconds')) || 10)
  const [searchQuery, setSearchQuery] = useState('')
  const [playlistCoverTargetId, setPlaylistCoverTargetId] = useState<string | null>(null)
  const [selectionMenuOpen, setSelectionMenuOpen] = useState(false)
  const [bulkMoveMode, setBulkMoveMode] = useState(false)
  const [selectionConfirmation, setSelectionConfirmation] = useState<SelectionConfirmation>(null)
  const [trashConfirmation, setTrashConfirmation] = useState(false)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [sortConfirmation, setSortConfirmation] = useState(false)
  const [tagSortMode, setTagSortMode] = useState<SortMode>(() => (localStorage.getItem('josi-tag-sort-mode') as SortMode) || 'manual')
  const [tagSortDirection, setTagSortDirection] = useState<SortDirection>(() => (localStorage.getItem('josi-tag-sort-direction') as SortDirection) || 'down')
  const [playlistsCollapsed, setPlaylistsCollapsed] = useState(() => localStorage.getItem('josi-playlists-collapsed') === '1')
  const [tagsCollapsed, setTagsCollapsed] = useState(() => localStorage.getItem('josi-tags-collapsed') === '1')
  const [tagChooserTarget, setTagChooserTarget] = useState<TagChooserTarget>(null)
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null)
  const [duplicateConflict, setDuplicateConflict] = useState<DuplicateConflict>(null)
  const [cancelledDuplicateAction, setCancelledDuplicateAction] = useState<DuplicateAction | null>(null)
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null)

  const [loopEditorSongId, setLoopEditorSongId] = useState<string | null>(null)
  const [loopDraftStart, setLoopDraftStart] = useState(0)
  const [loopDraftEnd, setLoopDraftEnd] = useState(0)
  const [loopCursor, setLoopCursor] = useState(0)
  const [loopFocus, setLoopFocus] = useState(0)
  const [loopZoom, setLoopZoom] = useState(1)
  const [loopSelectionLocked, setLoopSelectionLocked] = useState(false)
  const [markersEnabled, setMarkersEnabled] = useState(true)
  const [cursorLoopEnabled, setCursorLoopEnabled] = useState(true)
  const [focusFollowMode, setFocusFollowMode] = useState<FocusFollowMode>('center')
  const [loopMarkers, setLoopMarkers] = useState<number[]>([])
  const [activeMarkerIndex, setActiveMarkerIndex] = useState<number | null>(null)
  const [activeLoopEdge, setActiveLoopEdge] = useState<'start' | 'end'>('start')
  const [previewLeadStart, setPreviewLeadStart] = useState('1')
  const [previewLeadEnd, setPreviewLeadEnd] = useState('1')
  const [edgeStep, setEdgeStep] = useState('0.01')
  const [focusStep, setFocusStep] = useState('1')
  const [cursorStep, setCursorStep] = useState('5')
  const [markerStep, setMarkerStep] = useState('1')
  const [waveform, setWaveform] = useState<number[]>([])
  const [waveformStatus, setWaveformStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle')
  const [loopPlaybackRate, setLoopPlaybackRate] = useState('1')
  const [loopEditorMenuOpen, setLoopEditorMenuOpen] = useState(false)
  const [loopUndoStack, setLoopUndoStack] = useState<LoopEditorSnapshot[]>([])
  const [loopRedoStack, setLoopRedoStack] = useState<LoopEditorSnapshot[]>([])
  const [loopConfirmation, setLoopConfirmation] = useState<LoopConfirmation>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const overlapAudioRef = useRef<HTMLAudioElement>(null)
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null)
  const loopTransitionRef = useRef<{ outgoing: HTMLAudioElement; incoming: HTMLAudioElement; startedAt: number; duration: number } | null>(null)
  const loopStartPendingRef = useRef(false)
  const loopOverlapBlockedRef = useRef(false)
  const automaticLoopSeamsRef = useRef(new Map<string, { start: number; end: number }>())
  const automaticLoopSearchRef = useRef(new Set<string>())
  const shouldAutoPlayRef = useRef(false)
  const loopTimelineRef = useRef<HTMLDivElement>(null)
  const loopFocusRef = useRef<HTMLDivElement>(null)
  const loopTimelineScrollRef = useRef<HTMLDivElement>(null)
  const loopDragRef = useRef<LoopDrag>(null)
  const repeatHoldTimerRef = useRef<number | null>(null)
  const repeatHoldTriggeredRef = useRef(false)

  const currentPlaybackAudio = () => playbackAudioRef.current ?? audioRef.current
  const otherPlaybackAudio = (audio: HTMLAudioElement) => audio === audioRef.current ? overlapAudioRef.current : audioRef.current
  const updatePlayingState = () => setIsPlaying(Boolean((audioRef.current && !audioRef.current.paused) || (overlapAudioRef.current && !overlapAudioRef.current.paused)))
  const cancelLoopTransition = () => {
    const transition = loopTransitionRef.current
    if (transition) {
      transition.incoming.pause()
      try { transition.outgoing.volume = 1; transition.incoming.volume = 1 } catch { /* iPadOS may ignore element volume */ }
    }
    loopTransitionRef.current = null
    loopStartPendingRef.current = false
    const active = currentPlaybackAudio()
    const other = active ? otherPlaybackAudio(active) : null
    if (other && other !== active) other.pause()
  }
  const ensurePrimaryPlayback = () => {
    const primary = audioRef.current
    if (!primary) return
    const active = currentPlaybackAudio()
    const wasPlaying = Boolean(active && !active.paused)
    const time = active?.currentTime ?? currentTime
    cancelLoopTransition()
    if (active && active !== primary) active.pause()
    primary.currentTime = Number.isFinite(time) ? time : 0
    playbackAudioRef.current = primary
    if (wasPlaying) void primary.play().catch(() => setIsPlaying(false))
  }
  const prepareAutomaticLoopSeam = async (song: Song) => {
    if (automaticLoopSeamsRef.current.has(song.id) || automaticLoopSearchRef.current.has(song.id)) return
    if (song.loopStart === undefined || song.loopEnd === undefined || !song.file?.size) return
    automaticLoopSearchRef.current.add(song.id)
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) { automaticLoopSearchRef.current.delete(song.id); setMessage('Die Loop-Überlappung ist auf diesem Gerät nicht verfügbar; auch die automatische Verbindungssuche wird nicht unterstützt.'); return }
    const context = new AudioContextClass()
    try {
      const buffer = await context.decodeAudioData((await song.file.arrayBuffer()).slice(0))
      const channel = buffer.getChannelData(0)
      const sampleRate = buffer.sampleRate
      const durationSeconds = buffer.duration
      const sample = (time: number) => channel[Math.max(0, Math.min(channel.length - 1, Math.round(time * sampleRate)))]
      let best = { start: song.loopStart, end: song.loopEnd, score: Number.POSITIVE_INFINITY }
      for (let startOffset = -AUTO_LOOP_SEARCH_RADIUS_SECONDS; startOffset <= AUTO_LOOP_SEARCH_RADIUS_SECONDS + .0001; startOffset += .03) {
        const start = Math.max(0, Math.min(durationSeconds - .1, song.loopStart + startOffset))
        for (let endOffset = -AUTO_LOOP_SEARCH_RADIUS_SECONDS; endOffset <= AUTO_LOOP_SEARCH_RADIUS_SECONDS + .0001; endOffset += .03) {
          const end = Math.max(start + .1, Math.min(durationSeconds, song.loopEnd + endOffset))
          if (end <= start + .1) continue
          let score = 0
          for (let index = 0; index < 36; index += 1) {
            const ratio = index / 35
            const outgoing = sample(Math.max(0, end - .03 + ratio * .03))
            const incoming = sample(Math.min(durationSeconds, start + ratio * .03))
            const difference = outgoing - incoming
            score += difference * difference
          }
          score += Math.abs(sample(end) - sample(start)) * 4
          score += (Math.abs(startOffset) + Math.abs(endOffset)) * .002
          if (score < best.score) best = { start, end, score }
        }
      }
      automaticLoopSeamsRef.current.set(song.id, { start: best.start, end: best.end })
      setMessage('Die doppelte Loop-Wiedergabe konnte nicht gestartet werden. Josi verwendet deshalb automatisch einen lokal gesuchten Verbindungspunkt.')
    } catch {
      setMessage('Die doppelte Loop-Wiedergabe konnte nicht gestartet werden. Die automatische Verbindungssuche ist für diese Datei ebenfalls fehlgeschlagen.')
    } finally { automaticLoopSearchRef.current.delete(song.id); void context.close() }
  }

  useEffect(() => {
    Promise.all([getSongs(), getPlaylists(), getTags(), getTrashedSongs(), getTrashedPlaylists(), getTrashedTags()]).then(([storedSongs, storedPlaylists, storedTags, storedTrashedSongs, storedTrashedPlaylists, storedTrashedTags]) => {
      setSongs(storedSongs)
      setPlaylists(storedPlaylists)
      setTags(storedTags)
      setTrashedSongs(storedTrashedSongs)
      setTrashedPlaylists(storedTrashedPlaylists)
      setTrashedTags(storedTrashedTags)
      if (storedSongs.some((song) => !song.file || song.file.size === 0)) setMessage('Mindestens eine lokal gespeicherte Audiodatei ist nicht mehr verfügbar. Diese Lieder müssen neu importiert werden.')
    }).catch(() => setMessage('Lokale Musikdaten konnten nicht geladen werden.'))
  }, [])

  useEffect(() => { localStorage.setItem('josi-sort-mode', sortMode) }, [sortMode])
  useEffect(() => { localStorage.setItem('josi-sort-direction', sortDirection) }, [sortDirection])
  useEffect(() => { localStorage.setItem('josi-seek-seconds', String(seekSeconds)) }, [seekSeconds])
  useEffect(() => { localStorage.setItem('josi-tag-sort-mode', tagSortMode) }, [tagSortMode])
  useEffect(() => { localStorage.setItem('josi-tag-sort-direction', tagSortDirection) }, [tagSortDirection])
  useEffect(() => { localStorage.setItem('josi-playlists-collapsed', playlistsCollapsed ? '1' : '0') }, [playlistsCollapsed])
  useEffect(() => { localStorage.setItem('josi-tags-collapsed', tagsCollapsed ? '1' : '0') }, [tagsCollapsed])

  const currentSong = songs.find((song) => song.id === currentSongId) ?? null
  const activePlaylist = playlists.find((playlist) => playlist.id === activePlaylistId) ?? null
  const activeTag = tags.find((tag) => tag.id === activeTagId) ?? null
  const editorSong = songs.find((song) => song.id === loopEditorSongId) ?? null
  const editorDuration = loopEditorSongId && loopEditorSongId === currentSongId ? (duration || editorSong?.duration || 0) : (editorSong?.duration || 0)
  const parsedLoopPlaybackRate = Math.max(.05, Math.min(50, Number.parseFloat(loopPlaybackRate.replace(',', '.')) || 1))

  const sidebarPlaylists = useMemo(() => [...playlists].sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) || b.lastUsedAt - a.lastUsedAt), [playlists])
  const sidebarTags = useMemo(() => {
    const items = [...tags]
    if (tagSortMode === 'manual') return items.sort((a, b) => (a.sortOrder ?? a.createdAt) - (b.sortOrder ?? b.createdAt))
    const direction = tagSortDirection === 'down' ? 1 : -1
    const playsFor = (tag: Tag) => tag.songIds.reduce((sum, id) => sum + (songs.find((song) => song.id === id)?.completedPlays ?? 0), 0)
    const activeSongCount = (tag: Tag) => tag.songIds.filter((id) => songs.some((song) => song.id === id)).length
    const compare = (a: Tag, b: Tag) => {
      if (tagSortMode === 'azStart') return a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' })
      if (tagSortMode === 'azEnd') return reverseText(a.name).localeCompare(reverseText(b.name), 'de', { numeric: true, sensitivity: 'base' })
      if (tagSortMode === 'plays') return playsFor(a) - playsFor(b) || a.name.localeCompare(b.name, 'de')
      if (tagSortMode === 'duration') return activeSongCount(a) - activeSongCount(b) || a.name.localeCompare(b.name, 'de')
      return a.createdAt - b.createdAt
    }
    return items.sort((a, b) => compare(a, b) * direction)
  }, [tags, songs, tagSortMode, tagSortDirection])
  const manualQueue = useMemo(() => {
    if (!activePlaylist) return [...songs].sort((a, b) => (a.libraryOrder ?? a.addedAt) - (b.libraryOrder ?? b.addedAt))
    const byId = new Map(songs.map((song) => [song.id, song]))
    return activePlaylist.songIds.map((id) => byId.get(id)).filter((song): song is Song => Boolean(song))
  }, [activePlaylist, songs])

  const tagSongQueue = useMemo(() => {
    if (!activeTag) return []
    const byId = new Map(songs.map((song) => [song.id, song]))
    return activeTag.songIds.map((id) => byId.get(id)).filter((song): song is Song => Boolean(song))
  }, [activeTag, songs])

  const baseVisibleSongs = useMemo(() => {
    if (view === 'history') return [...songs]
    if (view === 'loops') return songs.filter((song) => song.loopStart !== undefined && song.loopEnd !== undefined)
    if (view === 'tag') return tagSongQueue
    return manualQueue
  }, [view, songs, manualQueue, tagSongQueue])

  const searchedVisibleSongs = useMemo(() => {
    if (view !== 'library' || !searchQuery.trim()) return baseVisibleSongs
    const needle = searchQuery.trim().toLocaleLowerCase('de-DE')
    return baseVisibleSongs.filter((song) => song.name.toLocaleLowerCase('de-DE').includes(needle))
  }, [baseVisibleSongs, searchQuery, view])

  const visibleSongs = useMemo(() => {
    const items = [...searchedVisibleSongs]
    const direction = sortDirection === 'down' ? 1 : -1
    const compare = (a: Song, b: Song) => {
      if (sortMode === 'azStart') return a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' })
      if (sortMode === 'azEnd') return reverseText(a.name).localeCompare(reverseText(b.name), 'de', { numeric: true, sensitivity: 'base' })
      if (sortMode === 'plays') return (a.completedPlays ?? 0) - (b.completedPlays ?? 0) || a.name.localeCompare(b.name, 'de')
      if (sortMode === 'duration') return (a.duration ?? Number.MAX_SAFE_INTEGER) - (b.duration ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'de')
      return a.addedAt - b.addedAt
    }
    const ordered = sortMode === 'manual' ? items : items.sort((a, b) => compare(a, b) * direction)
    const fresh = ordered.filter((song) => song.isNew)
    const normal = ordered.filter((song) => !song.isNew)
    return [...fresh, ...normal]
  }, [searchedVisibleSongs, sortMode, sortDirection])

  const playerQueue = view === 'tag' && activeTag ? tagSongQueue : activePlaylist ? manualQueue : [...songs].sort((a, b) => (a.libraryOrder ?? a.addedAt) - (b.libraryOrder ?? b.addedAt))
  const repeatSelectionQueue = repeatSelectionIds.size ? playerQueue.filter((song) => repeatSelectionIds.has(song.id)) : []
  const currentSongPlaylists = useMemo(() => currentSong ? playlists.filter((playlist) => playlist.songIds.includes(currentSong.id)) : [], [currentSong, playlists])
  const currentSongTags = useMemo(() => currentSong ? tags.filter((tag) => tag.songIds.includes(currentSong.id)) : [], [currentSong, tags])
  const taggedPlaylists = useMemo(() => activeTag ? activeTag.playlistIds.map((id) => playlists.find((playlist) => playlist.id === id)).filter((playlist): playlist is Playlist => Boolean(playlist)) : [], [activeTag, playlists])
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
    const primary = audioRef.current
    const secondary = overlapAudioRef.current
    if (!primary || !currentUrl) return
    cancelLoopTransition()
    playbackAudioRef.current = primary
    loopOverlapBlockedRef.current = false
    try { primary.volume = 1; if (secondary) secondary.volume = 1 } catch { /* ignored */ }
    primary.load(); secondary?.load()
    if (shouldAutoPlayRef.current) void primary.play().catch(() => setIsPlaying(false))
  }, [currentUrl])

  useEffect(() => {
    const rate = loopEditorSongId ? parsedLoopPlaybackRate : 1
    if (audioRef.current) audioRef.current.playbackRate = rate
    if (overlapAudioRef.current) overlapAudioRef.current.playbackRate = rate
  }, [loopEditorSongId, parsedLoopPlaybackRate, currentUrl])

  useEffect(() => {
    if (!isPlaying) return
    let frame = 0
    const tick = () => {
      const song = currentSong
      const audio = currentPlaybackAudio()
      if (audio && song && !audio.paused) {
        if (loopEditorSongId === song.id && cursorLoopEnabled && loopDraftEnd > loopDraftStart && audio.currentTime >= loopDraftEnd) {
          audio.currentTime = loopDraftStart; setCurrentTime(loopDraftStart); setLoopCursor(loopDraftStart)
        } else if (!loopEditorSongId && song.loopEnabled && song.loopStart !== undefined && song.loopEnd !== undefined) {
          const automatic = loopOverlapBlockedRef.current ? automaticLoopSeamsRef.current.get(song.id) : undefined
          const start = automatic?.start ?? song.loopStart
          const end = automatic?.end ?? song.loopEnd
          if (loopOverlapBlockedRef.current) {
            if (audio.currentTime >= end) { audio.currentTime = start; setCurrentTime(start) }
          } else {
            const transition = loopTransitionRef.current
            if (transition) {
              const progress = Math.min(1, (performance.now() - transition.startedAt) / Math.max(1, transition.duration * 1000))
              try { transition.outgoing.volume = 1 - progress; transition.incoming.volume = progress } catch { /* iPadOS may ignore element volume */ }
              if (progress >= 1) {
                transition.outgoing.pause(); transition.outgoing.currentTime = start
                try { transition.outgoing.volume = 1; transition.incoming.volume = 1 } catch { /* ignored */ }
                playbackAudioRef.current = transition.incoming; loopTransitionRef.current = null; setCurrentTime(transition.incoming.currentTime)
              }
            } else {
              const overlap = Math.min(LOOP_OVERLAP_SECONDS, Math.max(.04, (end - start) / 3))
              if (!loopStartPendingRef.current && audio.currentTime >= end - overlap) {
                const incoming = otherPlaybackAudio(audio)
                if (!incoming) { loopOverlapBlockedRef.current = true; void prepareAutomaticLoopSeam(song) }
                else {
                  loopStartPendingRef.current = true; incoming.pause(); incoming.currentTime = start; incoming.playbackRate = 1
                  try { incoming.volume = 0 } catch { /* ignored */ }
                  void incoming.play().then(() => {
                    loopStartPendingRef.current = false
                    if (audio.paused) { incoming.pause(); try { incoming.volume = 1 } catch { /* ignored */ }; return }
                    loopTransitionRef.current = { outgoing: audio, incoming, startedAt: performance.now(), duration: overlap }
                  }).catch(() => {
                    loopStartPendingRef.current = false; incoming.pause()
                    try { audio.volume = 1; incoming.volume = 1 } catch { /* ignored */ }
                    loopOverlapBlockedRef.current = true
                    if (audio.currentTime >= end) { audio.currentTime = start; setCurrentTime(start) }
                    void prepareAutomaticLoopSeam(song)
                  })
                }
              }
            }
          }
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying, currentSong?.id, currentSong?.loopEnabled, currentSong?.loopStart, currentSong?.loopEnd, loopEditorSongId, cursorLoopEnabled, loopDraftStart, loopDraftEnd])

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
    const initialMarkers = (editorSong.loopMarkers ?? []).filter((value) => value >= 0 && value <= editorDuration)
    setLoopMarkers(initialMarkers)
    setActiveMarkerIndex(initialMarkers.length ? 0 : null)
    setLoopZoom(1)
    setLoopSelectionLocked(false)
    setMarkersEnabled(true)
    setCursorLoopEnabled(true)
    setFocusFollowMode('center')
    setLoopPlaybackRate('1')
    setPreviewLeadStart('1')
    setPreviewLeadEnd('1')
    setLoopEditorMenuOpen(false)
    setLoopUndoStack([])
    setLoopRedoStack([])
    setLoopConfirmation(null)
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
    if (!loopEditorSongId || !editorDuration || focusFollowMode === 'off') return
    setLoopFocus(loopCursor)
    const frame = requestAnimationFrame(() => {
      const scroller = loopTimelineScrollRef.current
      const timeline = loopTimelineRef.current
      if (!scroller || !timeline) return
      const cursorX = (loopCursor / editorDuration) * timeline.offsetWidth
      if (focusFollowMode === 'center') {
        const target = cursorX - scroller.clientWidth / 2
        scroller.scrollLeft = Math.max(0, Math.min(target, scroller.scrollWidth - scroller.clientWidth))
        return
      }
      const left = scroller.scrollLeft + 24
      const right = scroller.scrollLeft + scroller.clientWidth - 24
      if (cursorX < left || cursorX > right) {
        const pageStart = Math.floor(cursorX / Math.max(scroller.clientWidth, 1)) * scroller.clientWidth
        scroller.scrollLeft = Math.max(0, Math.min(pageStart, scroller.scrollWidth - scroller.clientWidth))
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [loopCursor, focusFollowMode, loopEditorSongId, editorDuration])

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

  const snapshot = (): Snapshot => ({ songs: songs.map((song) => ({ ...song, loopMarkers: song.loopMarkers ? [...song.loopMarkers] : undefined })), playlists: playlists.map((playlist) => ({ ...playlist, songIds: [...playlist.songIds] })), tags: tags.map((tag) => ({ ...tag, songIds: [...tag.songIds], playlistIds: [...tag.playlistIds] })) })
  const recordHistory = () => { setUndoStack((items) => [...items, snapshot()].slice(-50)); setRedoStack([]) }
  const restoreSnapshot = async (target: Snapshot) => {
    const previousSongs = songs
    const previousPlaylists = playlists
    const previousTags = tags
    setSongs(target.songs)
    setPlaylists(target.playlists)
    setTags(target.tags)
    const songIds = new Set(target.songs.map((song) => song.id))
    const playlistIds = new Set(target.playlists.map((playlist) => playlist.id))
    await Promise.all(previousSongs.filter((song) => !songIds.has(song.id)).map((song) => deleteSong(song.id)))
    await saveSongOrder(target.songs)
    await Promise.all(previousPlaylists.filter((playlist) => !playlistIds.has(playlist.id)).map((playlist) => deletePlaylist(playlist.id)))
    await Promise.all(target.playlists.map(savePlaylist))
    const tagIds = new Set(target.tags.map((tag) => tag.id))
    await Promise.all(previousTags.filter((tag) => !tagIds.has(tag.id)).map((tag) => deleteTag(tag.id)))
    await Promise.all(target.tags.map(saveTag))
  }
  const undo = async () => { const target = undoStack.at(-1); if (!target || moveCandidate) return; setCancelledDuplicateAction(null); setUndoStack((items) => items.slice(0, -1)); setRedoStack((items) => [...items, snapshot()].slice(-50)); await restoreSnapshot(target) }
  const redo = async () => {
    if (cancelledDuplicateAction) { const action = cancelledDuplicateAction; setCancelledDuplicateAction(null); requestDuplicateAction(action); return }
    const target = redoStack.at(-1); if (!target || moveCandidate) return; setRedoStack((items) => items.slice(0, -1)); setUndoStack((items) => [...items, snapshot()].slice(-50)); await restoreSnapshot(target)
  }

  const applyNavigation = (entry: NavigationEntry) => {
    setView(entry.view); setActivePlaylistId(entry.playlistId); setActiveTagId(entry.tagId ?? null); setDetailOpen(entry.detailOpen); setSelectionMode(false); setSelectedSongIds(new Set()); setOverflowMenu(null); setLoopEditorSongId(null); setSearchQuery('')
  }
  const navigateTo = (entry: NavigationEntry) => {
    const current = navigation[navigationIndex]
    if (current && current.view === entry.view && current.playlistId === entry.playlistId && (current.tagId ?? null) === (entry.tagId ?? null) && current.detailOpen === entry.detailOpen) return
    const next = [...navigation.slice(0, navigationIndex + 1), entry].slice(-60)
    setNavigation(next); setNavigationIndex(next.length - 1); applyNavigation(entry)
  }
  const navigateBack = () => { if (loopEditorSongId) { setLoopEditorSongId(null); return } if (navigationIndex <= 0) return; const next = navigationIndex - 1; setNavigationIndex(next); applyNavigation(navigation[next]) }
  const navigateForward = () => { if (navigationIndex >= navigation.length - 1) return; const next = navigationIndex + 1; setNavigationIndex(next); applyNavigation(navigation[next]) }
  const goHome = () => { setSettingsOpen(false); navigateTo({ view: 'library', playlistId: null, detailOpen: false }) }

  const updateSong = async (updated: Song, addHistory = false) => { if (addHistory) recordHistory(); setSongs((items) => items.map((song) => song.id === updated.id ? updated : song)); await saveSong(updated) }
  const updatePlaylist = async (updated: Playlist, addHistory = false) => { if (addHistory) recordHistory(); setPlaylists((items) => items.map((playlist) => playlist.id === updated.id ? updated : playlist)); await savePlaylist(updated) }
  const updateTag = async (updated: Tag, addHistory = false) => { if (addHistory) recordHistory(); setTags((items) => items.map((tag) => tag.id === updated.id ? updated : tag)); await saveTag(updated) }

  const toggleSelected = (id: string) => setSelectedSongIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const playSong = (id: string, remember = true) => {
    if (selectionMode) return toggleSelected(id)
    const song = songs.find((item) => item.id === id)
    if (!song?.file || song.file.size === 0) { setMessage('Diese Audiodatei ist lokal nicht mehr verfügbar. Bitte importiere sie erneut.'); return }
    if (id === currentSongId && currentPlaybackAudio()) return void currentPlaybackAudio()?.play().catch(() => setMessage(`„${song.name}“ konnte nicht gestartet werden.`))
    if (remember && currentSongId) setPlayHistory((items) => [...items, currentSongId].slice(-50))
    shouldAutoPlayRef.current = true; setCurrentSongId(id); setCurrentTime(0)
  }
  const playQueueSong = (song: Song) => {
    const activeAudio = currentPlaybackAudio()
    if (song.id === currentSongId && activeAudio) {
      cancelLoopTransition(); activeAudio.currentTime = 0; setCurrentTime(0)
      void activeAudio.play().catch(() => setMessage(`„${song.name}“ konnte nicht erneut gestartet werden.`))
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
    const audio = currentPlaybackAudio()
    if (!currentSong) return playerQueue[0] && playSong(playerQueue[0].id)
    if (!audio) return
    if (audio.paused) void audio.play().catch(() => setMessage(`„${currentSong.name}“ konnte nicht gestartet werden.`))
    else { audioRef.current?.pause(); overlapAudioRef.current?.pause(); cancelLoopTransition(); setIsPlaying(false) }
  }
  const seek = (value: number) => {
    const audio = currentPlaybackAudio(); if (!audio) return
    const next = Math.max(0, Math.min(duration || 0, value)); cancelLoopTransition(); audio.currentTime = next
    const other = otherPlaybackAudio(audio); if (other) other.currentTime = next
    setCurrentTime(next); if (loopEditorSongId) setLoopCursor(next)
  }
  const skipSeconds = (seconds: number) => seek(currentTime + seconds)
  const playPreviousFromHistory = () => { const previous = playHistory.at(-1); if (!previous) return; setPlayHistory((items) => items.slice(0, -1)); playSong(previous, false) }

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = currentSong ? new MediaMetadata({ title: currentSong.name, artist: 'Josi' }) : null
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler | null]> = [
      ['play', () => void currentPlaybackAudio()?.play()], ['pause', () => { audioRef.current?.pause(); overlapAudioRef.current?.pause(); updatePlayingState() }], ['previoustrack', () => moveSong(-1)], ['nexttrack', () => moveSong(1)],
      ['seekbackward', (event) => skipSeconds(-(event.seekOffset ?? seekSeconds))], ['seekforward', (event) => skipSeconds(event.seekOffset ?? seekSeconds)], ['seekto', (event) => event.seekTime !== undefined && seek(event.seekTime)],
    ]
    handlers.forEach(([action, handler]) => { try { navigator.mediaSession.setActionHandler(action, handler) } catch { /* unsupported */ } })
    return () => handlers.forEach(([action]) => { try { navigator.mediaSession.setActionHandler(action, null) } catch { /* unsupported */ } })
  }, [currentSong?.id, isPlaying, playerQueue, shuffle, repeatQueue, currentTime, duration, seekSeconds])

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

  const beginRename = (kind: 'song' | 'playlist' | 'tag', id: string) => {
    const name = kind === 'song' ? songs.find((song) => song.id === id)?.name : kind === 'playlist' ? playlists.find((playlist) => playlist.id === id)?.name : tags.find((tag) => tag.id === id)?.name
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
    } else if (renameTarget.kind === 'playlist') {
      const playlist = playlists.find((item) => item.id === renameTarget.id)
      if (playlist) await updatePlaylist({ ...playlist, name, lastUsedAt: Date.now() }, true)
    } else {
      const tag = tags.find((item) => item.id === renameTarget.id)
      if (tag) await updateTag({ ...tag, name, lastUsedAt: Date.now() }, true)
    }
    setRenameTarget(null)
  }

  const normalizeName = (value: string) => value.trim().toLocaleLowerCase('de-DE')
  const copySong = (id: string) => {
    const song = songs.find((item) => item.id === id)
    if (!song?.file || song.file.size === 0) { setMessage('Diese Datei kann nicht kopiert werden, weil der lokale Audioblob fehlt.'); setOverflowMenu(null); return }
    setClipboard({ kind: 'song', song: { ...song, loopMarkers: song.loopMarkers ? [...song.loopMarkers] : undefined } })
    setOverflowMenu(null); setMessage(`„${song.name}“ liegt in der Josi-Zwischenablage.`)
  }
  const copyPlaylist = (id: string) => {
    const playlist = playlists.find((item) => item.id === id)
    if (!playlist) return
    setClipboard({ kind: 'playlist', playlist: { ...playlist, songIds: [...playlist.songIds] } })
    setOverflowMenu(null); setMessage(`„${playlist.name}“ liegt in der Josi-Zwischenablage.`)
  }

  const duplicateNamesForAction = (action: DuplicateAction) => {
    if (action.kind === 'tag-add') {
      const tag = tags.find((item) => item.id === action.tagId)
      if (!tag) return []
      const pool = action.targetKind === 'song' ? songs : playlists
      const memberIds = action.targetKind === 'song' ? tag.songIds : tag.playlistIds
      const newNames = new Set(action.ids.map((id) => normalizeName(pool.find((item) => item.id === id)?.name ?? '')).filter(Boolean))
      return [...new Set(memberIds.filter((id) => !action.ids.includes(id)).map((id) => pool.find((item) => item.id === id)?.name).filter((name): name is string => Boolean(name)).filter((name) => newNames.has(normalizeName(name))))]
    }
    if (action.kind === 'paste-song') {
      const destination = action.targetPlaylistId ? playlists.find((playlist) => playlist.id === action.targetPlaylistId)?.songIds.map((id) => songs.find((song) => song.id === id)).filter((song): song is Song => Boolean(song)) ?? [] : songs
      return [...new Set(destination.filter((song) => normalizeName(song.name) === normalizeName(action.source.name)).map((song) => song.name))]
    }
    return [...new Set(playlists.filter((playlist) => normalizeName(playlist.name) === normalizeName(action.source.name)).map((playlist) => playlist.name))]
  }
  const requestDuplicateAction = (action: DuplicateAction) => {
    const names = duplicateNamesForAction(action)
    if (names.length) { setDuplicateConflict({ action, names }); return }
    void applyDuplicateAction(action, 'both')
  }
  const moveSongsToTrash = async (ids: string[]) => {
    const idSet = new Set(ids)
    const moving = songs.filter((song) => idSet.has(song.id)).map((song) => ({ ...song, trashedAt: Date.now(), trashPlaylistIds: playlists.filter((playlist) => playlist.songIds.includes(song.id)).map((playlist) => playlist.id) }))
    if (!moving.length) return
    await Promise.all(moving.map(saveSong))
    const affected = playlists.filter((playlist) => playlist.songIds.some((id) => idSet.has(id))).map((playlist) => ({ ...playlist, songIds: playlist.songIds.filter((id) => !idSet.has(id)) }))
    if (affected.length) await Promise.all(affected.map(savePlaylist))
    setPlaylists((items) => items.map((playlist) => affected.find((changed) => changed.id === playlist.id) ?? playlist))
    setSongs((items) => items.filter((song) => !idSet.has(song.id)))
    setTrashedSongs((items) => [...moving, ...items.filter((song) => !idSet.has(song.id))])
  }
  const applyDuplicateAction = async (action: DuplicateAction, resolution: 'replace' | 'both') => {
    setDuplicateConflict(null); setCancelledDuplicateAction(null)
    if (action.kind === 'tag-add') {
      const tag = tags.find((item) => item.id === action.tagId)
      if (!tag) return
      const pool = action.targetKind === 'song' ? songs : playlists
      const newNames = new Set(action.ids.map((id) => normalizeName(pool.find((item) => item.id === id)?.name ?? '')).filter(Boolean))
      if (action.targetKind === 'song') {
        const kept = resolution === 'replace' ? tag.songIds.filter((id) => action.ids.includes(id) || !newNames.has(normalizeName(songs.find((song) => song.id === id)?.name ?? ''))) : tag.songIds
        await updateTag({ ...tag, songIds: [...new Set([...kept, ...action.ids])], lastUsedAt: Date.now() }, true)
      } else {
        const kept = resolution === 'replace' ? tag.playlistIds.filter((id) => action.ids.includes(id) || !newNames.has(normalizeName(playlists.find((playlist) => playlist.id === id)?.name ?? ''))) : tag.playlistIds
        await updateTag({ ...tag, playlistIds: [...new Set([...kept, ...action.ids])], lastUsedAt: Date.now() }, true)
      }
      return
    }
    if (action.kind === 'paste-song') {
      const now = Date.now()
      const conflicts = songs.filter((song) => normalizeName(song.name) === normalizeName(action.source.name))
      if (resolution === 'both' || action.targetPlaylistId) recordHistory()
      if (resolution === 'replace' && action.targetPlaylistId) {
        const target = playlists.find((playlist) => playlist.id === action.targetPlaylistId)
        if (target) await updatePlaylist({ ...target, songIds: target.songIds.filter((id) => !conflicts.some((song) => song.id === id)), lastUsedAt: Date.now() })
      } else if (resolution === 'replace' && conflicts.length) await moveSongsToTrash(conflicts.map((song) => song.id))
      const copy: Song = { ...action.source, id: crypto.randomUUID(), addedAt: now, libraryOrder: now, importBatchId: crypto.randomUUID(), isNew: false, completedPlays: 0, loopMarkers: action.source.loopMarkers ? [...action.source.loopMarkers] : undefined, trashedAt: undefined, trashPlaylistIds: undefined, trashedLoop: undefined }
      await saveSong(copy); setSongs((items) => [...items, copy])
      if (action.targetPlaylistId) {
        const target = playlists.find((playlist) => playlist.id === action.targetPlaylistId)
        if (target) await updatePlaylist({ ...target, songIds: [...target.songIds.filter((id) => resolution !== 'replace' || !conflicts.some((song) => song.id === id)), copy.id], lastUsedAt: Date.now() })
      }
      setOverflowMenu(null); setMessage(`„${copy.name}“ wurde eingefügt.`); return
    }
    const conflicts = playlists.filter((playlist) => normalizeName(playlist.name) === normalizeName(action.source.name))
    if (resolution === 'both') recordHistory()
    if (resolution === 'replace' && conflicts.length) {
      const trashedAt = Date.now()
      const moving = conflicts.map((playlist) => ({ ...playlist, trashedAt }))
      await Promise.all(moving.map(savePlaylist)); setPlaylists((items) => items.filter((playlist) => !conflicts.some((conflict) => conflict.id === playlist.id))); setTrashedPlaylists((items) => [...moving, ...items.filter((playlist) => !conflicts.some((conflict) => conflict.id === playlist.id))])
    }
    const copy: Playlist = { ...action.source, id: crypto.randomUUID(), songIds: [...action.source.songIds], createdAt: Date.now(), lastUsedAt: Date.now(), sortOrder: -Date.now(), trashedAt: undefined }
    await savePlaylist(copy); setPlaylists((items) => [copy, ...items]); setOverflowMenu(null); setMessage(`„${copy.name}“ wurde eingefügt.`)
  }
  const resolveDuplicateConflict = (resolution: 'replace' | 'both') => { const action = duplicateConflict?.action; if (action) void applyDuplicateAction(action, resolution) }
  const cancelDuplicateConflict = () => { if (duplicateConflict) setCancelledDuplicateAction(duplicateConflict.action); setDuplicateConflict(null) }
  const pasteFromSongMenu = () => { if (clipboard?.kind !== 'song') return; requestDuplicateAction({ kind: 'paste-song', source: clipboard.song, targetPlaylistId: view === 'library' ? activePlaylistId : null }) }
  const pasteFromPlaylistMenu = (playlistId: string) => {
    if (clipboard?.kind === 'song') requestDuplicateAction({ kind: 'paste-song', source: clipboard.song, targetPlaylistId: playlistId })
    else if (clipboard?.kind === 'playlist') requestDuplicateAction({ kind: 'paste-playlist', source: clipboard.playlist })
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
    const playlistIds = playlists.filter((playlist) => playlist.songIds.includes(songToDelete.id)).map((playlist) => playlist.id)
    const trashedSong = { ...songToDelete, trashedAt: Date.now(), trashPlaylistIds: playlistIds }
    await saveSong(trashedSong)
    const affected = playlists.filter((playlist) => playlist.songIds.includes(songToDelete.id)).map((playlist) => ({ ...playlist, songIds: playlist.songIds.filter((id) => id !== songToDelete.id) }))
    if (affected.length) await Promise.all(affected.map(savePlaylist))
    setPlaylists((items) => items.map((playlist) => affected.find((changed) => changed.id === playlist.id) ?? playlist))
    setSongs((items) => items.filter((song) => song.id !== songToDelete.id))
    setTrashedSongs((items) => [trashedSong, ...items.filter((song) => song.id !== trashedSong.id)])
    if (currentSongId === songToDelete.id) { audioRef.current?.pause(); overlapAudioRef.current?.pause(); setCurrentSongId(null); setCurrentUrl(null); setCurrentTime(0); setDuration(0) }
    if (loopEditorSongId === songToDelete.id) setLoopEditorSongId(null)
    setSelectedSongIds((items) => { const next = new Set(items); next.delete(songToDelete.id); return next })
    setSongToDelete(null)
  }

  const openLoopEditor = (id: string) => {
    const song = songs.find((item) => item.id === id)
    if (!song) return
    if (!song.file || song.file.size === 0) { setMessage('Für diesen Song fehlt die lokale Audiodatei.'); setOverflowMenu(null); return }
    shouldAutoPlayRef.current = false
    ensurePrimaryPlayback()
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
    if (kind === 'focus' && focusFollowMode !== 'off') return
    recordLoopEditorHistory()
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
  const loopEditorSnapshot = (): LoopEditorSnapshot => ({ start: loopDraftStart, end: loopDraftEnd, cursor: loopCursor, focus: loopFocus, markers: [...loopMarkers], zoom: loopZoom })
  const applyLoopEditorSnapshot = (target: LoopEditorSnapshot) => {
    setLoopDraftStart(target.start); setLoopDraftEnd(target.end); setLoopCursor(target.cursor); setLoopFocus(target.focus); setLoopMarkers([...target.markers]); setLoopZoom(target.zoom)
    setActiveMarkerIndex((index) => target.markers.length ? Math.min(index ?? 0, target.markers.length - 1) : null)
    seek(target.cursor)
  }
  const recordLoopEditorHistory = () => {
    if (!loopEditorSongId) return
    setLoopUndoStack((items) => [...items, loopEditorSnapshot()].slice(-60))
    setLoopRedoStack([])
  }
  const undoLoopEditor = () => {
    const target = loopUndoStack.at(-1)
    if (!target) return
    setLoopUndoStack((items) => items.slice(0, -1))
    setLoopRedoStack((items) => [...items, loopEditorSnapshot()].slice(-60))
    applyLoopEditorSnapshot(target)
  }
  const redoLoopEditor = () => {
    const target = loopRedoStack.at(-1)
    if (!target) return
    setLoopRedoStack((items) => items.slice(0, -1))
    setLoopUndoStack((items) => [...items, loopEditorSnapshot()].slice(-60))
    applyLoopEditorSnapshot(target)
  }
  const moveCursorTo = (value: number, play = false, remember = false) => {
    if (remember) recordLoopEditorHistory()
    const next = Math.max(0, Math.min(editorDuration || 0, value))
    setLoopCursor(next); seek(next)
    if (play) void audioRef.current?.play().catch(() => setMessage('Die Vorschau konnte nicht gestartet werden.'))
  }
  const parseEditorSeconds = (value: string, fallback: number, max = 60) => Math.max(.001, Math.min(max, Number.parseFloat(value.replace(',', '.')) || fallback))
  const parsedEdgeStep = () => parseEditorSeconds(edgeStep, .01)
  const nudgeLoopEdge = (edge: 'start' | 'end', delta: number) => {
    if (loopSelectionLocked || !editorDuration) return
    recordLoopEditorHistory()
    const minLength = .001
    setActiveLoopEdge(edge)
    if (edge === 'start') setLoopDraftStart((value) => Math.max(0, Math.min(value + delta, loopDraftEnd - minLength)))
    else setLoopDraftEnd((value) => Math.min(editorDuration, Math.max(value + delta, loopDraftStart + minLength)))
  }
  const nudgeFocus = (delta: number) => {
    if (!editorDuration) return
    recordLoopEditorHistory()
    setFocusFollowMode('off')
    setLoopFocus((value) => Math.max(0, Math.min(editorDuration, value + delta)))
  }
  const nudgeCursor = (delta: number) => moveCursorTo(loopCursor + delta, false, true)
  const setMarker = () => {
    if (!markersEnabled || !editorDuration) return
    recordLoopEditorHistory()
    const next = [...loopMarkers, loopCursor].sort((a, b) => a - b)
    setLoopMarkers(next)
    let nearest = 0
    let distance = Number.POSITIVE_INFINITY
    next.forEach((value, index) => { const currentDistance = Math.abs(value - loopCursor); if (currentDistance < distance) { distance = currentDistance; nearest = index } })
    setActiveMarkerIndex(nearest)
  }
  const nudgeActiveMarker = (delta: number) => {
    if (!markersEnabled || activeMarkerIndex === null || !editorDuration || !loopMarkers[activeMarkerIndex] && loopMarkers[activeMarkerIndex] !== 0) return
    recordLoopEditorHistory()
    const next = [...loopMarkers]
    next[activeMarkerIndex] = Math.max(0, Math.min(editorDuration, next[activeMarkerIndex] + delta))
    const selectedValue = next[activeMarkerIndex]
    next.sort((a, b) => a - b)
    setLoopMarkers(next)
    setActiveMarkerIndex(next.indexOf(selectedValue))
  }
  const deleteActiveMarker = () => {
    if (activeMarkerIndex === null || !loopMarkers.length) return
    recordLoopEditorHistory()
    const next = loopMarkers.filter((_, index) => index !== activeMarkerIndex)
    setLoopMarkers(next)
    setActiveMarkerIndex(next.length ? Math.min(activeMarkerIndex, next.length - 1) : null)
    setLoopEditorMenuOpen(false)
  }
  const deleteAllMarkers = () => {
    if (!loopMarkers.length) return
    recordLoopEditorHistory()
    setLoopMarkers([]); setActiveMarkerIndex(null); setLoopEditorMenuOpen(false); setLoopConfirmation(null)
  }
  const scrollTimelineTo = (time: number) => {
    const scroller = loopTimelineScrollRef.current
    const timeline = loopTimelineRef.current
    if (!scroller || !timeline || !editorDuration) return
    const target = (time / editorDuration) * timeline.offsetWidth - scroller.clientWidth / 2
    scroller.scrollTo({ left: Math.max(0, Math.min(target, scroller.scrollWidth - scroller.clientWidth)), behavior: 'smooth' })
  }
  const moveMarkerTarget = (target: 'focus' | 'start' | 'end') => {
    if (activeMarkerIndex === null || loopMarkers[activeMarkerIndex] === undefined || !editorDuration) return
    const marker = loopMarkers[activeMarkerIndex]
    recordLoopEditorHistory()
    if (target === 'focus') { setFocusFollowMode('off'); setLoopFocus(marker); scrollTimelineTo(marker) }
    if (target === 'start') { setActiveLoopEdge('start'); setLoopDraftStart(Math.max(0, Math.min(marker, loopDraftEnd - .001))) }
    if (target === 'end') { setActiveLoopEdge('end'); setLoopDraftEnd(Math.min(editorDuration, Math.max(marker, loopDraftStart + .001))) }
    setLoopEditorMenuOpen(false)
  }
  const previewBoundary = (boundary: 'start' | 'end') => {
    const source = boundary === 'start' ? previewLeadStart : previewLeadEnd
    const lead = Math.max(0, Number.parseFloat(source.replace(',', '.')) || 0)
    moveCursorTo(Math.max(0, (boundary === 'start' ? loopDraftStart : loopDraftEnd) - lead), true, true)
  }
  const markerLabel = (index: number) => index < 26 ? String.fromCharCode(65 + index) : `${String.fromCharCode(65 + (index % 26))}${Math.floor(index / 26) + 1}`
  const saveLoopDraft = async () => {
    if (!editorSong || !editorDuration || loopDraftEnd <= loopDraftStart) return
    const wasPlaying = Boolean(currentPlaybackAudio() && !currentPlaybackAudio()?.paused)
    await updateSong({ ...editorSong, loopStart: loopDraftStart, loopEnd: loopDraftEnd, loopEnabled: true, loopConfidence: undefined, loopMarkers: [...loopMarkers] }, true)
    setLoopEditorSongId(null)
    if (wasPlaying) void currentPlaybackAudio()?.play().catch(() => undefined)
    setLoopConfirmation(null)
    setMessage(`Loop für „${editorSong.name}“ gespeichert.`)
  }

  const createTag = async (event: React.FormEvent) => {
    event.preventDefault(); const name = tagName.trim(); if (!name) return
    if (tags.some((tag) => normalizeName(tag.name) === normalizeName(name))) { setMessage('Ein Tag mit diesem Namen existiert bereits.'); return }
    recordHistory(); const now = Date.now(); const tag: Tag = { id: crypto.randomUUID(), name, color: TAG_COLORS[tags.length % TAG_COLORS.length], songIds: [], playlistIds: [], createdAt: now, lastUsedAt: now, sortOrder: tags.length }
    await saveTag(tag); setTags((items) => [...items, tag]); setTagName('')
  }
  const openTag = async (id: string) => {
    if (reorderScope === 'tags') return
    navigateTo({ view: 'tag', playlistId: null, tagId: id, detailOpen: false })
    const tag = tags.find((item) => item.id === id); if (tag) await updateTag({ ...tag, lastUsedAt: Date.now() })
  }
  const confirmDeleteTag = async () => {
    if (!tagToDelete) return; const trashed = { ...tagToDelete, trashedAt: Date.now() }; await saveTag(trashed); setTags((items) => items.filter((tag) => tag.id !== tagToDelete.id)); setTrashedTags((items) => [trashed, ...items.filter((tag) => tag.id !== trashed.id)]); if (activeTagId === tagToDelete.id) goHome(); setTagToDelete(null)
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
  const openPlaylistCoverPicker = (id: string) => { setPlaylistCoverTargetId(id); setOverflowMenu(null); requestAnimationFrame(() => { if (!coverInputRef.current) return; coverInputRef.current.value = ''; coverInputRef.current.click() }) }
  const changePlaylistCover = async (files: FileList | null) => { const playlist = playlists.find((item) => item.id === playlistCoverTargetId); if (!playlist || !files?.[0] || !files[0].type.startsWith('image/')) return; await updatePlaylist({ ...playlist, cover: files[0], lastUsedAt: Date.now() }, true); setPlaylistCoverTargetId(null); if (coverInputRef.current) coverInputRef.current.value = '' }
  const confirmDeletePlaylist = async () => { if (!playlistToDelete) return; const trashed = { ...playlistToDelete, trashedAt: Date.now() }; await savePlaylist(trashed); setPlaylists((items) => items.filter((playlist) => playlist.id !== playlistToDelete.id)); setTrashedPlaylists((items) => [trashed, ...items.filter((playlist) => playlist.id !== trashed.id)]); if (activePlaylistId === playlistToDelete.id) navigateTo({ view: 'library', playlistId: null, detailOpen: false }); setPlaylistToDelete(null) }

  const beginReorder = (scope: Exclude<ReorderScope, null>) => { if (scope === 'library' || scope === 'playlist') setSearchQuery(''); setReorderScope(scope); setMoveCandidate(null); setOverflowMenu(null); if (scope === 'tags') setTagSortMode('manual'); else setSortMode('manual') }
  const finishReorder = () => { setReorderScope(null); setMoveCandidate(null) }
  const reorderIds = (ids: string[], sourceId: string, targetIndex: number) => { const sourceIndex = ids.indexOf(sourceId); if (sourceIndex < 0) return ids; const next = [...ids]; const [moved] = next.splice(sourceIndex, 1); next.splice(Math.max(0, Math.min(targetIndex > sourceIndex ? targetIndex - 1 : targetIndex, next.length)), 0, moved); return next }
  const confirmPendingMove = async () => {
    if (!moveCandidate || moveCandidate.targetIndex === null) return; recordHistory()
    if (moveCandidate.kind === 'playlist') {
      const ids = reorderIds(sidebarPlaylists.map((playlist) => playlist.id), moveCandidate.id, moveCandidate.targetIndex); const order = new Map(ids.map((id, index) => [id, index])); const updated = playlists.map((playlist) => ({ ...playlist, sortOrder: order.get(playlist.id) ?? playlist.sortOrder })); setPlaylists(updated); await Promise.all(updated.map(savePlaylist))
    } else if (moveCandidate.kind === 'tag') {
      const ids = reorderIds(sidebarTags.map((tag) => tag.id), moveCandidate.id, moveCandidate.targetIndex); const order = new Map(ids.map((id, index) => [id, index])); const updated = tags.map((tag) => ({ ...tag, sortOrder: order.get(tag.id) ?? tag.sortOrder })); setTags(updated); await Promise.all(updated.map(saveTag))
    } else if (reorderScope === 'playlist' && activePlaylist) await updatePlaylist({ ...activePlaylist, songIds: reorderIds(activePlaylist.songIds, moveCandidate.id, moveCandidate.targetIndex) })
    else { const ids = reorderIds(songs.map((song) => song.id), moveCandidate.id, moveCandidate.targetIndex); const byId = new Map(songs.map((song) => [song.id, song])); const updated = ids.map((id, index) => ({ ...byId.get(id)!, libraryOrder: index })); setSongs(updated); await saveSongOrder(updated) }
    setMoveCandidate(null)
  }
  const renderDropZone = (index: number, kind: 'song' | 'playlist' | 'tag') => !moveCandidate || moveCandidate.kind !== kind ? null : <button className={`drop-zone${moveCandidate.targetIndex === index ? ' selected' : ''}`} type="button" onClick={() => setMoveCandidate({ ...moveCandidate, targetIndex: index })}><span /></button>

  const membershipText = (songId: string) => { const names = playlists.filter((playlist) => playlist.songIds.includes(songId)).map((playlist) => playlist.name); return names.length ? names.join(' · ') : 'In keiner Playlist' }
  const songTags = (songId: string) => tags.filter((tag) => tag.songIds.includes(songId))
  const playlistTags = (playlistId: string) => tags.filter((tag) => tag.playlistIds.includes(playlistId))
  const openTagChooser = (kind: 'song' | 'playlist', ids: string[]) => { setTagChooserTarget({ kind, ids }); setOverflowMenu(null); setSelectionMenuOpen(false) }
  const toggleTargetTag = async (tag: Tag) => {
    if (!tagChooserTarget?.ids.length) return
    const memberIds = tagChooserTarget.kind === 'song' ? tag.songIds : tag.playlistIds
    const allAssigned = tagChooserTarget.ids.every((id) => memberIds.includes(id))
    if (allAssigned) {
      if (tagChooserTarget.kind === 'song') await updateTag({ ...tag, songIds: tag.songIds.filter((id) => !tagChooserTarget.ids.includes(id)), lastUsedAt: Date.now() }, true)
      else await updateTag({ ...tag, playlistIds: tag.playlistIds.filter((id) => !tagChooserTarget.ids.includes(id)), lastUsedAt: Date.now() }, true)
      return
    }
    const ids = tagChooserTarget.ids.filter((id) => !memberIds.includes(id))
    requestDuplicateAction({ kind: 'tag-add', tagId: tag.id, targetKind: tagChooserTarget.kind, ids })
  }
  const removeSongFromActiveTag = async (songId: string) => { if (!activeTag) return; await updateTag({ ...activeTag, songIds: activeTag.songIds.filter((id) => id !== songId), lastUsedAt: Date.now() }, true) }
  const startSelection = () => { setSelectionMode(true); setSelectedSongIds(new Set()); setSelectionMenuOpen(false); setBulkMoveMode(false) }
  const stopSelection = () => { setSelectionMode(false); setSelectedSongIds(new Set()); setPlaylistChooserMode(null); setSelectionMenuOpen(false); setBulkMoveMode(false); setSelectionConfirmation(null) }
  const beginSelectedMove = () => {
    setSelectionMenuOpen(false)
    if (!selectedSongIds.size || view !== 'library') return
    if (searchQuery.trim()) setSearchQuery('')
    if (sortMode !== 'manual') { setSelectionConfirmation('switchManual'); return }
    setBulkMoveMode(true)
  }
  const moveSelectedToIndex = async (targetIndex: number) => {
    if (!bulkMoveMode || !selectedSongIds.size || view !== 'library') return
    const sourceIds = activePlaylist ? [...activePlaylist.songIds] : manualQueue.map((song) => song.id)
    const moving = sourceIds.filter((id) => selectedSongIds.has(id))
    if (!moving.length) return
    const removedBeforeTarget = sourceIds.slice(0, targetIndex).filter((id) => selectedSongIds.has(id)).length
    const remaining = sourceIds.filter((id) => !selectedSongIds.has(id))
    const insertAt = Math.max(0, Math.min(remaining.length, targetIndex - removedBeforeTarget))
    const nextIds = [...remaining.slice(0, insertAt), ...moving, ...remaining.slice(insertAt)]
    if (activePlaylist) {
      await updatePlaylist({ ...activePlaylist, songIds: nextIds, lastUsedAt: Date.now() }, true)
    } else {
      recordHistory()
      const byId = new Map(songs.map((song) => [song.id, song]))
      const updated = nextIds.map((id, index) => ({ ...byId.get(id)!, libraryOrder: index }))
      setSongs(updated)
      await saveSongOrder(updated)
    }
    setBulkMoveMode(false)
  }
  const renderBulkMoveDropZone = (index: number) => !bulkMoveMode ? null : <button className="drop-zone bulk-move-zone" type="button" onClick={() => void moveSelectedToIndex(index)} aria-label="Auswahl hierhin bewegen"><span /></button>
  const deleteSelectedSongs = async () => {
    const ids = new Set(selectedSongIds)
    if (!ids.size) return
    const deletedAt = Date.now()
    const movingToTrash = songs.filter((song) => ids.has(song.id)).map((song) => ({ ...song, trashedAt: deletedAt, trashPlaylistIds: playlists.filter((playlist) => playlist.songIds.includes(song.id)).map((playlist) => playlist.id) }))
    await Promise.all(movingToTrash.map(saveSong))
    const affected = playlists.filter((playlist) => playlist.songIds.some((id) => ids.has(id))).map((playlist) => ({ ...playlist, songIds: playlist.songIds.filter((id) => !ids.has(id)) }))
    if (affected.length) await Promise.all(affected.map(savePlaylist))
    setPlaylists((items) => items.map((playlist) => affected.find((changed) => changed.id === playlist.id) ?? playlist))
    setSongs((items) => items.filter((song) => !ids.has(song.id)))
    setTrashedSongs((items) => [...movingToTrash, ...items.filter((song) => !ids.has(song.id))])
    if (currentSongId && ids.has(currentSongId)) { audioRef.current?.pause(); overlapAudioRef.current?.pause(); setCurrentSongId(null); setCurrentUrl(null); setCurrentTime(0); setDuration(0) }
    setSelectionConfirmation(null)
    stopSelection()
  }
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
  const toggleSongLoop = async (id: string) => { const song = songs.find((item) => item.id === id); if (!song || song.loopStart === undefined || song.loopEnd === undefined) return; if (song.loopEnabled && id === currentSongId) cancelLoopTransition(); await updateSong({ ...song, loopEnabled: !song.loopEnabled }, true); setOverflowMenu(null) }
  const toggleCurrentLoop = async () => { if (!currentSong || currentSong.loopStart === undefined || currentSong.loopEnd === undefined) return; if (currentSong.loopEnabled) cancelLoopTransition(); await updateSong({ ...currentSong, loopEnabled: !currentSong.loopEnabled }, true) }
  const removeCurrentLoop = async () => { if (!currentSong || currentSong.loopStart === undefined || currentSong.loopEnd === undefined) return; await updateSong({ ...currentSong, trashedLoop: { deletedAt: Date.now(), start: currentSong.loopStart, end: currentSong.loopEnd, enabled: Boolean(currentSong.loopEnabled), markers: currentSong.loopMarkers ? [...currentSong.loopMarkers] : undefined }, loopStart: undefined, loopEnd: undefined, loopConfidence: undefined, loopEnabled: false, loopMarkers: undefined }); setLoopConfirmation(null) }

  const restoreTrashedSong = async (song: Song) => {
    const wantedPlaylists = song.trashPlaylistIds ?? []
    const activeIds = new Set(playlists.map((playlist) => playlist.id))
    const remainingIds = wantedPlaylists.filter((id) => !activeIds.has(id))
    const restored = { ...song, trashedAt: undefined, trashPlaylistIds: remainingIds.length ? remainingIds : undefined }
    await saveSong(restored)
    const changedPlaylists = playlists.map((playlist) => wantedPlaylists.includes(playlist.id) && !playlist.songIds.includes(song.id) ? { ...playlist, songIds: [...playlist.songIds, song.id] } : playlist)
    await Promise.all(changedPlaylists.filter((playlist, index) => playlist !== playlists[index]).map(savePlaylist))
    setPlaylists(changedPlaylists)
    setTrashedSongs((items) => items.filter((item) => item.id !== song.id))
    setSongs((items) => [...items, restored].sort((a, b) => (a.libraryOrder ?? a.addedAt) - (b.libraryOrder ?? b.addedAt)))
  }
  const restoreTrashedTag = async (tag: Tag) => { const restored = { ...tag, trashedAt: undefined }; await saveTag(restored); setTrashedTags((items) => items.filter((item) => item.id !== tag.id)); setTags((items) => [...items, restored]) }
  const restoreTrashedPlaylist = async (playlist: Playlist) => {
    const waitingSongs = songs.filter((song) => song.trashPlaylistIds?.includes(playlist.id))
    const restored = { ...playlist, trashedAt: undefined, songIds: [...playlist.songIds, ...waitingSongs.map((song) => song.id).filter((id) => !playlist.songIds.includes(id))] }
    await savePlaylist(restored)
    const updatedSongs = songs.map((song) => song.trashPlaylistIds?.includes(playlist.id) ? { ...song, trashPlaylistIds: (() => { const remaining = song.trashPlaylistIds.filter((id) => id !== playlist.id); return remaining.length ? remaining : undefined })() } : song)
    await Promise.all(updatedSongs.filter((song, index) => song !== songs[index]).map(saveSong))
    setSongs(updatedSongs)
    setTrashedPlaylists((items) => items.filter((item) => item.id !== playlist.id))
    setPlaylists((items) => [restored, ...items])
  }
  const restoreTrashedLoop = async (song: Song) => { if (!song.trashedLoop) return; const loop = song.trashedLoop; await updateSong({ ...song, loopStart: loop.start, loopEnd: loop.end, loopEnabled: loop.enabled, loopMarkers: loop.markers ? [...loop.markers] : undefined, trashedLoop: undefined }); }
  const emptyTrash = async () => {
    const deletedSongIds = new Set(trashedSongs.map((song) => song.id)); const deletedPlaylistIds = new Set(trashedPlaylists.map((playlist) => playlist.id))
    const cleanedTags = tags.map((tag) => ({ ...tag, songIds: tag.songIds.filter((id) => !deletedSongIds.has(id)), playlistIds: tag.playlistIds.filter((id) => !deletedPlaylistIds.has(id)) }))
    await Promise.all(cleanedTags.filter((tag, index) => tag.songIds.length !== tags[index].songIds.length || tag.playlistIds.length !== tags[index].playlistIds.length).map(saveTag)); setTags(cleanedTags)
    await Promise.all(trashedSongs.map((song) => deleteSong(song.id)))
    await Promise.all(trashedPlaylists.map((playlist) => deletePlaylist(playlist.id)))
    await Promise.all(trashedTags.map((tag) => deleteTag(tag.id)))
    const loopTrashSongs = songs.filter((song) => song.trashedLoop)
    if (loopTrashSongs.length) await Promise.all(loopTrashSongs.map((song) => saveSong({ ...song, trashedLoop: undefined })))
    setSongs((items) => items.map((song) => song.trashedLoop ? { ...song, trashedLoop: undefined } : song))
    setTrashedSongs([]); setTrashedPlaylists([]); setTrashedTags([]); setTrashConfirmation(false)
  }
  const applyCurrentSortAsManual = async () => {
    if (view !== 'library' || sortMode === 'manual') { setSortConfirmation(false); return }
    const source = activePlaylist ? [...manualQueue] : [...songs].sort((a, b) => (a.libraryOrder ?? a.addedAt) - (b.libraryOrder ?? b.addedAt))
    const direction = sortDirection === 'down' ? 1 : -1
    const compare = (a: Song, b: Song) => {
      if (sortMode === 'azStart') return a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' })
      if (sortMode === 'azEnd') return reverseText(a.name).localeCompare(reverseText(b.name), 'de', { numeric: true, sensitivity: 'base' })
      if (sortMode === 'plays') return (a.completedPlays ?? 0) - (b.completedPlays ?? 0) || a.name.localeCompare(b.name, 'de')
      if (sortMode === 'duration') return (a.duration ?? Number.MAX_SAFE_INTEGER) - (b.duration ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'de')
      return a.addedAt - b.addedAt
    }
    const ordered = source.sort((a, b) => compare(a, b) * direction)
    recordHistory()
    if (activePlaylist) await updatePlaylist({ ...activePlaylist, songIds: ordered.map((song) => song.id), lastUsedAt: Date.now() })
    else { const updated = ordered.map((song, index) => ({ ...song, libraryOrder: index })); setSongs(updated); await saveSongOrder(updated) }
    setSortMode('manual'); setSortConfirmation(false); setSortMenuOpen(false)
  }

  const songEditMode = reorderScope === (activePlaylist ? 'playlist' : 'library') && view === 'library'
  const tagEditMode = reorderScope === 'tags'
  const newImportCount = songs.filter((song) => song.isNew).length
  const title = view === 'history' ? 'Importverlauf' : view === 'loops' ? 'Loops' : view === 'trash' ? 'Papierkorb' : view === 'tag' ? activeTag?.name ?? 'Tag' : activePlaylist?.name ?? 'Bibliothek'
  const trashCount = trashedSongs.length + trashedPlaylists.length + trashedTags.length + songs.filter((song) => song.trashedLoop).length
  const sortLabels: Record<SortMode, string> = { manual: 'Manuell', azStart: 'A–Z Anfang', azEnd: 'A–Z Ende', plays: 'Anzahl des Hörens', duration: 'Dauer', chronology: 'Chronik' }
  const tagSortLabels: Record<SortMode, string> = { ...sortLabels, duration: 'Anzahl der Lieder' }
  const loopLeft = editorDuration ? (loopDraftStart / editorDuration) * 100 : 0
  const loopWidth = editorDuration ? Math.max(0, ((loopDraftEnd - loopDraftStart) / editorDuration) * 100) : 0
  const cursorLeft = editorDuration ? (loopCursor / editorDuration) * 100 : 0
  const focusLeft = editorDuration ? (loopFocus / editorDuration) * 100 : 0
  const edgeStepSeconds = parsedEdgeStep()
  const focusStepSeconds = parseEditorSeconds(focusStep, 1)
  const cursorStepSeconds = parseEditorSeconds(cursorStep, 5)
  const markerStepSeconds = parseEditorSeconds(markerStep, 1)
  const activeMarker = activeMarkerIndex === null ? null : loopMarkers[activeMarkerIndex] ?? null
  const handleAudioTimeUpdate = (audio: HTMLAudioElement) => { if (currentPlaybackAudio() !== audio) return; setCurrentTime(audio.currentTime); if (loopEditorSongId) setLoopCursor(audio.currentTime) }
  const handleAudioEnded = (audio: HTMLAudioElement) => {
    if (loopTransitionRef.current?.outgoing === audio || currentPlaybackAudio() !== audio) return
    if (currentSong?.loopEnabled && currentSong.loopStart !== undefined && currentSong.loopEnd !== undefined) {
      const automatic = loopOverlapBlockedRef.current ? automaticLoopSeamsRef.current.get(currentSong.id) : undefined
      audio.currentTime = automatic?.start ?? currentSong.loopStart; setCurrentTime(audio.currentTime); void audio.play().catch(() => undefined); return
    }
    if (currentSong) void updateSong({ ...currentSong, completedPlays: (currentSong.completedPlays ?? 0) + 1 })
    moveSong(1)
  }

  return <div className="app-shell">
    <header className="site-header">
      <div className="history-controls" aria-label="Navigation und Verlauf"><button className="home-button" type="button" onClick={goHome} aria-label="Bibliothek">⌂</button><button className="settings-button" type="button" onClick={() => setSettingsOpen(true)} aria-label="Einstellungen">⚙</button><button type="button" onClick={navigateBack} disabled={navigationIndex === 0 && !loopEditorSongId}>‹</button><button type="button" onClick={navigateForward} disabled={navigationIndex >= navigation.length - 1 || Boolean(loopEditorSongId)}>›</button><button type="button" onClick={() => void undo()} disabled={!undoStack.length || Boolean(moveCandidate) || Boolean(loopEditorSongId)}>↶</button><button type="button" onClick={() => void redo()} disabled={(!redoStack.length && !cancelledDuplicateAction) || Boolean(moveCandidate) || Boolean(loopEditorSongId)}>↷</button>{moveCandidate && <><button className="confirm-move" type="button" onClick={() => void confirmPendingMove()} disabled={moveCandidate.targetIndex === null}>✓</button><button className="cancel-move" type="button" onClick={() => setMoveCandidate(null)}>×</button></>}</div>
      <button className="import-button" type="button" onClick={openImportPicker}>+ Musik importieren</button><input ref={fileInputRef} className="file-input" type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac" multiple onChange={(event) => void importFiles(event.target.files)} /><input ref={coverInputRef} className="file-input" type="file" accept="image/*" onChange={(event) => void changePlaylistCover(event.target.files)} />
    </header>

    {view !== 'playlistOverview' && <main className="music-layout"><aside className="sidebar">
      <button className={`nav-item${view === 'library' && !activePlaylistId ? ' active' : ''}`} type="button" onClick={() => navigateTo({ view: 'library', playlistId: null, detailOpen: false })}><span>Bibliothek</span><strong>{songs.length}</strong></button>
      <button className={`nav-item history-nav${view === 'history' ? ' active' : ''}`} type="button" onClick={() => navigateTo({ view: 'history', playlistId: null, detailOpen: false })}><span>Importverlauf</span><strong><span className="new-count-blue">{newImportCount}</span>/{songs.length}</strong></button>
      <button className={`nav-item history-nav${view === 'loops' ? ' active' : ''}`} type="button" onClick={() => navigateTo({ view: 'loops', playlistId: null, detailOpen: false })}><span>Loops</span><strong>{songs.filter((song) => song.loopStart !== undefined && song.loopEnd !== undefined).length}</strong></button>
      <button className={`nav-item history-nav${view === 'trash' ? ' active' : ''}`} type="button" onClick={() => navigateTo({ view: 'trash', playlistId: null, detailOpen: false })}><span>Papierkorb</span><strong>{trashCount}</strong></button>
      <div className="sidebar-heading collapsible-heading" onClick={() => setPlaylistsCollapsed((value) => !value)}><span className="heading-label"><b className="section-chevron">{playlistsCollapsed ? '▸' : '▾'}</b> Playlists</span><button className="overflow-button small-overflow" type="button" onClick={(event) => { event.stopPropagation(); setOverflowMenu({ kind: 'playlists' }) }}>•••</button>{reorderScope === 'sidebar' && <button className="finish-inline" type="button" onClick={(event) => { event.stopPropagation(); finishReorder() }}>Fertig</button>}</div>
      {!playlistsCollapsed && <><div className="playlist-nav">{renderDropZone(0, 'playlist')}{sidebarPlaylists.map((playlist, index) => <div className="playlist-nav-row" key={playlist.id}>{reorderScope === 'sidebar' && <button className="move-selector" type="button" onClick={() => setMoveCandidate({ kind: 'playlist', id: playlist.id, targetIndex: null })}>↕</button>}<button className={`nav-item${activePlaylistId === playlist.id && view === 'library' ? ' active' : ''}`} type="button" onClick={() => void openPlaylist(playlist.id)} disabled={reorderScope === 'sidebar'}><span className="playlist-nav-name">{coverUrls[playlist.id] ? <img src={coverUrls[playlist.id]} alt="" /> : <span className="playlist-mini-cover">♫</span>}<span className="nav-tag-dots">{playlistTags(playlist.id).map((tag) => <i key={tag.id} className="tag-dot" style={{ background: tag.color }} />)}</span><span>{playlist.name}</span></span><strong>{playlist.songIds.length}</strong></button><button className="overflow-button row-overflow" type="button" onClick={() => setOverflowMenu({ kind: 'playlist', id: playlist.id })}>•••</button>{renderDropZone(index + 1, 'playlist')}</div>)}</div>
      <form className="new-playlist" onSubmit={createPlaylist}><input value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} placeholder="Neue Playlist" /><button type="submit" disabled={!playlistName.trim()}>+</button></form></>}
      <div className="sidebar-heading collapsible-heading tag-heading" onClick={() => setTagsCollapsed((value) => !value)}><span className="heading-label"><b className="section-chevron">{tagsCollapsed ? '▸' : '▾'}</b> Tags</span><button className="overflow-button small-overflow" type="button" onClick={(event) => { event.stopPropagation(); setOverflowMenu({ kind: 'tags' }) }}>•••</button>{tagEditMode && <button className="finish-inline" type="button" onClick={(event) => { event.stopPropagation(); finishReorder() }}>Fertig</button>}</div>
      {!tagsCollapsed && <><div className="tag-sort-row" onClick={(event) => event.stopPropagation()}><select value={tagSortMode} onChange={(event) => setTagSortMode(event.target.value as SortMode)}>{(Object.keys(tagSortLabels) as SortMode[]).map((mode) => <option key={mode} value={mode}>{tagSortLabels[mode]}</option>)}</select><button type="button" disabled={tagSortMode === 'manual'} onClick={() => setTagSortDirection((value) => value === 'down' ? 'up' : 'down')}>{tagSortMode === 'manual' ? '—' : tagSortDirection === 'down' ? '↓' : '↑'}</button></div><div className="tag-nav">{renderDropZone(0, 'tag')}{sidebarTags.map((tag, index) => <div className="playlist-nav-row tag-nav-row" key={tag.id}>{tagEditMode && <button className="move-selector" type="button" onClick={() => setMoveCandidate({ kind: 'tag', id: tag.id, targetIndex: null })}>↕</button>}<button className={`nav-item${activeTagId === tag.id && view === 'tag' ? ' active' : ''}`} type="button" onClick={() => void openTag(tag.id)} disabled={tagEditMode}><span className="tag-nav-name"><i className="tag-dot" style={{ background: tag.color }} /><span>{tag.name}</span></span><strong>{tag.songIds.filter((id) => songs.some((song) => song.id === id)).length}</strong></button><button className="overflow-button row-overflow" type="button" onClick={() => setOverflowMenu({ kind: 'tag', id: tag.id })}>•••</button>{renderDropZone(index + 1, 'tag')}</div>)}</div><form className="new-playlist new-tag" onSubmit={createTag}><input value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder="Neuer Tag" /><button type="submit" disabled={!tagName.trim()}>+</button></form></>}
    </aside>

    <section className="library-panel"><div className={`library-heading${activePlaylist ? ' playlist-heading' : ''}`}>
      {activePlaylist && view === 'library' && <button className="playlist-cover" type="button" onClick={() => openPlaylistCoverPicker(activePlaylist.id)}>{coverUrls[activePlaylist.id] ? <img src={coverUrls[activePlaylist.id]} alt="" /> : <span>+ Bild</span>}</button>}
      <div className="library-title"><p className="eyebrow">{view === 'history' ? 'IMPORTVERLAUF' : view === 'loops' ? 'GESPEICHERTE LOOPS' : view === 'trash' ? 'PAPIERKORB' : view === 'tag' ? 'TAG' : activePlaylist ? 'PLAYLIST' : 'DEINE MUSIK'}</p>{activePlaylist && view === 'library' && isEditingPlaylist ? <form className="rename-playlist" onSubmit={savePlaylistName}><input value={editingName} onChange={(event) => setEditingName(event.target.value)} autoFocus /><button type="submit">Speichern</button><button type="button" onClick={() => setIsEditingPlaylist(false)}>Abbrechen</button></form> : <h1>{title}</h1>}<p>{view === 'history' ? <><span className="new-count-blue">{newImportCount}</span>/{songs.length} neue Importe</> : view === 'trash' ? `${trashCount} ${trashCount === 1 ? 'Eintrag' : 'Einträge'}` : view === 'tag' && activeTag ? `${activeTag.songIds.filter((id) => songs.some((song) => song.id === id)).length} Lieder · ${taggedPlaylists.length} Playlists` : `${visibleSongs.length} ${visibleSongs.length === 1 ? 'Lied' : 'Lieder'}`}</p></div>
      <div className="playlist-actions">{!selectionMode && view !== 'trash' && <button type="button" onClick={startSelection}>Auswählen</button>}{view === 'trash' && <button className="danger-button" type="button" onClick={() => setTrashConfirmation(true)} disabled={!trashCount}>Papierkorb leeren</button>}{selectionMode && <><button type="button" onClick={selectAllVisible}>Alle</button><button type="button" onClick={stopSelection}>Abbrechen</button></>}{activePlaylist && view === 'library' && !selectionMode && <><button type="button" onClick={startEditingPlaylist}>Name ändern</button><button type="button" onClick={() => openPlaylistCoverPicker(activePlaylist.id)}>Bild ändern</button><button type="button" onClick={() => reorderScope === 'playlist' ? finishReorder() : beginReorder('playlist')}>{reorderScope === 'playlist' ? 'Fertig' : 'Reihenfolge ändern'}</button></>}{!activePlaylist && view === 'library' && !selectionMode && <button type="button" onClick={() => reorderScope === 'library' ? finishReorder() : beginReorder('library')}>{reorderScope === 'library' ? 'Fertig' : 'Reihenfolge ändern'}</button>}</div>
    </div>
    {view === 'tag' && taggedPlaylists.length > 0 && <div className="tagged-playlists-strip"><span>PLAYLISTS</span>{taggedPlaylists.map((playlist) => <button key={playlist.id} type="button" onClick={() => void openPlaylist(playlist.id)}><span className="nav-tag-dots">{playlistTags(playlist.id).map((tag) => <i key={tag.id} className="tag-dot" style={{ background: tag.color }} />)}</span>{playlist.name}</button>)}</div>}
    {view === 'library' && <div className="search-bar"><span aria-hidden="true">⌕</span><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={activePlaylist ? 'Playlist durchsuchen' : 'Bibliothek durchsuchen'} aria-label={activePlaylist ? 'Playlist durchsuchen' : 'Bibliothek durchsuchen'} />{searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label="Suche leeren">×</button>}</div>}
    {view !== 'trash' && <div className="sort-bar"><span>Sortierung</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>{(Object.keys(sortLabels) as SortMode[]).map((mode) => <option key={mode} value={mode}>{sortLabels[mode]}</option>)}</select><button type="button" className="sort-direction" disabled={sortMode === 'manual'} onClick={() => setSortDirection((value) => value === 'down' ? 'up' : 'down')}>{sortMode === 'manual' ? '—' : sortDirection === 'down' ? '↓' : '↑'}</button><div className="sort-more-wrap"><button className="sort-more-button" type="button" onClick={() => setSortMenuOpen((value) => !value)} aria-label="Weitere Sortieraktionen">•••</button>{sortMenuOpen && <div className="sort-action-menu"><button type="button" disabled={sortMode === 'manual' || view !== 'library'} onClick={() => { setSortMenuOpen(false); setSortConfirmation(true) }}>Aktuelle Sortierung als Manuell übernehmen</button></div>}</div></div>}
    {message && <div className="message">{message}</div>}{selectionMode && <div className="selection-hint">{bulkMoveMode ? 'Zielposition in der Liste antippen.' : `${selectedSongIds.size} ausgewählt. Playlists und weitere Aktionen findest du unten rechts.`}</div>}
    {view === 'trash' ? <div className="trash-list">
      {trashedSongs.map((song) => <article className="trash-item" key={`trash-song-${song.id}`}><div><small>LIED</small><strong>{song.name}</strong><span>{song.trashedAt ? formatDate(song.trashedAt) : ''}</span></div><button type="button" onClick={() => void restoreTrashedSong(song)}>Wiederherstellen</button></article>)}
      {trashedPlaylists.map((playlist) => <article className="trash-item" key={`trash-playlist-${playlist.id}`}><div><small>PLAYLIST</small><strong>{playlist.name}</strong><span>{playlist.trashedAt ? formatDate(playlist.trashedAt) : ''}</span></div><button type="button" onClick={() => void restoreTrashedPlaylist(playlist)}>Wiederherstellen</button></article>)}
      {trashedTags.map((tag) => <article className="trash-item" key={`trash-tag-${tag.id}`}><div><small>TAG</small><strong><i className="tag-dot" style={{ background: tag.color }} /> {tag.name}</strong><span>{tag.trashedAt ? formatDate(tag.trashedAt) : ''}</span></div><button type="button" onClick={() => void restoreTrashedTag(tag)}>Wiederherstellen</button></article>)}
      {songs.filter((song) => song.trashedLoop).map((song) => <article className="trash-item" key={`trash-loop-${song.id}`}><div><small>LOOP</small><strong>{song.name}</strong><span>{song.trashedLoop ? `${formatPrecise(song.trashedLoop.start)} – ${formatPrecise(song.trashedLoop.end)}` : ''}</span></div><button type="button" onClick={() => void restoreTrashedLoop(song)}>Wiederherstellen</button></article>)}
      {!trashCount && <div className="empty-state trash-empty"><div className="empty-icon">⌫</div><h2>Der Papierkorb ist leer.</h2></div>}
    </div> : visibleSongs.length ? <div className="song-list">{bulkMoveMode ? renderBulkMoveDropZone(0) : renderDropZone(0, 'song')}{visibleSongs.map((song, index) => <div key={song.id} className={`song-row${song.isNew ? ' new-import' : ''}${index > 0 && !song.isNew && visibleSongs[index - 1]?.isNew ? ' new-group-break' : ''}${selectedSongIds.has(song.id) ? ' selected-song' : ''}${repeatSelectionIds.has(song.id) ? ' repeat-selected-song' : ''}`}>{songEditMode && <button className="move-selector" type="button" onClick={() => setMoveCandidate({ kind: 'song', id: song.id, targetIndex: null })}>↕</button>}{selectionMode && <button className="selection-check" type="button" onClick={() => toggleSelected(song.id)}>{selectedSongIds.has(song.id) ? '✓' : ''}</button>}<button className="song-main" type="button" onClick={() => playSong(song.id)} disabled={songEditMode}><span className="song-number">{song.id === currentSongId && isPlaying ? '▶' : index + 1}</span><span className="song-copy"><strong>{song.name}</strong><small className="song-subline"><span className="song-tag-dots">{songTags(song.id).map((tag) => <i key={tag.id} className="tag-dot" style={{ background: tag.color }} title={tag.name} />)}</span><span>{view === 'history' ? formatDate(song.addedAt) : membershipText(song.id)}</span></small></span><span className="song-meta"><small>{!song.file || song.file.size === 0 ? 'FEHLT' : formatTime(song.duration)}</small>{song.loopStart !== undefined && song.loopEnd !== undefined && <span className="loop-badge">↻</span>}</span></button><button className="overflow-button song-overflow" type="button" onClick={() => setOverflowMenu({ kind: 'song', id: song.id })}>•••</button>{activePlaylist && view === 'library' && !selectionMode && !songEditMode && <button className="remove-song" type="button" onClick={() => void removeSongFromActivePlaylist(song.id)}>Entfernen</button>}{activeTag && view === 'tag' && !selectionMode && <button className="remove-song" type="button" onClick={() => void removeSongFromActiveTag(song.id)}>Entfernen</button>}{bulkMoveMode ? renderBulkMoveDropZone(index + 1) : renderDropZone(index + 1, 'song')}</div>)}</div> : <div className="empty-state"><div className="empty-icon">♫</div><h2>{view === 'library' && searchQuery.trim() ? 'Keine Treffer.' : view === 'loops' ? 'Noch keine Loops gespeichert.' : view === 'history' ? 'Keine neuen Importe.' : 'Noch keine Musik hier.'}</h2></div>}
    </section></main>}

    {view === 'playlistOverview' && <section className="playlist-overview"><div className="playlist-overview-heading"><p className="eyebrow">DEINE MUSIK</p><h1>Playlists</h1><p>{playlists.length} Playlists</p></div><div className="playlist-grid">{sidebarPlaylists.map((playlist) => <div className="playlist-card-wrap" key={playlist.id}><button className="playlist-card" type="button" onClick={() => void openPlaylist(playlist.id)}><span className="playlist-card-cover">{coverUrls[playlist.id] ? <img src={coverUrls[playlist.id]} alt="" /> : '♫'}</span><strong><span className="card-tag-dots">{playlistTags(playlist.id).map((tag) => <i key={tag.id} className="tag-dot" style={{ background: tag.color }} />)}</span>{playlist.name}</strong><small>{playlist.songIds.length} {playlist.songIds.length === 1 ? 'Lied' : 'Lieder'}</small></button><button className="overflow-button card-overflow" type="button" onClick={() => setOverflowMenu({ kind: 'playlist', id: playlist.id })}>•••</button></div>)}</div></section>}

    <section className={`player${currentSong ? ' visible' : ''}`}><audio ref={audioRef} src={currentUrl ?? undefined} playsInline preload="auto" onTimeUpdate={(event) => handleAudioTimeUpdate(event.currentTarget)} onLoadedMetadata={(event) => { const value = event.currentTarget.duration; setDuration(value); if (currentSong && Number.isFinite(value) && (!currentSong.duration || Math.abs(currentSong.duration - value) > .5)) void updateSong({ ...currentSong, duration: value }) }} onPlay={() => { playbackAudioRef.current ??= audioRef.current; setIsPlaying(true) }} onPause={() => requestAnimationFrame(updatePlayingState)} onError={() => currentSong && setMessage(`„${currentSong.name}“ kann aus dem lokalen Speicher nicht geladen werden.`)} onEnded={(event) => handleAudioEnded(event.currentTarget)} /><audio ref={overlapAudioRef} src={currentUrl ?? undefined} playsInline preload="auto" onTimeUpdate={(event) => handleAudioTimeUpdate(event.currentTarget)} onPlay={() => setIsPlaying(true)} onPause={() => requestAnimationFrame(updatePlayingState)} onEnded={(event) => handleAudioEnded(event.currentTarget)} />
      <button className="now-playing" type="button" onClick={() => currentSong && navigateTo({ view, playlistId: activePlaylistId, tagId: activeTagId, detailOpen: true })} disabled={!currentSong}><span className="cover-placeholder">♫</span><span className="now-playing-copy"><small>JETZT</small><span className="marquee"><strong>{currentSong?.name ?? 'Kein Song ausgewählt'}</strong></span></span></button>
      <div className="transport"><div className="transport-buttons"><button className={shuffle ? 'active-control' : ''} onClick={() => setShuffle((value) => !value)} aria-label="Shuffle">⇄</button><button onClick={() => moveSong(-1)} aria-label="Vorheriges Lied">⏮</button><button onClick={() => skipSeconds(-seekSeconds)} aria-label={`${seekSeconds} Sekunden zurück`}>⏪</button><button className="play-button" onClick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button><button onClick={() => skipSeconds(seekSeconds)} aria-label={`${seekSeconds} Sekunden vor`}>⏩</button><button onClick={() => moveSong(1)} aria-label="Nächstes Lied">⏭</button><button className={repeatQueue || repeatSelectionIds.size ? 'active-control repeat-control' : 'repeat-control'} onPointerDown={beginRepeatHold} onPointerUp={endRepeatHold} onPointerCancel={endRepeatHold} onContextMenu={(event) => event.preventDefault()} onClick={handleRepeatClick} aria-label={repeatSelectionIds.size ? 'Ausgewählte Lieder wiederholen' : 'Liste wiederholen'}><span className={`repeat-symbol${repeatSelectionIds.size ? ' repeat-one-symbol' : ''}`}>↻{repeatSelectionIds.size > 0 && <b>1</b>}</span></button></div><div className="progress-row"><span>{formatTime(currentTime)}</span><input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(Number(event.target.value))} /><span>{formatTime(duration)}</span></div></div>
      <div className={`quick-playlists${selectionMode ? ' selection-tools' : ''}`}><button className="all-playlists-button" type="button" onClick={() => setPlaylistChooserMode(selectionMode ? 'bulk' : 'current')} disabled={selectionMode ? !selectedSongIds.size : !currentSong}><span>Alle Playlists</span><strong>›</strong></button>{selectionMode && <div className="selection-more-wrap"><button className="selection-more-button" type="button" onClick={() => setSelectionMenuOpen((value) => !value)} aria-label="Weitere Auswahlaktionen">•••</button>{selectionMenuOpen && <><button className="selection-menu-shield" type="button" onClick={() => setSelectionMenuOpen(false)} /><div className="selection-action-menu"><button type="button" disabled>Gruppieren</button><button type="button" onClick={beginSelectedMove} disabled={!selectedSongIds.size || view !== 'library'}>Bewegen</button><button type="button" onClick={() => openTagChooser('song', [...selectedSongIds])} disabled={!selectedSongIds.size}>Tags</button><button className="danger-menu-action" type="button" onClick={() => { setSelectionMenuOpen(false); setSelectionConfirmation('deleteSelected') }} disabled={!selectedSongIds.size}>Alle löschen</button></div></>}</div>}</div>
    </section>

    {detailOpen && currentSong && <section className="song-detail"><div className="detail-topbar"><button type="button" onClick={navigateBack}>‹ Zurück</button></div><div className="detail-content"><p className="detail-label">JETZT</p><h2>{currentSong.name}</h2><div className="tag-membership-detail"><span>TAGS</span><strong>{currentSongTags.length ? currentSongTags.map((tag) => <span className="detail-tag-chip" key={tag.id}><i className="tag-dot" style={{ background: tag.color }} />{tag.name}</span>) : 'Keine Tags'}</strong></div><div className="playlist-membership"><span>IN PLAYLISTS</span><strong>{currentSongPlaylists.length ? currentSongPlaylists.map((playlist) => playlist.name).join(' · ') : 'In keiner Playlist'}</strong></div><div className="detail-progress"><input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(Number(event.target.value))} /><div><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div></div><div className="detail-controls detail-controls-expanded"><button className={shuffle ? 'active-control' : ''} onClick={() => setShuffle((value) => !value)} aria-label="Shuffle">⇄</button><button onClick={playPreviousFromHistory} disabled={!playHistory.length}>⏮</button><button onClick={() => skipSeconds(-seekSeconds)}>↶<small>{seekSeconds}</small></button><button className="detail-play" onClick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button><button onClick={() => skipSeconds(seekSeconds)}>↷<small>{seekSeconds}</small></button><button onClick={() => moveSong(1)}>⏭</button><button className={repeatQueue || repeatSelectionIds.size ? 'active-control repeat-control' : 'repeat-control'} onPointerDown={beginRepeatHold} onPointerUp={endRepeatHold} onPointerCancel={endRepeatHold} onContextMenu={(event) => event.preventDefault()} onClick={handleRepeatClick} aria-label={repeatSelectionIds.size ? 'Ausgewählte Lieder wiederholen' : 'Liste wiederholen'}><span className={`repeat-symbol${repeatSelectionIds.size ? ' repeat-one-symbol' : ''}`}>↻{repeatSelectionIds.size > 0 && <b>1</b>}</span></button></div><div className="loop-panel"><div><span className="loop-panel-label">LOOP</span><h3>{currentSong.loopStart !== undefined && currentSong.loopEnd !== undefined ? `${formatTime(currentSong.loopStart)} – ${formatTime(currentSong.loopEnd)}` : 'Noch kein Loop'}</h3><p>Den Bereich legst du präzise im Loop-Editor fest.</p></div><div className="loop-actions"><button type="button" onClick={() => openLoopEditor(currentSong.id)}>{currentSong.loopStart !== undefined ? 'Loop bearbeiten' : 'Loop erstellen'}</button>{currentSong.loopStart !== undefined && currentSong.loopEnd !== undefined && <><button className={currentSong.loopEnabled ? 'loop-active' : ''} type="button" onClick={() => void toggleCurrentLoop()}>{currentSong.loopEnabled ? 'Loop aktiv' : 'Loop aktivieren'}</button><button className="danger-button" type="button" onClick={() => setLoopConfirmation('delete')}>Loop entfernen</button></>}</div></div></div></section>}

    {loopEditorSongId && editorSong && <section className="loop-editor" aria-label="Loop bearbeiten"><div className="loop-editor-scroll"><div className="loop-editor-inner">
      <div className="loop-editor-commandbar">
        <div className="loop-command-history" aria-label="Editor Navigation"><button type="button" onClick={goHome} aria-label="Bibliothek">⌂</button><button type="button" onClick={() => setSettingsOpen(true)} aria-label="Einstellungen">⚙</button><button type="button" onClick={() => setLoopEditorSongId(null)} aria-label="Zurück">‹</button><button type="button" onClick={navigateForward} disabled={navigationIndex >= navigation.length - 1} aria-label="Vor">›</button><button type="button" onClick={undoLoopEditor} disabled={!loopUndoStack.length} aria-label="Rückgängig">↶</button><button type="button" onClick={redoLoopEditor} disabled={!loopRedoStack.length} aria-label="Wiederholen">↷</button></div>
        <div className="loop-command-fields">
          <label className="neutral-command"><span>Zoom</span><select value={loopZoom} onChange={(event) => setLoopZoom(Number(event.target.value))}>{LOOP_ZOOM_LEVELS.map((level) => <option key={level} value={level}>{level}×</option>)}</select></label>
          <label className="cursor-command"><span>Cursor Geschwindigkeit</span><select value={loopPlaybackRate} onChange={(event) => setLoopPlaybackRate(event.target.value)}>{LOOP_PLAYBACK_RATES.map((rate) => <option key={rate} value={String(rate)}>{Math.round(rate * 100)}%</option>)}</select></label>
          <div className="focus-command"><span>Fokus folgt Cursor</span><div className="tri-toggle" role="group" aria-label="Fokus folgt Cursor"><button className={focusFollowMode === 'center' ? 'selected' : ''} type="button" onClick={() => { setFocusFollowMode('center'); setLoopFocus(loopCursor) }} aria-label="Zentrieren">◎</button><button className={focusFollowMode === 'page' ? 'selected' : ''} type="button" onClick={() => { setFocusFollowMode('page'); setLoopFocus(loopCursor) }} aria-label="Umblättern">▣</button><button className={focusFollowMode === 'off' ? 'selected' : ''} type="button" onClick={() => setFocusFollowMode('off')} aria-label="Aus">○</button></div></div>
        </div>
        <div className="loop-command-toggles">
          <label className="loop-command"><span>Loop-Kasten</span><button className={`switch-control${loopSelectionLocked ? ' is-off' : ' is-on'}`} type="button" onClick={() => setLoopSelectionLocked((value) => !value)} aria-label={loopSelectionLocked ? 'Loop-Kasten beweglich machen' : 'Loop-Kasten feststellen'}><i /></button></label>
          <label className="cursor-command"><span>Cursor-Loop</span><button className={`switch-control${cursorLoopEnabled ? ' is-on' : ' is-off'}`} type="button" onClick={() => setCursorLoopEnabled((value) => !value)} aria-label="Cursor-Loop umschalten"><i /></button></label>
          <label className="marker-command"><span>Markierungen</span><button className={`switch-control${markersEnabled ? ' is-on' : ' is-off'}`} type="button" onClick={() => setMarkersEnabled((value) => !value)} aria-label="Markierungen umschalten"><i /></button></label>
          <div className="marker-command-actions"><button className="marker-set-top" type="button" onClick={setMarker} disabled={!markersEnabled}>Markierung setzen</button><button className="marker-clear-all" type="button" onClick={() => setLoopConfirmation('deleteMarkers')} disabled={!loopMarkers.length}>Alle Markierungen löschen</button></div>
        </div>
      </div>

      <div className="loop-editor-title"><div><p>LOOP EDITOR</p><h1>{editorSong.name}</h1></div><div className="waveform-status">{waveformStatus === 'loading' ? 'Wellenform wird berechnet…' : waveformStatus === 'unavailable' ? 'Wellenform nicht verfügbar' : 'Amplitude'}</div></div>

      <div className="loop-timeline-wrap">
        <div ref={loopTimelineScrollRef} className="loop-timeline-scroll"><div ref={loopTimelineRef} className="loop-timeline precision" style={{ width: `${loopZoom * 100}%` }} onPointerMove={moveLoopDrag} onPointerUp={endLoopDrag} onPointerCancel={endLoopDrag}>
          {waveform.length > 0 && <div className="loop-waveform" aria-hidden="true">{waveform.map((height, index) => <i key={index} style={{ height: `${Math.max(4, height * 92)}%` }} />)}</div>}
          <div className="timeline-guide guide-one" /><div className="timeline-guide guide-two" />
          {markersEnabled && loopMarkers.map((marker, index) => <button key={`${marker}-${index}`} className={`loop-marker${activeMarkerIndex === index ? ' active-marker' : ''}`} type="button" style={{ left: `${editorDuration ? marker / editorDuration * 100 : 0}%` }} onPointerDown={(event) => event.stopPropagation()} onClick={() => { setActiveMarkerIndex(index); moveCursorTo(marker, false, true) }} aria-label={`Markierung ${markerLabel(index)}`}><em>{formatPrecise(marker)}</em><span>{markerLabel(index)}</span></button>)}
          <div className={`loop-selection${loopSelectionLocked ? ' locked' : ''}`} style={{ left: `${loopLeft}%`, width: `${loopWidth}%` }} onPointerDown={(event) => beginLoopDrag(event, 'move')}><span className="loop-time-bubble loop-start-time">{formatPrecise(loopDraftStart)}</span><button className={`loop-handle start${activeLoopEdge === 'start' ? ' active-edge' : ''}`} type="button" aria-label="Loop-Start verschieben" onPointerDown={(event) => beginLoopDrag(event, 'start')} /><span className="loop-window-label">LOOP</span><button className={`loop-handle end${activeLoopEdge === 'end' ? ' active-edge' : ''}`} type="button" aria-label="Loop-Ende verschieben" onPointerDown={(event) => beginLoopDrag(event, 'end')} /><span className="loop-time-bubble loop-end-time">{formatPrecise(loopDraftEnd)}</span></div>
          <button className="loop-cursor" type="button" style={{ left: `${cursorLeft}%` }} aria-label="Abspielposition verschieben"><em>{formatPrecise(loopCursor)}</em><span onPointerDown={(event) => beginLoopDrag(event, 'cursor')} /></button>
        </div>
        <div ref={loopFocusRef} className={`loop-focus-track${focusFollowMode !== 'off' ? ' follows-cursor' : ''}`} style={{ width: `${loopZoom * 100}%` }} onPointerDown={(event) => beginLoopDrag(event, 'focus')} onPointerMove={moveLoopDrag} onPointerUp={endLoopDrag} onPointerCancel={endLoopDrag}><button type="button" className="loop-focus-cursor" style={{ left: `${focusLeft}%` }} aria-label="Zoom-Fokus verschieben" onPointerDown={(event) => beginLoopDrag(event, 'focus')}><em>{formatPrecise(loopFocus)}</em><span /></button></div>
        </div>
        <div className="loop-time-labels"><span>0:00</span><span>{formatTime(editorDuration)}</span></div>
      </div>

      <div className="loop-control-grid">
        <section className="editor-control-card focus-card"><header><span>Fokus-Standort <strong>{formatPrecise(loopFocus)}</strong></span></header><div className="control-step-row"><button type="button" onClick={() => nudgeFocus(-focusStepSeconds)}>◀</button><label className="step-select"><select value={focusStep} onChange={(event) => setFocusStep(event.target.value)}>{LOOP_STEP_OPTIONS.map((step) => <option key={step} value={String(step)}>{String(step).replace('.', ',')} s</option>)}</select></label><button type="button" onClick={() => nudgeFocus(focusStepSeconds)}>▶</button></div></section>
        <section className="editor-control-card cursor-card"><header><span>Cursor-Standort <strong>{formatPrecise(loopCursor)}</strong></span></header><div className="control-step-row cursor-step-row"><button type="button" onClick={() => nudgeCursor(-cursorStepSeconds)}>◀</button><button className="mini-play" type="button" onClick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button><button type="button" onClick={() => nudgeCursor(cursorStepSeconds)}>▶</button><label className="step-select"><select value={cursorStep} onChange={(event) => setCursorStep(event.target.value)}>{CURSOR_STEP_OPTIONS.map((step) => <option key={step} value={String(step)}>{String(step).replace('.', ',')} s</option>)}</select></label></div></section>
        <section className="editor-control-card loop-card"><header><span>Loop-Standort <strong>Start {formatPrecise(loopDraftStart)} · Ende {formatPrecise(loopDraftEnd)}</strong></span></header><div className="loop-edge-row"><div><button type="button" onClick={() => nudgeLoopEdge('start', -edgeStepSeconds)}>◀</button><span>Start</span><button type="button" onClick={() => nudgeLoopEdge('start', edgeStepSeconds)}>▶</button></div><label className="step-select"><select value={edgeStep} onChange={(event) => setEdgeStep(event.target.value)}>{LOOP_STEP_OPTIONS.map((step) => <option key={step} value={String(step)}>{String(step).replace('.', ',')} s</option>)}</select></label><div><button type="button" onClick={() => nudgeLoopEdge('end', -edgeStepSeconds)}>◀</button><span>Ende</span><button type="button" onClick={() => nudgeLoopEdge('end', edgeStepSeconds)}>▶</button></div></div><div className="boundary-preview-row"><label><button type="button" onClick={() => previewBoundary('start')}>▶ Vor Start</button><select value={previewLeadStart} onChange={(event) => setPreviewLeadStart(event.target.value)}>{LOOP_PREVIEW_OPTIONS.map((lead) => <option key={lead} value={String(lead)}>{String(lead).replace('.', ',')} s</option>)}</select></label><label><button type="button" onClick={() => previewBoundary('end')}>▶ Vor Ende</button><select value={previewLeadEnd} onChange={(event) => setPreviewLeadEnd(event.target.value)}>{LOOP_PREVIEW_OPTIONS.map((lead) => <option key={lead} value={String(lead)}>{String(lead).replace('.', ',')} s</option>)}</select></label></div></section>
        <section className="editor-control-card marker-card"><header><span>Markierung-Standort <strong>{activeMarker === null ? '--:--.---' : formatPrecise(activeMarker)}</strong></span></header><div className="marker-tabs">{loopMarkers.map((marker, index) => <button key={`${marker}-tab-${index}`} className={activeMarkerIndex === index ? 'selected' : ''} type="button" onClick={() => { setActiveMarkerIndex(index); moveCursorTo(marker, false, true) }}>{markerLabel(index)}</button>)}<button className="add-marker" type="button" onClick={setMarker} disabled={!markersEnabled}>＋</button></div><div className="marker-location-row"><button type="button" onClick={() => nudgeActiveMarker(-markerStepSeconds)} disabled={activeMarker === null}>◀</button><label className="step-select"><select value={markerStep} onChange={(event) => setMarkerStep(event.target.value)}>{LOOP_STEP_OPTIONS.map((step) => <option key={step} value={String(step)}>{String(step).replace('.', ',')} s</option>)}</select></label><button type="button" onClick={() => nudgeActiveMarker(markerStepSeconds)} disabled={activeMarker === null}>▶</button><div className="marker-more-wrap"><button className="marker-more" type="button" onClick={() => setLoopEditorMenuOpen((value) => !value)}>•••</button>{loopEditorMenuOpen && <div className="marker-more-menu"><button type="button" onClick={() => { if (activeMarker !== null) moveCursorTo(activeMarker, false, true); setLoopEditorMenuOpen(false) }} disabled={activeMarker === null}>Cursor hinbewegen</button><button type="button" onClick={() => moveMarkerTarget('focus')} disabled={activeMarker === null}>Zoom hinbewegen</button><button type="button" onClick={() => moveMarkerTarget('start')} disabled={activeMarker === null}>Loop-Anfang hinbewegen</button><button type="button" onClick={() => moveMarkerTarget('end')} disabled={activeMarker === null}>Loop-Ende hinbewegen</button><button type="button" onClick={deleteActiveMarker} disabled={activeMarker === null}>Markierung löschen</button><button type="button" onClick={() => { setLoopEditorMenuOpen(false); setLoopConfirmation('deleteMarkers') }} disabled={!loopMarkers.length}>Alle Markierungen löschen</button></div>}</div></div></section>
      </div>

      <div className="loop-editor-actions"><button className="save-loop" type="button" onClick={() => setLoopConfirmation('save')} disabled={!editorDuration || loopDraftEnd <= loopDraftStart}>Loop speichern</button><button type="button" onClick={() => setLoopEditorSongId(null)}>Abbrechen</button></div>
    </div></div></section>}

    {playlistChooserMode && <div className="playlist-chooser-backdrop" onMouseDown={() => setPlaylistChooserMode(null)}><section className="playlist-chooser" onMouseDown={(event) => event.stopPropagation()}><div className="playlist-chooser-heading"><div><p className="eyebrow">PLAYLISTS</p><h2>{playlistChooserMode === 'bulk' ? `${selectedSongIds.size} Lieder zuordnen` : 'Alle Playlists'}</h2></div><button type="button" onClick={() => setPlaylistChooserMode(null)}>×</button></div><div className="playlist-groups">{groupedPlaylists.map(([group, items]) => <div className="playlist-group" key={group}><strong>{group}</strong><div>{items.map((playlist) => { const contains = currentSong ? playlist.songIds.includes(currentSong.id) : false; return <button key={playlist.id} type="button" onClick={() => playlistChooserMode === 'bulk' ? void assignSelectedToPlaylist(playlist) : void toggleCurrentInPlaylist(playlist)}><span>{playlist.name}</span>{playlistChooserMode === 'current' && <b>{contains ? '−' : '+'}</b>}</button> })}</div></div>)}</div></section></div>}

    {overflowMenu && <><button className="menu-shield" type="button" onClick={() => setOverflowMenu(null)} /><div className="overflow-menu">{overflowMenu.kind === 'playlists' && <><button type="button" onClick={() => beginReorder('sidebar')}>Bearbeiten</button><button type="button" onClick={() => { setOverflowMenu(null); navigateTo({ view: 'playlistOverview', playlistId: activePlaylistId, detailOpen: false }) }}>Übersicht</button></>}{overflowMenu.kind === 'tags' && <button type="button" onClick={() => beginReorder('tags')}>Bearbeiten</button>}{overflowMenu.kind === 'tag' && overflowMenu.id && (() => { const tag = tags.find((item) => item.id === overflowMenu.id); if (!tag) return null; return <><button type="button" onClick={() => beginRename('tag', tag.id)}>Umbenennen</button><button className="danger-menu-action" type="button" onClick={() => { setTagToDelete(tag); setOverflowMenu(null) }}>Löschen</button></> })()}{overflowMenu.kind === 'song' && overflowMenu.id && (() => { const song = songs.find((item) => item.id === overflowMenu.id); if (!song) return null; return <><button type="button" onClick={() => beginRename('song', song.id)}>Umbenennen</button><button type="button" onClick={() => copySong(song.id)}>Kopieren</button><button type="button" disabled={clipboard?.kind !== 'song'} onClick={pasteFromSongMenu}>Einfügen</button><button type="button" onClick={() => openTagChooser('song', [song.id])}>Tags</button><button type="button" onClick={() => void shareSong(song.id)}>Teilen</button><button type="button" onClick={() => openLoopEditor(song.id)}>{song.loopStart !== undefined ? 'Loop bearbeiten' : 'Loop erstellen'}</button>{song.loopStart !== undefined && song.loopEnd !== undefined && <button type="button" onClick={() => void toggleSongLoop(song.id)}>{song.loopEnabled ? 'Loop deaktivieren' : 'Loop aktivieren'}</button>}{song.isNew && <><button className="blue-menu-action" type="button" onClick={() => void markSeen(song.id)}>Als gelesen markieren</button><button className="blue-menu-action" type="button" onClick={() => void markSeen()}>Alle als gelesen markieren</button></>}<button className="danger-menu-action" type="button" onClick={() => { setSongToDelete(song); setOverflowMenu(null) }}>Löschen</button></> })()}{overflowMenu.kind === 'playlist' && overflowMenu.id && (() => { const playlist = playlists.find((item) => item.id === overflowMenu.id); if (!playlist) return null; return <><button type="button" onClick={() => openPlaylistCoverPicker(playlist.id)}>Bild ändern</button><button type="button" onClick={() => beginRename('playlist', playlist.id)}>Umbenennen</button><button type="button" onClick={() => copyPlaylist(playlist.id)}>Kopieren</button><button type="button" disabled={!clipboard} onClick={() => pasteFromPlaylistMenu(playlist.id)}>Einfügen</button><button type="button" onClick={() => openTagChooser('playlist', [playlist.id])}>Tags</button><button type="button" onClick={() => void sharePlaylist(playlist.id)}>Teilen</button><button className="danger-menu-action" type="button" onClick={() => { setPlaylistToDelete(playlist); setOverflowMenu(null) }}>Löschen</button></> })()}</div></>}

    {tagChooserTarget && <div className="playlist-chooser-backdrop tag-chooser-backdrop" onMouseDown={() => setTagChooserTarget(null)}><section className="playlist-chooser tag-chooser" onMouseDown={(event) => event.stopPropagation()}><div className="playlist-chooser-heading"><div><p className="eyebrow">TAGS</p><h2>{tagChooserTarget.kind === 'song' ? `${tagChooserTarget.ids.length} ${tagChooserTarget.ids.length === 1 ? 'Lied' : 'Lieder'}` : `${tagChooserTarget.ids.length} ${tagChooserTarget.ids.length === 1 ? 'Playlist' : 'Playlists'}`} taggen</h2></div><button type="button" onClick={() => setTagChooserTarget(null)}>×</button></div><div className="tag-chooser-list">{sidebarTags.map((tag) => { const ids = tagChooserTarget.kind === 'song' ? tag.songIds : tag.playlistIds; const all = tagChooserTarget.ids.every((id) => ids.includes(id)); const some = !all && tagChooserTarget.ids.some((id) => ids.includes(id)); return <button key={tag.id} type="button" onClick={() => void toggleTargetTag(tag)}><span><i className="tag-dot" style={{ background: tag.color }} /><b>{tag.name}</b></span><small>{tag.songIds.filter((id) => songs.some((song) => song.id === id)).length} Lieder</small><strong>{all ? '✓' : some ? '±' : '+'}</strong></button> })}{!sidebarTags.length && <p className="tag-empty-hint">Erstelle zuerst links unter „Tags“ einen Tag.</p>}</div></section></div>}

    {duplicateConflict && <div className="modal-backdrop duplicate-conflict-backdrop" onMouseDown={cancelDuplicateConflict}><div className="confirm-dialog" onMouseDown={(event) => event.stopPropagation()}><h2>Gleicher Name bereits vorhanden</h2><p>{duplicateConflict.names.length === 1 ? `„${duplicateConflict.names[0]}“ ist am Ziel bereits vorhanden.` : `${duplicateConflict.names.length} gleichnamige Einträge sind am Ziel bereits vorhanden.`} Was soll Josi tun?</p><div className="dialog-actions duplicate-actions"><button type="button" onClick={cancelDuplicateConflict}>Abbrechen</button><button type="button" onClick={() => resolveDuplicateConflict('both')}>Beide einfügen</button><button type="button" onClick={() => resolveDuplicateConflict('replace')}>Ersetzen</button></div></div></div>}
    {tagToDelete && <div className="modal-backdrop" onMouseDown={() => setTagToDelete(null)}><div className="confirm-dialog" onMouseDown={(event) => event.stopPropagation()}><h2>Tag löschen?</h2><p>„{tagToDelete.name}“ wird in den Papierkorb verschoben. Songs und Playlists selbst bleiben erhalten.</p><div className="dialog-actions"><button type="button" onClick={() => setTagToDelete(null)}>Abbrechen</button><button className="danger-button" type="button" onClick={() => void confirmDeleteTag()}>In Papierkorb</button></div></div></div>}

    {loopConfirmation === 'save' && editorSong && <div className="modal-backdrop" onMouseDown={() => setLoopConfirmation(null)}><div className="confirm-dialog" onMouseDown={(event) => event.stopPropagation()}><h2>Loop speichern?</h2><p>Der Bereich {formatPrecise(loopDraftStart)} bis {formatPrecise(loopDraftEnd)} und die aktuellen Markierungen werden gespeichert.</p><div className="dialog-actions"><button type="button" onClick={() => setLoopConfirmation(null)}>Abbrechen</button><button className="save-loop-confirm" type="button" onClick={() => void saveLoopDraft()}>Loop speichern</button></div></div></div>}
    {loopConfirmation === 'delete' && currentSong && <div className="modal-backdrop" onMouseDown={() => setLoopConfirmation(null)}><div className="confirm-dialog" onMouseDown={(event) => event.stopPropagation()}><h2>Loop löschen?</h2><p>Der gespeicherte Loop von „{currentSong.name}“ wird in den Papierkorb verschoben. Die Audiodatei bleibt unverändert.</p><div className="dialog-actions"><button type="button" onClick={() => setLoopConfirmation(null)}>Abbrechen</button><button className="danger-button" type="button" onClick={() => void removeCurrentLoop()}>Loop löschen</button></div></div></div>}
    {loopConfirmation === 'deleteMarkers' && <div className="modal-backdrop" onMouseDown={() => setLoopConfirmation(null)}><div className="confirm-dialog" onMouseDown={(event) => event.stopPropagation()}><h2>Alle Markierungen löschen?</h2><p>Alle orangefarbenen Markierungen dieses Loop-Entwurfs werden entfernt.</p><div className="dialog-actions"><button type="button" onClick={() => setLoopConfirmation(null)}>Abbrechen</button><button className="danger-button" type="button" onClick={deleteAllMarkers}>Alle löschen</button></div></div></div>}

    {trashConfirmation && <div className="modal-backdrop" onMouseDown={() => setTrashConfirmation(false)}><div className="confirm-dialog" onMouseDown={(event) => event.stopPropagation()}><h2>Papierkorb endgültig leeren?</h2><p>{trashCount} {trashCount === 1 ? 'Eintrag wird' : 'Einträge werden'} dauerhaft gelöscht. Audiodateien im Papierkorb können danach nicht wiederhergestellt werden.</p><div className="dialog-actions"><button type="button" onClick={() => setTrashConfirmation(false)}>Abbrechen</button><button className="danger-button" type="button" onClick={() => void emptyTrash()}>Endgültig leeren</button></div></div></div>}
    {sortConfirmation && <div className="modal-backdrop" onMouseDown={() => setSortConfirmation(false)}><div className="confirm-dialog" onMouseDown={(event) => event.stopPropagation()}><h2>Sortierung einmalig übernehmen?</h2><p>Die aktuelle Sortierung „{sortLabels[sortMode]}“ mit der Richtung {sortDirection === 'down' ? '↓' : '↑'} wird als neue manuelle Reihenfolge gespeichert. Danach ändert sie sich nicht automatisch weiter.</p><div className="dialog-actions"><button type="button" onClick={() => setSortConfirmation(false)}>Abbrechen</button><button type="button" onClick={() => void applyCurrentSortAsManual()}>Übernehmen</button></div></div></div>}
    {settingsOpen && <div className="modal-backdrop settings-backdrop" onMouseDown={() => setSettingsOpen(false)}><div className="confirm-dialog settings-dialog" onMouseDown={(event) => event.stopPropagation()}><h2>Einstellungen</h2><div className="settings-row"><div><strong>Spulweite</strong><small>Für ⏪/⏩ und die Detailansicht.</small></div><select value={seekSeconds} onChange={(event) => setSeekSeconds(Number(event.target.value))}>{SEEK_SECOND_OPTIONS.map((value) => <option key={value} value={value}>{value} Sekunden</option>)}</select></div><div className="settings-row settings-info-row"><div><strong>Loop-Übergang</strong><small>Josi überlappt Loop-Ende und Loop-Anfang kurz. Falls der zweite Wiedergabekanal technisch nicht startet, wird lokal nach einem ähnlichen Verbindungspunkt gesucht.</small></div><span className="settings-info-value">Automatisch</span></div><div className="dialog-actions"><button type="button" onClick={() => setSettingsOpen(false)}>Fertig</button></div></div></div>}
    {selectionConfirmation === 'switchManual' && <div className="modal-backdrop selection-confirm-backdrop" onMouseDown={() => setSelectionConfirmation(null)}><div className="confirm-dialog" onMouseDown={(event) => event.stopPropagation()}><h2>Auf „Manuell“ umschalten?</h2><p>Ausgewählte Lieder können nur innerhalb der gespeicherten manuellen Reihenfolge bewegt werden.</p><div className="dialog-actions"><button type="button" onClick={() => setSelectionConfirmation(null)}>Nein</button><button type="button" onClick={() => { setSortMode('manual'); setSelectionConfirmation(null); setBulkMoveMode(true) }}>Ja, umschalten</button></div></div></div>}
    {selectionConfirmation === 'deleteSelected' && <div className="modal-backdrop selection-confirm-backdrop" onMouseDown={() => setSelectionConfirmation(null)}><div className="confirm-dialog" onMouseDown={(event) => event.stopPropagation()}><h2>{selectedSongIds.size} ausgewählte Lieder löschen?</h2><p>Die ausgewählten Lieder werden in den Papierkorb verschoben und aus allen Playlists entfernt.</p><div className="dialog-actions"><button type="button" onClick={() => setSelectionConfirmation(null)}>Abbrechen</button><button className="danger-button" type="button" onClick={() => void deleteSelectedSongs()}>In Papierkorb</button></div></div></div>}
    {renameTarget && <div className="modal-backdrop" onMouseDown={() => setRenameTarget(null)}><form className="confirm-dialog rename-dialog" onSubmit={confirmRename} onMouseDown={(event) => event.stopPropagation()}><h2>Umbenennen</h2><input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} autoFocus /><div className="dialog-actions"><button type="button" onClick={() => setRenameTarget(null)}>Abbrechen</button><button type="submit" disabled={!renameValue.trim()}>Speichern</button></div></form></div>}
    {songToDelete && <div className="modal-backdrop" onMouseDown={() => setSongToDelete(null)}><div className="confirm-dialog" onMouseDown={(event) => event.stopPropagation()}><h2>Lied löschen?</h2><p>„{songToDelete.name}“ wird in den Papierkorb verschoben und aus allen Playlists entfernt. Die Audiodatei bleibt bis zum Leeren des Papierkorbs wiederherstellbar.</p><div className="dialog-actions"><button type="button" onClick={() => setSongToDelete(null)}>Abbrechen</button><button className="danger-button" type="button" onClick={() => void confirmDeleteSong()}>In Papierkorb</button></div></div></div>}
    {playlistToDelete && <div className="modal-backdrop" onMouseDown={() => setPlaylistToDelete(null)}><div className="confirm-dialog" onMouseDown={(event) => event.stopPropagation()}><h2>Playlist löschen?</h2><p>„{playlistToDelete.name}“ wird in den Papierkorb verschoben. Die Musikdateien bleiben erhalten.</p><div className="dialog-actions"><button type="button" onClick={() => setPlaylistToDelete(null)}>Abbrechen</button><button className="danger-button" type="button" onClick={() => void confirmDeletePlaylist()}>In Papierkorb</button></div></div></div>}
  </div>
}

export default App
