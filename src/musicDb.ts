export type Song = {
  id: string
  name: string
  file: Blob
  type: string
  addedAt: number
  sourcePath?: string
  libraryOrder?: number
  importBatchId?: string
  isNew?: boolean
  duration?: number
  completedPlays?: number
  loopStart?: number
  loopEnd?: number
  loopEnabled?: boolean
  loopConfidence?: number
  loopMarkers?: number[]
  trashedAt?: number
  trashPlaylistIds?: string[]
  trashedLoop?: { deletedAt: number; start: number; end: number; enabled: boolean; markers?: number[] }
}

export type Playlist = {
  id: string
  name: string
  songIds: string[]
  createdAt: number
  lastUsedAt: number
  cover?: Blob
  sortOrder?: number
  trashedAt?: number
}

type SongMetadata = Omit<Song, 'file'>

const DB_NAME = 'josi-music'
const DB_VERSION = 2
const SONGS = 'songs'
const SONG_METADATA = 'songMetadata'
const PLAYLISTS = 'playlists'

function withoutFile(song: Song): SongMetadata {
  const { file: _file, ...metadata } = song
  return metadata
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(SONGS)) db.createObjectStore(SONGS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(SONG_METADATA)) db.createObjectStore(SONG_METADATA, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(PLAYLISTS)) db.createObjectStore(PLAYLISTS, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function putNewSongs(songs: Song[]): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([SONGS, SONG_METADATA], 'readwrite')
    const songStore = tx.objectStore(SONGS)
    const metadataStore = tx.objectStore(SONG_METADATA)
    songs.forEach((song) => {
      songStore.put(song)
      metadataStore.put(withoutFile(song))
    })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
  db.close()
}

/**
 * Persist metadata without replacing an existing audio Blob.
 * A full Song record is written only when the base Song does not exist yet
 * (for example a freshly copied Song or an Undo that restores a deleted Song).
 */
async function putSongMetadataSafely(songs: Song[]): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([SONGS, SONG_METADATA], 'readwrite')
    const songStore = tx.objectStore(SONGS)
    const metadataStore = tx.objectStore(SONG_METADATA)

    songs.forEach((song) => {
      metadataStore.put(withoutFile(song))
      const existingRequest = songStore.get(song.id) as IDBRequest<Song | undefined>
      existingRequest.onsuccess = () => {
        if (!existingRequest.result && song.file && song.file.size > 0) songStore.put(song)
      }
    })

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
  db.close()
}

async function getAllSongs(): Promise<Song[]> {
  const db = await openDb()
  try {
    const tx = db.transaction([SONGS, SONG_METADATA], 'readonly')
    const [baseSongs, metadata] = await Promise.all([
      requestResult(tx.objectStore(SONGS).getAll() as IDBRequest<Song[]>),
      requestResult(tx.objectStore(SONG_METADATA).getAll() as IDBRequest<SongMetadata[]>),
    ])
    const metadataById = new Map(metadata.map((item) => [item.id, item]))
    return baseSongs
      .map((song) => ({ ...song, ...(metadataById.get(song.id) ?? {}), file: song.file }))
      .sort((a, b) => (a.libraryOrder ?? a.addedAt) - (b.libraryOrder ?? b.addedAt))
  } finally { db.close() }
}

export async function getSongs(): Promise<Song[]> { return (await getAllSongs()).filter((song) => !song.trashedAt) }
export async function getTrashedSongs(): Promise<Song[]> { return (await getAllSongs()).filter((song) => Boolean(song.trashedAt)).sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0)) }

export async function saveSongs(files: File[], importBatchId = crypto.randomUUID()): Promise<Song[]> {
  const now = Date.now()
  const songs: Song[] = files.map((file, index) => ({
    id: crypto.randomUUID(),
    name: file.name.replace(/\.[^.]+$/, '') || file.name,
    file,
    type: file.type || 'audio/mpeg',
    addedAt: now + index,
    libraryOrder: now + index,
    importBatchId,
    isNew: true,
    completedPlays: 0,
  }))
  await putNewSongs(songs)
  return songs
}

export async function saveSong(song: Song): Promise<void> {
  await putSongMetadataSafely([song])
}

export async function saveSongOrder(songs: Song[]): Promise<void> {
  await putSongMetadataSafely(songs.map((song, index) => ({ ...song, libraryOrder: index })))
}

export async function deleteSong(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([SONGS, SONG_METADATA], 'readwrite')
    tx.objectStore(SONGS).delete(id)
    tx.objectStore(SONG_METADATA).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
  db.close()
}

async function getAllPlaylists(): Promise<Playlist[]> {
  const db = await openDb()
  try {
    const tx = db.transaction(PLAYLISTS, 'readonly')
    return await requestResult(tx.objectStore(PLAYLISTS).getAll() as IDBRequest<Playlist[]>)
  } finally { db.close() }
}

export async function getPlaylists(): Promise<Playlist[]> { return (await getAllPlaylists()).filter((playlist) => !playlist.trashedAt) }
export async function getTrashedPlaylists(): Promise<Playlist[]> { return (await getAllPlaylists()).filter((playlist) => Boolean(playlist.trashedAt)).sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0)) }

export async function savePlaylist(playlist: Playlist): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PLAYLISTS, 'readwrite')
    tx.objectStore(PLAYLISTS).put(playlist)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
  db.close()
}

export async function deletePlaylist(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PLAYLISTS, 'readwrite')
    tx.objectStore(PLAYLISTS).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
  db.close()
}
