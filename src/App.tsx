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

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

type EditPrompt = 'library' | 'playlists' | null

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
  const [isReordering, setIsReordering] = useState(false)
  const [isLibraryReordering, setIsLibraryReordering] = useState(false)
  const [isSidebarReordering, setIsSidebarReordering] = useState(false)
  const [editPrompt, setEditPrompt] = useState<EditPrompt>(null)
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null)
  const [message, setMessage] = useState('')
  const [draggedSongId, setDraggedSongId] = useState<string | null>(null)
  const [draggedPlaylistId, setDraggedPlaylistId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [playHistory, setPlayHistory] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const libraryScrollRef = useRef<HTMLElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const shouldAutoPlayRef = useRef(false)
  const reorderOrderRef = useRef<string[]>([])
  const playlistOrderRef = useRef<string[]>([])
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
  const queue = useMemo(() => {
    if (!activePlaylist) return songs
    const byId = new Map(songs.map((song) => [song.id, song]))
    return activePlaylist.songIds.map((id) => byId.get(id)).filter((song): song is Song => Boolean(song))
  }, [activePlaylist, songs])

  const sidebarPlaylists = useMemo(() => [...playlists].sort((a, b) => {
    if (a.sortOrder !== undefined || b.sortOrder !== undefined) {
      return (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) || b.lastUsedAt - a.lastUsedAt
    }
    return b.lastUsedAt - a.lastUsedAt
  }), [playlists])

  const currentSongPlaylists = useMemo(() => {
    if (!currentSong) return []
    return playlists.filter((playlist) => playlist.songIds.includes(currentSong.id))
  }, [currentSong, playlists])

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
    if (shouldAutoPlayRef.current) {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    }
  }, [currentUrl])

  const updatePlaylist = async (updated: Playlist) => {
    setPlaylists((items) => items.map((item) => item.id === updated.id ? updated : item))
    await savePlaylist(updated)
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
    if (nextIndex >= 0 && nextIndex < queue.length) {
      playSong(queue[nextIndex].id)
      return
    }
    if (repeatQueue) {
      playSong(queue[direction === 1 ? 0 : queue.length - 1].id)
      return
    }
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

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const audioFiles = Array.from(files).filter((file) => file.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(file.name))
    if (!audioFiles.length) {
      setMessage('Keine unterstützten Audiodateien ausgewählt.')
      return
    }
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
    const playlist: Playlist = {
      id: crypto.randomUUID(),
      name,
      songIds: [],
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      sortOrder: -Date.now(),
    }
    await savePlaylist(playlist)
    setPlaylists((existing) => [playlist, ...existing])
    setPlaylistName('')
    setActivePlaylistId(playlist.id)
  }

  const openPlaylist = async (id: string | null) => {
    if (isSidebarReordering) return
    setActivePlaylistId(id)
    setIsEditingPlaylist(false)
    setIsReordering(false)
    setIsLibraryReordering(false)
    setDraggedSongId(null)
    reorderOrderRef.current = []
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
    })
  }

  const removeSongFromActivePlaylist = async (songId: string) => {
    if (!activePlaylist) return
    await updatePlaylist({ ...activePlaylist, songIds: activePlaylist.songIds.filter((id) => id !== songId), lastUsedAt: Date.now() })
  }

  const toggleReorderMode = () => {
    setDraggedSongId(null)
    reorderOrderRef.current = []
    setIsReordering((value) => !value)
  }

  const startLongPress = (target: Exclude<EditPrompt, null>) => {
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = window.setTimeout(() => {
      setEditPrompt(target)
      longPressTimerRef.current = null
    }, 1000)
  }

  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const activatePrompt = () => {
    if (editPrompt === 'library') setIsLibraryReordering(true)
    if (editPrompt === 'playlists') setIsSidebarReordering(true)
    setEditPrompt(null)
  }

  const beginSongReorder = (songId: string, event: React.PointerEvent<HTMLButtonElement>) => {
    const canReorder = activePlaylist ? isReordering : isLibraryReordering
    if (!canReorder) return
    event.preventDefault()
    reorderOrderRef.current = activePlaylist ? [...activePlaylist.songIds] : songs.map((song) => song.id)
    setDraggedSongId(songId)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveSongReorder = (event: React.PointerEvent<HTMLButtonElement>) => {
    const canReorder = activePlaylist ? isReordering : isLibraryReordering
    if (!canReorder || !draggedSongId) return
    event.preventDefault()
    const scrollArea = libraryScrollRef.current
    if (scrollArea) {
      const rect = scrollArea.getBoundingClientRect()
      if (event.clientY < rect.top + 90) scrollArea.scrollBy(0, -18)
      if (event.clientY > rect.bottom - 90) scrollArea.scrollBy(0, 18)
    }
    const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-song-id]')
    const targetSongId = row?.dataset.songId
    if (!targetSongId || targetSongId === draggedSongId) return
    const songIds = [...reorderOrderRef.current]
    const fromIndex = songIds.indexOf(draggedSongId)
    const toIndex = songIds.indexOf(targetSongId)
    if (fromIndex < 0 || toIndex < 0) return
    const [moved] = songIds.splice(fromIndex, 1)
    songIds.splice(toIndex, 0, moved)
    reorderOrderRef.current = songIds
    if (activePlaylist) {
      setPlaylists((items) => items.map((item) => item.id === activePlaylist.id ? { ...item, songIds } : item))
    } else {
      const byId = new Map(songs.map((song) => [song.id, song]))
      setSongs(songIds.map((id) => byId.get(id)).filter((song): song is Song => Boolean(song)))
    }
  }

  const finishSongReorder = async () => {
    if (!draggedSongId) return
    const songIds = [...reorderOrderRef.current]
    setDraggedSongId(null)
    reorderOrderRef.current = []
    if (activePlaylist) {
      await updatePlaylist({ ...activePlaylist, songIds, lastUsedAt: Date.now() })
      return
    }
    const byId = new Map(songs.map((song) => [song.id, song]))
    const ordered = songIds.map((id, index) => {
      const song = byId.get(id)
      return song ? { ...song, libraryOrder: index } : null
    }).filter((song): song is Song => Boolean(song))
    setSongs(ordered)
    await saveSongOrder(ordered)
  }

  const beginPlaylistReorder = (playlistId: string, event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isSidebarReordering) return
    event.preventDefault()
    playlistOrderRef.current = sidebarPlaylists.map((playlist) => playlist.id)
    setDraggedPlaylistId(playlistId)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const movePlaylistReorder = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isSidebarReordering || !draggedPlaylistId) return
    event.preventDefault()
    const scrollArea = sidebarRef.current
    if (scrollArea) {
      const rect = scrollArea.getBoundingClientRect()
      if (event.clientY < rect.top + 70) scrollArea.scrollBy(0, -16)
      if (event.clientY > rect.bottom - 70) scrollArea.scrollBy(0, 16)
    }
    const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-playlist-id]')
    const targetId = row?.dataset.playlistId
    if (!targetId || targetId === draggedPlaylistId) return
    const ids = [...playlistOrderRef.current]
    const fromIndex = ids.indexOf(draggedPlaylistId)
    const toIndex = ids.indexOf(targetId)
    if (fromIndex < 0 || toIndex < 0) return
    const [moved] = ids.splice(fromIndex, 1)
    ids.splice(toIndex, 0, moved)
    playlistOrderRef.current = ids
    const order = new Map(ids.map((id, index) => [id, index]))
    setPlaylists((items) => items.map((playlist) => ({ ...playlist, sortOrder: order.get(playlist.id) ?? playlist.sortOrder })))
  }

  const finishPlaylistReorder = async () => {
    if (!draggedPlaylistId) return
    const ids = [...playlistOrderRef.current]
    setDraggedPlaylistId(null)
    playlistOrderRef.current = []
    const order = new Map(ids.map((id, index) => [id, index]))
    const updated = playlists.map((playlist) => ({ ...playlist, sortOrder: order.get(playlist.id) ?? playlist.sortOrder }))
    setPlaylists(updated)
    await Promise.all(updated.map((playlist) => savePlaylist(playlist)))
  }

  const startEditingPlaylist = () => {
    if (!activePlaylist) return
    setEditingName(activePlaylist.name)
    setIsEditingPlaylist(true)
  }

  const savePlaylistName = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!activePlaylist) return
    const name = editingName.trim()
    if (!name) return
    await updatePlaylist({ ...activePlaylist, name, lastUsedAt: Date.now() })
    setIsEditingPlaylist(false)
  }

  const changePlaylistCover = async (files: FileList | null) => {
    if (!activePlaylist || !files?.[0]) return
    const cover = files[0]
    if (!cover.type.startsWith('image/')) {
      setMessage('Bitte wähle eine Bilddatei aus.')
      return
    }
    await updatePlaylist({ ...activePlaylist, cover, lastUsedAt: Date.now() })
    if (coverInputRef.current) coverInputRef.current.value = ''
  }

  const confirmDeletePlaylist = async () => {
    if (!playlistToDelete) return
    await deletePlaylist(playlistToDelete.id)
    setPlaylists((items) => items.filter((item) => item.id !== playlistToDelete.id))
    if (activePlaylistId === playlistToDelete.id) setActivePlaylistId(null)
    setPlaylistToDelete(null)
    setMessage('Playlist wurde gelöscht. Deine Musikdateien bleiben erhalten.')
  }

  const playerPlaylists = useMemo(() => {
    if (!currentSong) return []
    return [...playlists].sort((a, b) => {
      const aContains = a.songIds.includes(currentSong.id)
      const bContains = b.songIds.includes(currentSong.id)
      if (aContains !== bContains) return aContains ? -1 : 1
      return b.lastUsedAt - a.lastUsedAt
    })
  }, [playlists, currentSong])

  const seek = (value: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = value
    setCurrentTime(value)
  }

  const songReordering = activePlaylist ? isReordering : isLibraryReordering

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" type="button" onClick={() => openPlaylist(null)} aria-label="Musikbibliothek öffnen">Josi</button>
        <button className="import-button" type="button" onClick={() => fileInputRef.current?.click()}>+ Musik importieren</button>
        <input ref={fileInputRef} className="file-input" type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac" multiple onChange={(event) => importFiles(event.target.files)} />
      </header>

      <main className="music-layout">
        <aside className="sidebar" ref={sidebarRef}>
          <button className={`nav-item${activePlaylistId === null ? ' active' : ''}`} type="button" onClick={() => openPlaylist(null)} disabled={isSidebarReordering}>
            <span>Bibliothek</span><strong>{songs.length}</strong>
          </button>

          <div className="sidebar-heading heading-with-popover">
            <button
              className="heading-longpress"
              type="button"
              onPointerDown={() => startLongPress('playlists')}
              onPointerUp={cancelLongPress}
              onPointerCancel={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onContextMenu={(event) => event.preventDefault()}
            >Playlists</button>
            {isSidebarReordering && <button className="finish-inline" type="button" onClick={() => setIsSidebarReordering(false)}>Fertig</button>}
            {editPrompt === 'playlists' && <div className="edit-popover"><button type="button" onClick={activatePrompt}>Bearbeiten</button></div>}
          </div>

          <div className={`playlist-nav${isSidebarReordering ? ' reordering' : ''}`}>
            {sidebarPlaylists.map((playlist) => (
              <div key={playlist.id} data-playlist-id={playlist.id} className={`playlist-nav-row${draggedPlaylistId === playlist.id ? ' dragging' : ''}`}>
                {isSidebarReordering && (
                  <button className="playlist-drag-handle" type="button" aria-label={`${playlist.name} verschieben`} onPointerDown={(event) => beginPlaylistReorder(playlist.id, event)} onPointerMove={movePlaylistReorder} onPointerUp={() => void finishPlaylistReorder()} onPointerCancel={() => void finishPlaylistReorder()}>⋮⋮</button>
                )}
                <button className={`nav-item${activePlaylistId === playlist.id ? ' active' : ''}`} type="button" onClick={() => openPlaylist(playlist.id)} disabled={isSidebarReordering}>
                  <span className="playlist-nav-name">{coverUrls[playlist.id] ? <img src={coverUrls[playlist.id]} alt="" /> : <span className="playlist-mini-cover">♫</span>}<span>{playlist.name}</span></span>
                  <strong>{playlist.songIds.length}</strong>
                </button>
              </div>
            ))}
          </div>

          <form className="new-playlist" onSubmit={createPlaylist}>
            <input value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} placeholder="Neue Playlist" aria-label="Name der neuen Playlist" disabled={isSidebarReordering} />
            <button type="submit" disabled={!playlistName.trim() || isSidebarReordering} aria-label="Playlist erstellen">+</button>
          </form>
        </aside>

        <section className="library-panel" ref={libraryScrollRef}>
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
              ) : activePlaylist ? <h1>{activePlaylist.name}</h1> : (
                <div className="library-heading-trigger heading-with-popover">
                  <button
                    className="library-name-trigger"
                    type="button"
                    onPointerDown={() => startLongPress('library')}
                    onPointerUp={cancelLongPress}
                    onPointerCancel={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onContextMenu={(event) => event.preventDefault()}
                  >Bibliothek</button>
                  {isLibraryReordering && <button className="finish-inline" type="button" onClick={() => setIsLibraryReordering(false)}>Fertig</button>}
                  {editPrompt === 'library' && <div className="edit-popover"><button type="button" onClick={activatePrompt}>Bearbeiten</button></div>}
                </div>
              )}
              <p>{queue.length} {queue.length === 1 ? 'Song' : 'Songs'}</p>
            </div>
            {activePlaylist ? (
              <div className="playlist-actions">
                <button type="button" onClick={startEditingPlaylist}>Name ändern</button>
                <button type="button" onClick={() => coverInputRef.current?.click()}>Bild ändern</button>
                <button className={isReordering ? 'active-action' : ''} type="button" onClick={toggleReorderMode}>{isReordering ? 'Fertig' : 'Reihenfolge ändern'}</button>
                <button className="danger-button" type="button" onClick={() => setPlaylistToDelete(activePlaylist)}>Playlist löschen</button>
                <input ref={coverInputRef} className="file-input" type="file" accept="image/*" onChange={(event) => changePlaylistCover(event.target.files)} />
              </div>
            ) : !songs.length && <button className="large-import" type="button" onClick={() => fileInputRef.current?.click()}>Musikdateien auswählen</button>}
          </div>

          {message && <div className="message" role="status">{message}</div>}
          {songReordering && <div className="reorder-hint">Ziehe Songs am Griff links an die gewünschte Position. Tippe danach auf „Fertig“.</div>}

          {queue.length ? (
            <div className={`song-list${songReordering ? ' reordering' : ''}`}>
              {queue.map((song, index) => (
                <div key={song.id} data-song-id={song.id} className={`song-row${songReordering ? ' reorder-mode' : ''}${song.id === currentSongId ? ' current' : ''}${draggedSongId === song.id ? ' dragging' : ''}`}>
                  {songReordering && <button className="drag-handle" type="button" aria-label={`${song.name} verschieben`} onPointerDown={(event) => beginSongReorder(song.id, event)} onPointerMove={moveSongReorder} onPointerUp={() => void finishSongReorder()} onPointerCancel={() => void finishSongReorder()}>⋮⋮</button>}
                  <button className="song-main" type="button" onClick={() => playSong(song.id)} disabled={songReordering}>
                    <span className="song-number">{song.id === currentSongId && isPlaying ? '▶' : index + 1}</span>
                    <span className="song-copy"><strong>{song.name}</strong></span>
                    <span className="song-action">▶</span>
                  </button>
                  {activePlaylist && !songReordering && <button className="remove-song" type="button" onClick={() => removeSongFromActivePlaylist(song.id)} aria-label={`${song.name} aus Playlist entfernen`}>Entfernen</button>}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state"><div className="empty-icon">♫</div><h2>{activePlaylist ? 'Noch keine Songs in dieser Playlist.' : 'Noch keine Musik importiert.'}</h2><p>{activePlaylist ? 'Starte einen Song aus der Bibliothek und füge ihn im Player per Plus hinzu.' : 'Wähle Musikdateien aus der Dateien-App deines iPads aus.'}</p></div>
          )}
        </section>
      </main>

      <section className={`player${currentSong ? ' visible' : ''}`} aria-label="Player">
        <audio ref={audioRef} src={currentUrl ?? undefined} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => moveSong(1)} />

        <button className="now-playing" type="button" onClick={() => currentSong && setDetailOpen(true)} disabled={!currentSong} aria-label="Aktuellen Song öffnen">
          <span className="cover-placeholder">♫</span>
          <span className="now-playing-copy"><small>JETZT</small><strong>{currentSong?.name ?? 'Kein Song ausgewählt'}</strong></span>
        </button>

        <div className="transport">
          <div className="transport-buttons">
            <button className={shuffle ? 'active-control' : ''} type="button" onClick={() => setShuffle((value) => !value)} aria-pressed={shuffle} aria-label="Shuffle">⇄</button>
            <button type="button" onClick={() => moveSong(-1)} aria-label="Vorheriger Song">⏮</button>
            <button className="play-button" type="button" onClick={togglePlayback} aria-label={isPlaying ? 'Pause' : 'Abspielen'}>{isPlaying ? '❚❚' : '▶'}</button>
            <button type="button" onClick={() => moveSong(1)} aria-label="Nächster Song">⏭</button>
            <button className={repeatQueue ? 'active-control' : ''} type="button" onClick={() => setRepeatQueue((value) => !value)} aria-pressed={repeatQueue} aria-label="Playlist wiederholen">↻</button>
          </div>
          <div className="progress-row"><span>{formatTime(currentTime)}</span><input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(Number(event.target.value))} aria-label="Wiedergabeposition" /><span>{formatTime(duration)}</span></div>
        </div>

        <div className="quick-playlists">
          <div className="quick-heading"><strong>Playlists</strong></div>
          <div className="quick-list">
            {playerPlaylists.length ? playerPlaylists.map((playlist) => {
              const contains = currentSong ? playlist.songIds.includes(currentSong.id) : false
              return <button key={playlist.id} type="button" className={contains ? 'included' : ''} onClick={() => togglePlaylistSong(playlist)} disabled={!currentSong}><span>{playlist.name}</span><strong aria-label={contains ? 'Aus Playlist entfernen' : 'Zur Playlist hinzufügen'}>{contains ? '−' : '+'}</strong></button>
            }) : <span className="no-playlists">Noch keine Playlist</span>}
          </div>
        </div>
      </section>

      {detailOpen && currentSong && (
        <section className="song-detail" aria-label="Songdetails">
          <div className="detail-topbar"><button type="button" onClick={() => setDetailOpen(false)}>‹ Zurück</button></div>
          <div className="detail-content">
            <p className="detail-label">JETZT</p>
            <h2>{currentSong.name}</h2>
            <div className="playlist-membership">
              <span>IN PLAYLISTS</span>
              <strong>{currentSongPlaylists.length ? currentSongPlaylists.map((playlist) => playlist.name).join(' · ') : 'In keiner Playlist'}</strong>
            </div>
            <div className="detail-progress">
              <input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(Number(event.target.value))} aria-label="Wiedergabeposition" />
              <div><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
            </div>
            <div className="detail-controls">
              <button type="button" onClick={playPreviousFromHistory} disabled={!playHistory.length} aria-label="Vorheriges abgespieltes Lied">⏮</button>
              <button type="button" onClick={() => skipSeconds(-10)} aria-label="10 Sekunden zurück">↶<small>10</small></button>
              <button className="detail-play" type="button" onClick={togglePlayback} aria-label={isPlaying ? 'Pause' : 'Abspielen'}>{isPlaying ? '❚❚' : '▶'}</button>
              <button type="button" onClick={() => skipSeconds(10)} aria-label="10 Sekunden vor">↷<small>10</small></button>
              <button type="button" onClick={() => moveSong(1)} aria-label="Nächstes Lied">⏭</button>
            </div>
          </div>
        </section>
      )}

      {editPrompt && <button className="edit-popover-shield" type="button" aria-label="Bearbeiten schließen" onClick={() => setEditPrompt(null)} />}

      {playlistToDelete && <div className="modal-backdrop" role="presentation" onMouseDown={() => setPlaylistToDelete(null)}><div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-playlist-title" onMouseDown={(event) => event.stopPropagation()}><h2 id="delete-playlist-title">Playlist löschen?</h2><p>„{playlistToDelete.name}“ wird gelöscht. Die Musikdateien selbst bleiben in deiner Bibliothek.</p><div className="dialog-actions"><button type="button" onClick={() => setPlaylistToDelete(null)}>Abbrechen</button><button className="danger-button" type="button" onClick={confirmDeletePlaylist}>Playlist löschen</button></div></div></div>}
    </div>
  )
}

export default App
