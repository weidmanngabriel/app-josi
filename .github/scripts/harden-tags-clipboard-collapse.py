from pathlib import Path


def replace_once(path: Path, old: str, new: str, label: str):
    text = path.read_text()
    if new in text:
        return
    if old not in text:
        raise SystemExit(f'missing {label}')
    path.write_text(text.replace(old, new, 1))

app_path = Path('src/App.tsx')
replace_once(app_path,
"""      const newNames = new Set(action.ids.map((id) => normalizeName(pool.find((item) => item.id === id)?.name ?? '')).filter(Boolean))
      return [...new Set(memberIds.filter((id) => !action.ids.includes(id)).map((id) => pool.find((item) => item.id === id)?.name).filter((name): name is string => Boolean(name)).filter((name) => newNames.has(normalizeName(name))))]
""",
"""      const actionNames = action.ids.map((id) => pool.find((item) => item.id === id)?.name).filter((name): name is string => Boolean(name))
      const newNames = new Set(actionNames.map(normalizeName).filter(Boolean))
      const existingConflicts = memberIds.filter((id) => !action.ids.includes(id)).map((id) => pool.find((item) => item.id === id)?.name).filter((name): name is string => Boolean(name)).filter((name) => newNames.has(normalizeName(name)))
      const counts = new Map<string, number>(); actionNames.forEach((name) => counts.set(normalizeName(name), (counts.get(normalizeName(name)) ?? 0) + 1))
      const internalConflicts = actionNames.filter((name, index) => (counts.get(normalizeName(name)) ?? 0) > 1 && actionNames.findIndex((item) => normalizeName(item) === normalizeName(name)) === index)
      return [...new Set([...existingConflicts, ...internalConflicts])]
""", 'bulk duplicate detection')

replace_once(app_path,
"""      const newNames = new Set(action.ids.map((id) => normalizeName(pool.find((item) => item.id === id)?.name ?? '')).filter(Boolean))
      if (action.targetKind === 'song') {
        const kept = resolution === 'replace' ? tag.songIds.filter((id) => action.ids.includes(id) || !newNames.has(normalizeName(songs.find((song) => song.id === id)?.name ?? ''))) : tag.songIds
        await updateTag({ ...tag, songIds: [...new Set([...kept, ...action.ids])], lastUsedAt: Date.now() }, true)
      } else {
        const kept = resolution === 'replace' ? tag.playlistIds.filter((id) => action.ids.includes(id) || !newNames.has(normalizeName(playlists.find((playlist) => playlist.id === id)?.name ?? ''))) : tag.playlistIds
        await updateTag({ ...tag, playlistIds: [...new Set([...kept, ...action.ids])], lastUsedAt: Date.now() }, true)
      }
""",
"""      const newNames = new Set(action.ids.map((id) => normalizeName(pool.find((item) => item.id === id)?.name ?? '')).filter(Boolean))
      const insertIds = resolution === 'replace' ? [...action.ids].reverse().filter((id, index, reversed) => reversed.findIndex((other) => normalizeName(pool.find((item) => item.id === other)?.name ?? '') === normalizeName(pool.find((item) => item.id === id)?.name ?? '')) === index).reverse() : action.ids
      if (action.targetKind === 'song') {
        const kept = resolution === 'replace' ? tag.songIds.filter((id) => action.ids.includes(id) || !newNames.has(normalizeName(songs.find((song) => song.id === id)?.name ?? ''))) : tag.songIds
        await updateTag({ ...tag, songIds: [...new Set([...kept.filter((id) => !action.ids.includes(id)), ...insertIds])], lastUsedAt: Date.now() }, true)
      } else {
        const kept = resolution === 'replace' ? tag.playlistIds.filter((id) => action.ids.includes(id) || !newNames.has(normalizeName(playlists.find((playlist) => playlist.id === id)?.name ?? ''))) : tag.playlistIds
        await updateTag({ ...tag, playlistIds: [...new Set([...kept.filter((id) => !action.ids.includes(id)), ...insertIds])], lastUsedAt: Date.now() }, true)
      }
""", 'replace duplicate selection')

replace_once(app_path,
"""  const beginReorder = (scope: Exclude<ReorderScope, null>) => { if (scope === 'library' || scope === 'playlist') setSearchQuery(''); setReorderScope(scope); setMoveCandidate(null); setOverflowMenu(null); if (scope === 'tags') setTagSortMode('manual'); else setSortMode('manual') }
""",
"""  const beginReorder = (scope: Exclude<ReorderScope, null>) => { if (scope === 'library' || scope === 'playlist') setSearchQuery(''); if (scope === 'sidebar') setPlaylistsCollapsed(false); if (scope === 'tags') setTagsCollapsed(false); setReorderScope(scope); setMoveCandidate(null); setOverflowMenu(null); if (scope === 'tags') setTagSortMode('manual'); else setSortMode('manual') }
""", 'expand on reorder')

replace_once(app_path,
"""    setTrashedSongs((items) => [...moving, ...items.filter((song) => !idSet.has(song.id))])
  }
""",
"""    setTrashedSongs((items) => [...moving, ...items.filter((song) => !idSet.has(song.id))])
    if (currentSongId && idSet.has(currentSongId)) { audioRef.current?.pause(); overlapAudioRef.current?.pause(); setCurrentSongId(null); setCurrentUrl(null); setCurrentTime(0); setDuration(0) }
  }
""", 'clear replaced current song')

# Fix concept menu numbering and mention tags in trash.
concept = Path('concept.md')
text = concept.read_text()
text = text.replace("5. **Teilen**\n4. **Loop erstellen** bzw. **Loop bearbeiten**\n5. Bei vorhandenem Loop: **Loop aktivieren** bzw. **Loop deaktivieren**\n6. Nur bei blau markierten Songs in blauer Schrift: **Als gelesen markieren**\n7. Nur bei blau markierten Songs in blauer Schrift: **Alle als gelesen markieren**\n8. In roter Schrift: **Löschen**", "5. **Teilen**\n6. **Loop erstellen** bzw. **Loop bearbeiten**\n7. Bei vorhandenem Loop: **Loop aktivieren** bzw. **Loop deaktivieren**\n8. Nur bei blau markierten Songs in blauer Schrift: **Als gelesen markieren**\n9. Nur bei blau markierten Songs in blauer Schrift: **Alle als gelesen markieren**\n10. In roter Schrift: **Löschen**")
text = text.replace("Gelöschte Songs, Playlists und Loops landen zunächst dort", "Gelöschte Songs, Playlists, Tags und Loops landen zunächst dort")
concept.write_text(text)

arch = Path('architecture.md')
text = arch.read_text()
text = text.replace("3. Einfügen\n4. Tags\n5. Teilen\n4. Loop erstellen bzw. Loop bearbeiten\n5. Bei vorhandenem Loop: Loop aktivieren bzw. Loop deaktivieren\n6. Nur bei blau markierten Songs: „Als gelesen markieren“ in Blau\n7. Nur bei blau markierten Songs: „Alle als gelesen markieren“ in Blau\n8. Löschen in Rot", "3. Einfügen\n4. Tags\n5. Teilen\n6. Loop erstellen bzw. Loop bearbeiten\n7. Bei vorhandenem Loop: Loop aktivieren bzw. Loop deaktivieren\n8. Nur bei blau markierten Songs: „Als gelesen markieren“ in Blau\n9. Nur bei blau markierten Songs: „Alle als gelesen markieren“ in Blau\n10. Löschen in Rot")
arch.write_text(text)
