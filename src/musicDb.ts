export type Song = {
  id: string
  name: string
  file: Blob
  type: string
  addedAt: number
  sourcePath?: string
}

export type Playlist = {
  id: string
  name: string
  songIds: string[]
  createdAt: number
  lastUsedAt: number
  cover?: Blob
}

const DB_NAME = 'josi-music'
const DB_VERSION = 1
const SONGS = 'songs'
const PLAYLISTS = 'playlists'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(SONGS)) db.createObjectStore(SONGS, { keyPath: 'id' })
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

export async function getSongs(): Promise<Song[]> {
  const db = await openDb()
  try {
    const tx = db.transaction(SONGS, 'readonly')
    const songs = await requestResult(tx.objectStore(SONGS).getAll() as IDBRequest<Song[]>)
    return songs.sort((a, b) => a.addedAt - b.addedAt)
  } finally {
    db.close()
  }
}

export async function saveSongs(files: File[]): Promise<Song[]> {
  const db = await openDb()
  const now = Date.now()
  const songs: Song[] = files.map((file, index) => {
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath?.trim()
    return {
      id: crypto.randomUUID(),
      name: file.name.replace(/\.[^.]+$/, '') || file.name,
      file,
      type: file.type || 'audio/mpeg',
      addedAt: now + index,
      sourcePath: relativePath || undefined,
    }
  })

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SONGS, 'readwrite')
    const store = tx.objectStore(SONGS)
    songs.forEach((song) => store.put(song))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
  db.close()
  return songs
}

export async function getPlaylists(): Promise<Playlist[]> {
  const db = await openDb()
  try {
    const tx = db.transaction(PLAYLISTS, 'readonly')
    return await requestResult(tx.objectStore(PLAYLISTS).getAll() as IDBRequest<Playlist[]>)
  } finally {
    db.close()
  }
}

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
