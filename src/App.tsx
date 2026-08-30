import { useEffect, useMemo, useRef, useState } from 'react'
import {
  deletePlaylist,
  getPlaylists,
  getSongs,
  savePlaylist,
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

type EditPrompt = 'playlists' | null
type ReorderScope = 'library' | 'playlist' | 'sidebar' | null
type MoveCandidate = { kind: 'song' | 'playlist'; id: string; targetIndex: number | null } | null
type Snapshot = { songs: Song[]; playlists: Playlist[] }
type NavigationEntry = { playlistId: string | null; detailOpen: boolean; playlistOverviewOpen: boolean }

function App() {
  const [songs, setSongs] = useState<Song[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null)
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
  const [detailOpen, setDetailOpen] = useState(false)
  const [playlistOverviewOpen, setPlaylistOverviewOpen] = useState(false)
  const [playHistory, setPlayHistory] = useState<string[]>([])
  const [editPrompt, setEditPrompt] = useState<EditPrompt>(null)
  const [reorderScope, setReorderScope] = useState<ReorderScope>(null)
  const [moveCandidate, setMoveCandidate] = useState<MoveCandidate>(null)
  const [undoStack, setUndoStack] = useState<Snapshot[]>([])
  const [redoStack, setRedoStack] = useState<Snapshot[]>([])
  const [navigation, setNavigation] = useState<NavigationEntry[]>([{ playlistId: null, detailOpen: false, playlistOverviewOpen: false }])
  const [navigationIndex, setNavigationIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const shouldAutoPlayRef = useRef(false)
  const longPressTimerRef = useRef<number | null>(null)

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

  const queue = useMemo(() => {
    if (!activePlaylist) return songs
    const byId = new Map(songs.map((song) => [song.id, song]))
    return activePlaylist.songIds.map((id) => byId.get(id)).filter((song): song is Song => Boolean(song))
  }, [activePlaylist, songs])

  const currentSongPlaylists = useMemo(() => {
    if (!currentSong) return []
    return playlists.filter((playlist) => playlist.songIds.includes(currentSong.id))
  }, [currentSong, playlists])

  const playerPlaylists = useMemo(() => {
    if (!currentSong) return []
    return [...playlists].sort((a, b) => {
      const aContains = a.songIds.includes(currentSong.id)
      const bContains = b.songIds.includes(currentSong.id)
      if (aContains !== bContains) return aContains ? -1 : 1
      return b.lastUsedAt - a.lastUsedAt
    })
  }, [playlists, currentSong])

  useEffect(() => {
    const nextUrls: Record<string, string> = {}
    playlists.forEach((playlist) => {
      if (playlist.cover) nextUrls[playlist.id] = URL.createObjectURL(playlist.cover)
    })
    setCoverUrls(nextUrls)
    return () => Object.values(nextUrls).forEach((url) => URL.revokeObjectURL(url))
  }, [playlists])

  useEffect(() => {
    if (!currentSong) {
      setCurrentUrl(null)
      return
    }
    const url = URL.createObjectURL(currentSong.file)
    setCurrentUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [currentSong])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentUrl) return
    audio.load()
    if (shouldAutoPlayRef.current) audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
  }, [currentUrl])

  const snapshot = (): Snapshot => ({ songs: [...songs], playlists: [...playlists] })

  const recordHistory = () => {
    setUndoStack((items) => [...items, snapshot()].slice(-50))
    setRedoStack([])
  }

  const persistSnapshot = async (target: Snapshot, previousPlaylists: Playlist[]) => {
    const targetIds = new Set(target.playlists.map((playlist) => playlist.id))
    await saveSongOrder(target.songs)
    await Promise.all(previousPlaylists.filter((playlist) => !targetIds.has(playlist.id)).map((playlist) => deletePlaylist(playlist.id)))
    await Promise.all(target.playlists.map((playlist) => savePlaylist(playlist)))
  }

  const restoreSnapshot = async (target: Snapshot) => {
    const previousPlaylists = playlists
    setSongs(target.songs)
    setPlaylists(target.playlists)
    if (activePlaylistId && !target.playlists.some((playlist) => playlist.id === activePlaylistId)) setActivePlaylistId(null)
    await persistSnapshot(target, previousPlaylists)
  }

  const updatePlaylist = async (updated: Playlist, addHistory = false) => {
    if (addHistory) recordHistory()
    setPlaylists((items) => items.map((item) => item.id === updated.id ? updated : item))
    await savePlaylist(updated)
  }

  const applyNavigation = (entry: NavigationEntry) => {
    setActivePlaylistId(entry.playlistId)
    setDetailOpen(entry.detailOpen)
    setPlaylistOverviewOpen(entry.playlistOverviewOpen)
    setIsEditingPlaylist(false)
    setEditPrompt(null)
    setMoveCandidate(null)
  }

  const navigateTo = (entry: NavigationEntry) => {
    const current = navigation[navigationIndex]
    if (current && current.playlistId === entry.playlistId && current.detailOpen === entry.detailOpen && current.playlistOverviewOpen === entry.playlistOverviewOpen) return
    setNavigation((items) => [...items.slice(0, navigationIndex + 1), entry].slice(-60))
    setNavigationIndex((index) => Math.min(index + 1, 59))
    applyNavigation(entry)
  }

  const navigateBack = () => {
    if (navigationIndex <= 0) return
    const nextIndex = navigationIndex - 1
    setNavigationIndex(nextIndex)
    applyNavigation(navigation[nextIndex])
  }

  const navigateForward = () => {
    if (navigationIndex >= navigation.length - 1) return
    const nextIndex = navigationIndex + 1
    setNavigationIndex(nextIndex)
    applyNavigation(navigation[nextIndex])
  }

  const playSong = (id: string, rememberCurrent = true) => {
    if (id === currentSongId && audioRef.current) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
      return
    }
    if (rememberCurrent && currentSongId) setPlayHistory((history) => [...history, currentSongId].slice(-50))
    shouldAutoPlayRef.current = true
    setCurrentSongId(id)
    setCurrentTime(0)
  }

  const moveSong = (direction: 1 | -1) => {
    if (!queue.length) return
    const currentIndex = queue.findIndex((song) => song.id === currentSongId)
    if (shuffle && direction === 1 && queue.length > 1) {
      const choices = queue.filter((song) => song.id !== currentSongId)
      playSong(choices[Math.floor(Math.random() * choices.length)].id)
      return
    }
    const nextIndex = currentIndex < 0 ? (direction === 1 ? 0 : queue.length - 1) : currentIndex + direction
    if (nextIndex >= 0 && nextIndex < queue.length) return playSong(queue[nextIndex].id)
    if (repeatQueue) return playSong(queue[direction === 1 ? 0 : queue.length - 1].id)
    setIsPlaying(false)
    shouldAutoPlayRef.current = false
  }

  const playPreviousFromHistory = () => {
    const previousId = playHistory[playHistory.length - 1]
    if (!previousId) return
    setPlayHistory((history) => history.slice(0, -1))
    playSong(previousId, false)
  }

  const togglePlayback = () => {
    const audio = audioRef.current
    if (!currentSong) {
      if (queue[0]) playSong(queue[0].id)
      return
    }
    if (!audio) return
    if (audio.paused) {
      shouldAutoPlayRef.current = true
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }

  const skipSeconds = (seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    const next = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + seconds))
    audio.currentTime = next
    setCurrentTime(next)
  }

  const seek = (value: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = value
    setCurrentTime(value)
  }

  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    if (currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: currentSong.name, artist: 'Josi' })
    } else {
      navigator.mediaSession.metadata = null
    }
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'

    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler | null]> = [
      ['play', () => {
        const audio = audioRef.current
        if (audio) audio.play().catch(() => undefined)
      }],
      ['pause', () => audioRef.current?.pause()],
      ['previoustrack', () => moveSong(-1)],
      ['nexttrack', () => moveSong(1)],
      ['seekbackward', (details) => skipSeconds(-(details.seekOffset ?? 10))],
      ['seekforward', (details) => skipSeconds(details.seekOffset ?? 10)],
      ['seekto', (details) => {
        if (details.seekTime !== undefined) seek(details.seekTime)
      }],
    ]

    handlers.forEach(([action, handler]) => {
      try { navigator.mediaSession.setActionHandler(action, handler) } catch { /* unsupported action */ }
    })

    return () => {
      handlers.forEach(([action]) => {
        try { navigator.mediaSession.setActionHandler(action, null) } catch { /* unsupported action */ }
      })
    }
  }, [currentSong?.id, isPlaying, queue, shuffle, repeatQueue])

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const audioFiles = Array.from(files).filter((file) => file.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(file.name))
    if (!audioFiles.length) return setMessage('Keine unterstützten Audiodateien ausgewählt.')
    try {
      const imported = await saveSongs(audioFiles)
      setSongs((existing) => [...existing, ...imported])
      setMessage(`${imported.length} ${imported.length === 1 ? 'Song wurde' : 'Songs wurden'} importiert.`)
    } catch {
      setMessage('Import fehlgeschlagen. Möglicherweise ist der lokale Speicher voll.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const createPlaylist = async (event: React.FormEvent) => {
    event.preventDefault()
    const name = playlistName.trim()
    if (!name) return
    recordHistory()
    const playlist: Playlist = { id: crypto.randomUUID(), name, songIds: [], createdAt: Date.now(), lastUsedAt: Date.now(), sortOrder: -Date.now() }
    await savePlaylist(playlist)
    setPlaylists((existing) => [playlist, ...existing])
    setPlaylistName('')
    navigateTo({ playlistId: playlist.id, detailOpen: false, playlistOverviewOpen: false })
  }

  const openPlaylist = async (id: string | null) => {
    if (reorderScope === 'sidebar') return
    navigateTo({ playlistId: id, detailOpen: false, playlistOverviewOpen: false })
    if (!id) return
    const playlist = playlists.find((item) => item.id === id)
    if (playlist) await updatePlaylist({ ...playlist, lastUsedAt: Date.now() })
  }

  const togglePlaylistSong = async (playlist: Playlist) => {
    if (!currentSong) return
    const contains = playlist.songIds.includes(currentSong.id)
    await updatePlaylist({
      ...playlist,
      songIds: contains ? playlist.songIds.filter((id) => id !== currentSong.id) : [...playlist.songIds, currentSong.id],
      lastUsedAt: Date.now(),
    }, true)
  }

  const removeSongFromActivePlaylist = async (songId: string) => {
    if (!activePlaylist) return
    await updatePlaylist({ ...activePlaylist, songIds: activePlaylist.songIds.filter((id) => id !== songId), lastUsedAt: Date.now() }, true)
  }

  const startLongPress = () => {
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = window.setTimeout(() => {
      setEditPrompt('playlists')
      longPressTimerRef.current = null
    }, 1000)
  }

  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const beginReorder = (scope: Exclude<ReorderScope, null>) => {
    setReorderScope(scope)
    setMoveCandidate(null)
    setEditPrompt(null)
  }

  const finishReorder = () => {
    setMoveCandidate(null)
    setReorderScope(null)
  }

  const chooseMoveItem = (kind: 'song' | 'playlist', id: string) => setMoveCandidate({ kind, id, targetIndex: null })
  const chooseTarget = (targetIndex: number) => setMoveCandidate((candidate) => candidate ? { ...candidate, targetIndex } : candidate)
  const cancelPendingMove = () => setMoveCandidate(null)

  const reorderIds = (ids: string[], sourceId: string, targetIndex: number) => {
    const sourceIndex = ids.indexOf(sourceId)
    if (sourceIndex < 0) return ids
    const next = [...ids]
    const [moved] = next.splice(sourceIndex, 1)
    const adjustedTarget = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex
    next.splice(Math.max(0, Math.min(adjustedTarget, next.length)), 0, moved)
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
      await Promise.all(updated.map((playlist) => savePlaylist(playlist)))
      setMoveCandidate(null)
      return
    }

    if (reorderScope === 'playlist' && activePlaylist) {
      const songIds = reorderIds(activePlaylist.songIds, moveCandidate.id, moveCandidate.targetIndex)
      const updated = { ...activePlaylist, songIds, lastUsedAt: Date.now() }
      setPlaylists((items) => items.map((item) => item.id === updated.id ? updated : item))
      await savePlaylist(updated)
      setMoveCandidate(null)
      return
    }

    const ids = reorderIds(songs.map((song) => song.id), moveCandidate.id, moveCandidate.targetIndex)
    const byId = new Map(songs.map((song) => [song.id, song]))
    const ordered = ids.map((id, index) => ({ ...byId.get(id)!, libraryOrder: index }))
    setSongs(ordered)
    await saveSongOrder(ordered)
    setMoveCandidate(null)
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
    if (!activePlaylist || !files?.[0]) return
    const cover = files[0]
    if (!cover.type.startsWith('image/')) return setMessage('Bitte wähle eine Bilddatei aus.')
    await updatePlaylist({ ...activePlaylist, cover, lastUsedAt: Date.now() }, true)
    if (coverInputRef.current) coverInputRef.current.value = ''
  }

  const confirmDeletePlaylist = async () => {
    if (!playlistToDelete) return
    recordHistory()
    await deletePlaylist(playlistToDelete.id)
    setPlaylists((items) => items.filter((item) => item.id !== playlistToDelete.id))
    if (activePlaylistId === playlistToDelete.id) navigateTo({ playlistId: null, detailOpen: false, playlistOverviewOpen: false })
    setPlaylistToDelete(null)
  }

  const membershipText = (songId: string) => {
    const names = playlists.filter((playlist) => playlist.songIds.includes(songId)).map((playlist) => playlist.name)
    return names.length ? names.join(' · ') : 'In keiner Playlist'
  }

  const songEditMode = reorderScope === (activePlaylist ? 'playlist' : 'library')

  const renderDropZone = (index: number, kind: 'song' | 'playlist') => {
    if (!moveCandidate || moveCandidate.kind !== kind) return null
    return <button className={`drop-zone${moveCandidate.targetIndex === index ? ' selected' : ''}`} type="button" onClick={() => chooseTarget(index)} aria-label={`An Position ${index + 1} verschieben`}><span /></button>
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="history-controls" aria-label="Navigation">
          <button type="button" onClick={navigateBack} disabled={navigationIndex === 0} aria-label="Zurück">‹</button>
          <button type="button" onClick={navigateForward} disabled={navigationIndex >= navigation.length - 1} aria-label="Vor">›</button>
          {moveCandidate && <>
            <button className="confirm-move" type="button" onClick={() => void confirmPendingMove()} disabled={moveCandidate.targetIndex === null} aria-label="Verschieben bestätigen">✓</button>
            <button className="cancel-move" type="button" onClick={cancelPendingMove} aria-label="Verschieben abbrechen">×</button>
          </>}
        </div>
        <button className="import-button" type="button" onClick={() => fileInputRef.current?.click()}>+ Musik importieren</button>
        <input ref={fileInputRef} className="file-input" type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac" multiple onChange={(event) => importFiles(event.target.files)} />
      </header>

      {!playlistOverviewOpen && <main className="music-layout">
        <aside className="sidebar">
          <button className={`nav-item${activePlaylistId === null ? ' active' : ''}`} type="button" onClick={() => void openPlaylist(null)} disabled={reorderScope === 'sidebar'}>
            <span>Bibliothek</span><strong>{songs.length}</strong>
          </button>

          <div className="sidebar-heading heading-with-popover">
            <button className="heading-longpress" type="button" onPointerDown={startLongPress} onPointerUp={cancelLongPress} onPointerCancel={cancelLongPress} onPointerLeave={cancelLongPress} onContextMenu={(event) => event.preventDefault()}>Playlists</button>
            {reorderScope === 'sidebar' && <button className="finish-inline" type="button" onClick={finishReorder}>Fertig</button>}
            {editPrompt === 'playlists' && <div className="edit-popover playlist-menu"><button type="button" onClick={() => beginReorder('sidebar')}>Bearbeiten</button><button type="button" onClick={() => navigateTo({ playlistId: activePlaylistId, detailOpen: false, playlistOverviewOpen: true })}>Übersicht</button></div>}
          </div>

          <div className="playlist-nav">
            {renderDropZone(0, 'playlist')}
            {sidebarPlaylists.map((playlist, index) => (
              <div key={playlist.id} className={`playlist-nav-row${moveCandidate?.kind === 'playlist' && moveCandidate.id === playlist.id ? ' move-source' : ''}`}>
                {reorderScope === 'sidebar' && <button className="move-selector" type="button" onClick={() => chooseMoveItem('playlist', playlist.id)} aria-label={`${playlist.name} zum Verschieben auswählen`}>↕</button>}
                <button className={`nav-item${activePlaylistId === playlist.id ? ' active' : ''}`} type="button" onClick={() => void openPlaylist(playlist.id)} disabled={reorderScope === 'sidebar'}>
                  <span className="playlist-nav-name">{coverUrls[playlist.id] ? <img src={coverUrls[playlist.id]} alt="" /> : <span className="playlist-mini-cover">♫</span>}<span>{playlist.name}</span></span>
                  <strong>{playlist.songIds.length}</strong>
                </button>
                {renderDropZone(index + 1, 'playlist')}
              </div>
            ))}
          </div>

          <form className="new-playlist" onSubmit={createPlaylist}>
            <input value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} placeholder="Neue Playlist" aria-label="Name der neuen Playlist" disabled={reorderScope === 'sidebar'} />
            <button type="submit" disabled={!playlistName.trim() || reorderScope === 'sidebar'} aria-label="Playlist erstellen">+</button>
          </form>
        </aside>

        <section className="library-panel">
          <div className={`library-heading${activePlaylist ? ' playlist-heading' : ''}`}>
            {activePlaylist && <button className="playlist-cover" type="button" onClick={() => coverInputRef.current?.click()} aria-label="Playlist-Bild ändern">{coverUrls[activePlaylist.id] ? <img src={coverUrls[activePlaylist.id]} alt="" /> : <span>+ Bild</span>}</button>}
            <div className="library-title">
              <p className="eyebrow">{activePlaylist ? 'PLAYLIST' : 'DEINE MUSIK'}</p>
              {activePlaylist && isEditingPlaylist ? (
                <form className="rename-playlist" onSubmit={savePlaylistName}>
                  <input value={editingName} onChange={(event) => setEditingName(event.target.value)} autoFocus aria-label="Playlist-Name" />
                  <button type="submit" disabled={!editingName.trim()}>Speichern</button>
                  <button type="button" onClick={() => setIsEditingPlaylist(false)}>Abbrechen</button>
                </form>
              ) : <h1>{activePlaylist?.name ?? 'Bibliothek'}</h1>}
              <p>{queue.length} {queue.length === 1 ? 'Song' : 'Songs'}</p>
            </div>
            <div className="playlist-actions">
              {activePlaylist && <>
                <button type="button" onClick={startEditingPlaylist}>Name ändern</button>
                <button type="button" onClick={() => coverInputRef.current?.click()}>Bild ändern</button>
                <button className={reorderScope === 'playlist' ? 'active-action' : ''} type="button" onClick={() => reorderScope === 'playlist' ? finishReorder() : beginReorder('playlist')}>{reorderScope === 'playlist' ? 'Fertig' : 'Reihenfolge ändern'}</button>
                <button className="danger-button" type="button" onClick={() => setPlaylistToDelete(activePlaylist)}>Playlist löschen</button>
                <input ref={coverInputRef} className="file-input" type="file" accept="image/*" onChange={(event) => changePlaylistCover(event.target.files)} />
              </>}
              {!activePlaylist && <button className={reorderScope === 'library' ? 'active-action' : ''} type="button" onClick={() => reorderScope === 'library' ? finishReorder() : beginReorder('library')}>{reorderScope === 'library' ? 'Fertig' : 'Reihenfolge ändern'}</button>}
            </div>
          </div>

          {message && <div className="message" role="status">{message}</div>}
          {songEditMode && <div className="reorder-hint">Wähle links einen Song aus, scrolle zur Zielstelle und tippe zwischen zwei Songs. Der rote Strich markiert die neue Position. Bestätige oben mit ✓ oder brich mit × ab.</div>}

          {queue.length ? (
            <div className="song-list">
              {renderDropZone(0, 'song')}
              {queue.map((song, index) => (
                <div key={song.id} className={`song-row${moveCandidate?.kind === 'song' && moveCandidate.id === song.id ? ' move-source' : ''}`}>
                  {songEditMode && <button className="move-selector" type="button" onClick={() => chooseMoveItem('song', song.id)} aria-label={`${song.name} zum Verschieben auswählen`}>↕</button>}
                  <button className="song-main" type="button" onClick={() => playSong(song.id)} disabled={songEditMode}>
                    <span className="song-number">{song.id === currentSongId && isPlaying ? '▶' : index + 1}</span>
                    <span className="song-copy"><strong>{song.name}</strong><small>{membershipText(song.id)}</small></span>
                    <span className="song-action">▶</span>
                  </button>
                  {activePlaylist && !songEditMode && <button className="remove-song" type="button" onClick={() => void removeSongFromActivePlaylist(song.id)}>Entfernen</button>}
                  {renderDropZone(index + 1, 'song')}
                </div>
              ))}
            </div>
          ) : <div className="empty-state"><div className="empty-icon">♫</div><h2>{activePlaylist ? 'Noch keine Songs in dieser Playlist.' : 'Noch keine Musik importiert.'}</h2></div>}
        </section>
      </main>}

      {playlistOverviewOpen && <section className="playlist-overview" aria-label="Playlist-Übersicht">
        <div className="playlist-overview-heading"><p className="eyebrow">DEINE MUSIK</p><h1>Playlists</h1><p>{sidebarPlaylists.length} {sidebarPlaylists.length === 1 ? 'Playlist' : 'Playlists'}</p></div>
        <div className="playlist-grid">
          {sidebarPlaylists.map((playlist) => <button key={playlist.id} className="playlist-card" type="button" onClick={() => void openPlaylist(playlist.id)}>
            <span className="playlist-card-cover">{coverUrls[playlist.id] ? <img src={coverUrls[playlist.id]} alt="" /> : <span>♫</span>}</span>
            <strong>{playlist.name}</strong>
            <small>{playlist.songIds.length} {playlist.songIds.length === 1 ? 'Lied' : 'Lieder'}</small>
          </button>)}
        </div>
      </section>}

      <section className={`player${currentSong ? ' visible' : ''}`} aria-label="Player">
        <audio ref={audioRef} src={currentUrl ?? undefined} playsInline onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => moveSong(1)} />
        <button className="now-playing" type="button" onClick={() => currentSong && navigateTo({ playlistId: activePlaylistId, detailOpen: true, playlistOverviewOpen: false })} disabled={!currentSong}>
          <span className="cover-placeholder">♫</span><span className="now-playing-copy"><small>JETZT</small><span className="marquee"><strong>{currentSong?.name ?? 'Kein Song ausgewählt'}</strong></span></span>
        </button>
        <div className="transport">
          <div className="transport-buttons">
            <button className={shuffle ? 'active-control' : ''} type="button" onClick={() => setShuffle((value) => !value)}>⇄</button>
            <button type="button" onClick={() => moveSong(-1)}>⏮</button>
            <button className="play-button" type="button" onClick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button>
            <button type="button" onClick={() => moveSong(1)}>⏭</button>
            <button className={repeatQueue ? 'active-control' : ''} type="button" onClick={() => setRepeatQueue((value) => !value)}>↻</button>
          </div>
          <div className="progress-row"><span>{formatTime(currentTime)}</span><input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(Number(event.target.value))} /><span>{formatTime(duration)}</span></div>
        </div>
        <div className="quick-playlists"><div className="quick-heading"><strong>Playlists</strong></div><div className="quick-list">
          {playerPlaylists.length ? playerPlaylists.map((playlist) => {
            const contains = currentSong ? playlist.songIds.includes(currentSong.id) : false
            return <button key={playlist.id} type="button" className={contains ? 'included' : ''} onClick={() => void togglePlaylistSong(playlist)} disabled={!currentSong}><span>{playlist.name}</span><strong>{contains ? '−' : '+'}</strong></button>
          }) : <span className="no-playlists">Noch keine Playlist</span>}
        </div></div>
      </section>

      {detailOpen && currentSong && <section className="song-detail" aria-label="Songdetails">
        <div className="detail-topbar"><button type="button" onClick={navigateBack}>‹ Zurück</button></div>
        <div className="detail-content"><p className="detail-label">JETZT</p><h2>{currentSong.name}</h2>
          <div className="playlist-membership"><span>IN PLAYLISTS</span><strong>{currentSongPlaylists.length ? currentSongPlaylists.map((playlist) => playlist.name).join(' · ') : 'In keiner Playlist'}</strong></div>
          <div className="detail-progress"><input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(Number(event.target.value))} /><div><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div></div>
          <div className="detail-controls"><button type="button" onClick={playPreviousFromHistory} disabled={!playHistory.length}>⏮</button><button type="button" onClick={() => skipSeconds(-10)}>↶<small>10</small></button><button className="detail-play" type="button" onClick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button><button type="button" onClick={() => skipSeconds(10)}>↷<small>10</small></button><button type="button" onClick={() => moveSong(1)}>⏭</button></div>
        </div>
      </section>}

      {editPrompt && <button className="edit-popover-shield" type="button" aria-label="Menü schließen" onClick={() => setEditPrompt(null)} />}
      {playlistToDelete && <div className="modal-backdrop" onMouseDown={() => setPlaylistToDelete(null)}><div className="confirm-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><h2>Playlist löschen?</h2><p>„{playlistToDelete.name}“ wird gelöscht. Die Musikdateien bleiben erhalten.</p><div className="dialog-actions"><button type="button" onClick={() => setPlaylistToDelete(null)}>Abbrechen</button><button className="danger-button" type="button" onClick={() => void confirmDeletePlaylist()}>Playlist löschen</button></div></div></div>}
    </div>
  )
}

export default App
