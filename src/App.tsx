import { useEffect, useMemo, useRef, useState } from 'react'
import {
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
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playlistName, setPlaylistName] = useState('')
  const [message, setMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const shouldAutoPlayRef = useRef(false)

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
    const nextIndex = currentIndex < 0 ? 0 : currentIndex + direction
    if (nextIndex < 0 || nextIndex >= queue.length) {
      setIsPlaying(false)
      return
    }
    playSong(queue[nextIndex].id)
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
    if (!id) return
    const playlist = playlists.find((item) => item.id === id)
    if (!playlist) return
    const updated = { ...playlist, lastUsedAt: Date.now() }
    setPlaylists((items) => items.map((item) => item.id === id ? updated : item))
    await savePlaylist(updated)
  }

  const togglePlaylistSong = async (playlist: Playlist) => {
    if (!currentSong) return
    const contains = playlist.songIds.includes(currentSong.id)
    const updated: Playlist = {
      ...playlist,
      songIds: contains
        ? playlist.songIds.filter((id) => id !== currentSong.id)
        : [...playlist.songIds, currentSong.id],
      lastUsedAt: Date.now(),
    }
    setPlaylists((items) => items.map((item) => item.id === playlist.id ? updated : item))
    await savePlaylist(updated)
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
                <span>{playlist.name}</span><strong>{playlist.songIds.length}</strong>
              </button>
            ))}
          </div>

          <form className="new-playlist" onSubmit={createPlaylist}>
            <input value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} placeholder="Neue Playlist" aria-label="Name der neuen Playlist" />
            <button type="submit" disabled={!playlistName.trim()} aria-label="Playlist erstellen">+</button>
          </form>
        </aside>

        <section className="library-panel">
          <div className="library-heading">
            <div>
              <p className="eyebrow">{activePlaylist ? 'PLAYLIST' : 'DEINE MUSIK'}</p>
              <h1>{activePlaylist?.name ?? 'Bibliothek'}</h1>
              <p>{queue.length} {queue.length === 1 ? 'Song' : 'Songs'}</p>
            </div>
            {!songs.length && <button className="large-import" type="button" onClick={() => fileInputRef.current?.click()}>Musikdateien auswählen</button>}
          </div>

          {message && <div className="message" role="status">{message}</div>}

          {queue.length ? (
            <div className="song-list">
              {queue.map((song, index) => (
                <button key={song.id} type="button" className={`song-row${song.id === currentSongId ? ' current' : ''}`} onClick={() => playSong(song.id)}>
                  <span className="song-number">{song.id === currentSongId && isPlaying ? '▶' : index + 1}</span>
                  <span className="song-copy"><strong>{song.name}</strong><small>{song.type || 'Audiodatei'}</small></span>
                  <span className="song-action">▶</span>
                </button>
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
            <button type="button" onClick={() => moveSong(-1)} aria-label="Vorheriger Song">⏮</button>
            <button className="play-button" type="button" onClick={togglePlayback} aria-label={isPlaying ? 'Pause' : 'Abspielen'}>{isPlaying ? '❚❚' : '▶'}</button>
            <button type="button" onClick={() => moveSong(1)} aria-label="Nächster Song">⏭</button>
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
    </div>
  )
}

export default App
