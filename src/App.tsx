import { useEffect, useMemo, useRef, useState } from 'react'
import {
  deletePlaylist,
  getPlaylists,
  getSongs,
  savePlaylist,
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
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null)
  const [message, setMessage] = useState('')
  const [draggedSongId, setDraggedSongId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const shouldAutoPlayRef = useRef(false)
  const reorderOrderRef = useRef<string[]>([])

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

  const playSong = (id: string) => {
    if (id === currentSongId && audioRef.current) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
      return
    }
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
    }
    await savePlaylist(playlist)
    setPlaylists((existing) => [playlist, ...existing])
    setPlaylistName('')
    setActivePlaylistId(playlist.id)
  }

  const openPlaylist = async (id: string | null) => {
    setActivePlaylistId(id)
    setIsEditingPlaylist(false)
    setIsReordering(false)
    setDraggedSongId(null)
    reorderOrderRef.current = []
    if (!id) return
    const playlist = playlists.find((item) => item.id === id)
    if (!playlist) return
    await updatePlaylist({ ...playlist, lastUsedAt: Date.now() })
  }

  const togglePlaylistSong = async (playlist: Playlist) => {
    if (!currentSong) return
    const contains = playlist.songIds.includes(currentSong.id)
    await updatePlaylist({
      ...playlist,
      songIds: contains
        ? playlist.songIds.filter((id) => id !== currentSong.id)
        : [...playlist.songIds, currentSong.id],
      lastUsedAt: Date.now(),
    })
  }

  const removeSongFromActivePlaylist = async (songId: string) => {
    if (!activePlaylist) return
    await updatePlaylist({
      ...activePlaylist,
      songIds: activePlaylist.songIds.filter((id) => id !== songId),
      lastUsedAt: Date.now(),
    })
  }

  const toggleReorderMode = () => {
    setDraggedSongId(null)
    reorderOrderRef.current = []
    setIsReordering((value) => !value)
  }

  const beginTouchReorder = (songId: string, event: React.PointerEvent<HTMLButtonElement>) => {
    if (!activePlaylist || !isReordering) return
    event.preventDefault()
    reorderOrderRef.current = [...activePlaylist.songIds]
    setDraggedSongId(songId)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveTouchReorder = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!activePlaylist || !isReordering || !draggedSongId) return
    event.preventDefault()

    if (event.clientY < 100) window.scrollBy(0, -18)
    if (event.clientY > window.innerHeight - 180) window.scrollBy(0, 18)

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
    setPlaylists((items) => items.map((item) => item.id === activePlaylist.id ? { ...item, songIds } : item))
  }

  const finishTouchReorder = async () => {
    if (!activePlaylist || !draggedSongId) return
    const songIds = reorderOrderRef.current.length ? [...reorderOrderRef.current] : [...activePlaylist.songIds]
    const updated = { ...activePlaylist, songIds, lastUsedAt: Date.now() }
    setDraggedSongId(null)
    reorderOrderRef.current = []
    await updatePlaylist(updated)
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

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" type="button" onClick={() => openPlaylist(null)} aria-label="Musikbibliothek öffnen">
          <span className="brand-mark">J</span>
          <span>Josi</span>
        </button>
        <button className="import-button" type="button" onClick={() => fileInputRef.current?.click()}>+ Musik importieren</button>
        <input ref={fileInputRef} className="file-input" type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac" multiple onChange={(event) => importFiles(event.target.files)} />
      </header>

      <main className="music-layout">
        <aside className="sidebar">
          <button className={`nav-item${activePlaylistId === null ? ' active' : ''}`} type="button" onClick={() => openPlaylist(null)}>
            <span>Bibliothek</span><strong>{songs.length}</strong>
          </button>

          <div className="sidebar-heading"><span>Playlists</span></div>
          <div className="playlist-nav">
            {[...playlists].sort((a, b) => b.lastUsedAt - a.lastUsedAt).map((playlist) => (
              <button key={playlist.id} className={`nav-item${activePlaylistId === playlist.id ? ' active' : ''}`} type="button" onClick={() => openPlaylist(playlist.id)}>
                <span className="playlist-nav-name">
                  {coverUrls[playlist.id] ? <img src={coverUrls[playlist.id]} alt="" /> : <span className="playlist-mini-cover">♫</span>}
                  <span>{playlist.name}</span>
                </span>
                <strong>{playlist.songIds.length}</strong>
              </button>
            ))}
          </div>

          <form className="new-playlist" onSubmit={createPlaylist}>
            <input value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} placeholder="Neue Playlist" aria-label="Name der neuen Playlist" />
            <button type="submit" disabled={!playlistName.trim()} aria-label="Playlist erstellen">+</button>
          </form>
        </aside>

        <section className="library-panel">
          <div className={`library-heading${activePlaylist ? ' playlist-heading' : ''}`}>
            {activePlaylist && (
              <button className="playlist-cover" type="button" onClick={() => coverInputRef.current?.click()} aria-label="Playlist-Bild ändern">
                {coverUrls[activePlaylist.id] ? <img src={coverUrls[activePlaylist.id]} alt="" /> : <span>+ Bild</span>}
              </button>
            )}
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
          {activePlaylist && isReordering && <div className="reorder-hint">Ziehe Songs am Griff links an die gewünschte Position. Tippe danach auf „Fertig“.</div>}

          {queue.length ? (
            <div className={`song-list${isReordering ? ' reordering' : ''}`}>
              {queue.map((song, index) => (
                <div
                  key={song.id}
                  data-song-id={song.id}
                  className={`song-row${isReordering ? ' reorder-mode' : ''}${song.id === currentSongId ? ' current' : ''}${draggedSongId === song.id ? ' dragging' : ''}`}
                >
                  {activePlaylist && isReordering && (
                    <button
                      className="drag-handle"
                      type="button"
                      aria-label={`${song.name} verschieben`}
                      onPointerDown={(event) => beginTouchReorder(song.id, event)}
                      onPointerMove={moveTouchReorder}
                      onPointerUp={() => void finishTouchReorder()}
                      onPointerCancel={() => void finishTouchReorder()}
                    >⋮⋮</button>
                  )}
                  <button className="song-main" type="button" onClick={() => playSong(song.id)} disabled={isReordering}>
                    <span className="song-number">{song.id === currentSongId && isPlaying ? '▶' : index + 1}</span>
                    <span className="song-copy"><strong>{song.name}</strong><small>{song.type || 'Audiodatei'}</small></span>
                    <span className="song-action">▶</span>
                  </button>
                  {activePlaylist && !isReordering && <button className="remove-song" type="button" onClick={() => removeSongFromActivePlaylist(song.id)} aria-label={`${song.name} aus Playlist entfernen`}>Entfernen</button>}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">♫</div>
              <h2>{activePlaylist ? 'Noch keine Songs in dieser Playlist.' : 'Noch keine Musik importiert.'}</h2>
              <p>{activePlaylist ? 'Starte einen Song aus der Bibliothek und füge ihn im Player per Plus hinzu.' : 'Wähle Musikdateien aus der Dateien-App deines iPads aus.'}</p>
            </div>
          )}
        </section>
      </main>

      <section className={`player${currentSong ? ' visible' : ''}`} aria-label="Player">
        <audio
          ref={audioRef}
          src={currentUrl ?? undefined}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => moveSong(1)}
        />

        <div className="now-playing">
          <span className="cover-placeholder">♫</span>
          <div><small>JETZT</small><strong>{currentSong?.name ?? 'Kein Song ausgewählt'}</strong></div>
        </div>

        <div className="transport">
          <div className="transport-buttons">
            <button className={shuffle ? 'active-control' : ''} type="button" onClick={() => setShuffle((value) => !value)} aria-pressed={shuffle} aria-label="Shuffle">⇄</button>
            <button type="button" onClick={() => moveSong(-1)} aria-label="Vorheriger Song">⏮</button>
            <button className="play-button" type="button" onClick={togglePlayback} aria-label={isPlaying ? 'Pause' : 'Abspielen'}>{isPlaying ? '❚❚' : '▶'}</button>
            <button type="button" onClick={() => moveSong(1)} aria-label="Nächster Song">⏭</button>
            <button className={repeatQueue ? 'active-control' : ''} type="button" onClick={() => setRepeatQueue((value) => !value)} aria-pressed={repeatQueue} aria-label="Playlist wiederholen">↻</button>
          </div>
          <div className="progress-row">
            <span>{formatTime(currentTime)}</span>
            <input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(Number(event.target.value))} aria-label="Wiedergabeposition" />
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="quick-playlists">
          <div className="quick-heading"><strong>Playlists</strong><small>Song schnell zuordnen</small></div>
          <div className="quick-list">
            {playerPlaylists.length ? playerPlaylists.map((playlist) => {
              const contains = currentSong ? playlist.songIds.includes(currentSong.id) : false
              return (
                <button key={playlist.id} type="button" className={contains ? 'included' : ''} onClick={() => togglePlaylistSong(playlist)} disabled={!currentSong}>
                  <span>{playlist.name}</span><strong aria-label={contains ? 'Aus Playlist entfernen' : 'Zur Playlist hinzufügen'}>{contains ? '−' : '+'}</strong>
                </button>
              )
            }) : <span className="no-playlists">Noch keine Playlist</span>}
          </div>
        </div>
      </section>

      {playlistToDelete && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setPlaylistToDelete(null)}>
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-playlist-title" onMouseDown={(event) => event.stopPropagation()}>
            <h2 id="delete-playlist-title">Playlist löschen?</h2>
            <p>„{playlistToDelete.name}“ wird gelöscht. Die Musikdateien selbst bleiben in deiner Bibliothek.</p>
            <div className="dialog-actions">
              <button type="button" onClick={() => setPlaylistToDelete(null)}>Abbrechen</button>
              <button className="danger-button" type="button" onClick={confirmDeletePlaylist}>Playlist löschen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App