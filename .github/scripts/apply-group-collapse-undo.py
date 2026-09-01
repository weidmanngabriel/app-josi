from pathlib import Path
import re

app_path = Path('src/App.tsx')
app = app_path.read_text()


def replace_once(old: str, new: str, label: str):
    global app
    if old not in app:
        raise SystemExit(f'Missing replacement: {label}')
    app = app.replace(old, new, 1)

replace_once(
    "type Snapshot = { songs: Song[]; playlists: Playlist[]; tags: Tag[] }",
    "type Snapshot = { songs: Song[]; playlists: Playlist[]; tags: Tag[]; objectGroups: ObjectGroup[] }",
    'Snapshot group state',
)

replace_once(
    "  const [objectGroups, setObjectGroups] = useState<ObjectGroup[]>(() => { try { const parsed = JSON.parse(localStorage.getItem('josi-object-groups') ?? '[]'); return Array.isArray(parsed) ? parsed : [] } catch { return [] } })\n",
    "  const [objectGroups, setObjectGroups] = useState<ObjectGroup[]>(() => { try { const parsed = JSON.parse(localStorage.getItem('josi-object-groups') ?? '[]'); return Array.isArray(parsed) ? parsed : [] } catch { return [] } })\n  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(() => { try { const parsed = JSON.parse(localStorage.getItem('josi-collapsed-group-ids') ?? '[]'); return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []) } catch { return new Set() } })\n",
    'collapsed group state',
)

replace_once(
    "  useEffect(() => { localStorage.setItem('josi-object-groups', JSON.stringify(objectGroups)) }, [objectGroups])\n",
    "  useEffect(() => { localStorage.setItem('josi-object-groups', JSON.stringify(objectGroups)) }, [objectGroups])\n  useEffect(() => { localStorage.setItem('josi-collapsed-group-ids', JSON.stringify([...collapsedGroupIds])) }, [collapsedGroupIds])\n",
    'collapsed group persistence',
)

old_snapshot = "  const snapshot = (): Snapshot => ({ songs: songs.map((song) => ({ ...song, loopMarkers: song.loopMarkers ? [...song.loopMarkers] : undefined })), playlists: playlists.map((playlist) => ({ ...playlist, songIds: [...playlist.songIds] })), tags: tags.map((tag) => ({ ...tag, songIds: [...tag.songIds], playlistIds: [...tag.playlistIds] })) })"
new_snapshot = "  const snapshot = (): Snapshot => ({ songs: songs.map((song) => ({ ...song, loopMarkers: song.loopMarkers ? [...song.loopMarkers] : undefined })), playlists: playlists.map((playlist) => ({ ...playlist, songIds: [...playlist.songIds] })), tags: tags.map((tag) => ({ ...tag, songIds: [...tag.songIds], playlistIds: [...tag.playlistIds] })), objectGroups: objectGroups.map((group) => ({ ...group, itemIds: [...group.itemIds] })) })"
replace_once(old_snapshot, new_snapshot, 'snapshot contents')

replace_once(
    "    setSongs(target.songs)\n    setPlaylists(target.playlists)\n    setTags(target.tags)\n",
    "    setSongs(target.songs)\n    setPlaylists(target.playlists)\n    setTags(target.tags)\n    setObjectGroups(target.objectGroups)\n",
    'restore group snapshot',
)

old_dissolve = "  const dissolveGroup = (id: string) => { setObjectGroups((current) => current.filter((group) => group.id !== id)); setOverflowMenu(null); setGroupReorderId((value) => value === id ? null : value); setGroupMoveId((value) => value === id ? null : value) }"
new_dissolve = "  const dissolveGroup = (id: string) => { recordHistory(); setObjectGroups((current) => current.filter((group) => group.id !== id)); setCollapsedGroupIds((current) => { const next = new Set(current); next.delete(id); return next }); setOverflowMenu(null); setGroupReorderId((value) => value === id ? null : value); setGroupMoveId((value) => value === id ? null : value) }"
replace_once(old_dissolve, new_dissolve, 'undoable dissolve')

pattern = re.compile(r"  const renderGroupHeader = \(group: ObjectGroup, allowed: Array<Song \| Playlist \| Tag>\) => \{\n    const items = orderedGroupItems\(group, allowed\)\n    return <div className=\\\"object-group-header\\\">.*?\n  \}\n  const renderSongRow", re.S)
match = pattern.search(app)
if not match:
    raise SystemExit('Missing replacement: renderGroupHeader')
new_header = '''  const renderGroupHeader = (group: ObjectGroup, allowed: Array<Song | Playlist | Tag>) => {
    const items = orderedGroupItems(group, allowed)
    const collapsed = collapsedGroupIds.has(group.id)
    const toggleCollapsed = () => setCollapsedGroupIds((current) => { const next = new Set(current); next.has(group.id) ? next.delete(group.id) : next.add(group.id); return next })
    return <div className={`object-group-header${collapsed ? ' collapsed' : ''}`} role="button" tabIndex={0} aria-expanded={!collapsed} onClick={toggleCollapsed} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleCollapsed() } }}><div className="object-group-heading"><strong><b className="group-chevron">{collapsed ? '▸' : '▾'}</b><span className="group-name-text">{group.name}</span></strong><span>{items.length} Objekte · {formatTime(groupDuration(group, allowed))}</span></div>{groupMoveId === group.id && <div className="group-inline-tools"><button type="button" onClick={(event) => { event.stopPropagation(); moveGroup(group.id, -1) }}>↑</button><button type="button" onClick={(event) => { event.stopPropagation(); moveGroup(group.id, 1) }}>↓</button><button type="button" onClick={(event) => { event.stopPropagation(); setGroupMoveId(null) }}>Fertig</button></div>}{groupReorderId === group.id && <button className="group-finish" type="button" onClick={(event) => { event.stopPropagation(); setGroupReorderId(null) }}>Fertig</button>}<button className="overflow-button group-overflow" type="button" onClick={(event) => { event.stopPropagation(); setOverflowMenu({ kind: 'group', id: group.id }) }}>•••</button></div>
  }
  const renderSongRow'''
app = app[:match.start()] + new_header + app[match.end():]

replacements = [
    (
        "{playlistGroups.map((group) => <section className=\"object-group sidebar-object-group\" key={group.id}>{renderGroupHeader(group, sidebarPlaylists)}{orderedGroupItems(group, sidebarPlaylists).map((item, index) => renderPlaylistRow(item as Playlist, index, group.id))}</section>)}",
        "{playlistGroups.map((group) => <section className=\"object-group sidebar-object-group\" key={group.id}>{renderGroupHeader(group, sidebarPlaylists)}{!collapsedGroupIds.has(group.id) && orderedGroupItems(group, sidebarPlaylists).map((item, index) => renderPlaylistRow(item as Playlist, index, group.id))}</section>)}",
        'playlist sidebar collapse',
    ),
    (
        "{tagGroups.map((group) => <section className=\"object-group sidebar-object-group\" key={group.id}>{renderGroupHeader(group, sidebarTags)}{orderedGroupItems(group, sidebarTags).map((item, index) => renderTagRow(item as Tag, index, group.id))}</section>)}",
        "{tagGroups.map((group) => <section className=\"object-group sidebar-object-group\" key={group.id}>{renderGroupHeader(group, sidebarTags)}{!collapsedGroupIds.has(group.id) && orderedGroupItems(group, sidebarTags).map((item, index) => renderTagRow(item as Tag, index, group.id))}</section>)}",
        'tag sidebar collapse',
    ),
    (
        "{songGroups.map((group) => <section className=\"object-group song-object-group\" key={group.id}>{renderGroupHeader(group, visibleSongs)}{orderedGroupItems(group, visibleSongs).map((item, index) => renderSongRow(item as Song, index, group.id))}</section>)}",
        "{songGroups.map((group) => <section className=\"object-group song-object-group\" key={group.id}>{renderGroupHeader(group, visibleSongs)}{!collapsedGroupIds.has(group.id) && orderedGroupItems(group, visibleSongs).map((item, index) => renderSongRow(item as Song, index, group.id))}</section>)}",
        'song group collapse',
    ),
    (
        "{playlistGroups.map((group) => <section className=\"object-group overview-object-group\" key={group.id}>{renderGroupHeader(group, sidebarPlaylists)}<div className=\"playlist-grid\">{orderedGroupItems(group, sidebarPlaylists).map((item) => renderPlaylistCard(item as Playlist))}</div></section>)}",
        "{playlistGroups.map((group) => <section className=\"object-group overview-object-group\" key={group.id}>{renderGroupHeader(group, sidebarPlaylists)}{!collapsedGroupIds.has(group.id) && <div className=\"playlist-grid\">{orderedGroupItems(group, sidebarPlaylists).map((item) => renderPlaylistCard(item as Playlist))}</div>}</section>)}",
        'playlist overview collapse',
    ),
]
for old, new, label in replacements:
    replace_once(old, new, label)

app_path.write_text(app)

css_path = Path('src/enhancements.css')
css = css_path.read_text()
css += '''\n\n/* Collapsible object-group headers */\n.object-group-header { cursor: pointer; user-select: none; -webkit-user-select: none; }\n.object-group-header:hover { background: #fff; }\n.object-group-header.collapsed { border-bottom: 0; }\n.object-group-heading strong { display: flex; align-items: center; gap: 6px; min-width: 0; }\n.group-chevron { flex: 0 0 auto; width: 12px; color: #111827; font-size: 11px; }\n.group-name-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.object-group-header button { cursor: pointer; }\n'''
css_path.write_text(css)

arch_path = Path('architecture.md')
arch = arch_path.read_text()
arch += '''\n\n## Gruppen einklappen und Undo\n\nDie globale Undo/Redo-Snapshot-Struktur enthält neben Songs, Playlists und Tags auch die persistenten Objektgruppen. `Gruppe auflösen` legt vor dem Entfernen einen Snapshot an; Undo stellt die Gruppe inklusive Name, Typ, Objekt-IDs, Position und Gruppensortierung wieder her, Redo löst sie erneut auf. Audiodateien oder andere Objekte werden dabei nicht kopiert.\n\nJede Gruppen-Kopfzeile ist selbst ein einklappbarer Bereich. Ein Klick auf die fast weiße Zeile mit Name, Objektanzahl und Dauer blendet ausschließlich die enthaltenen Objekte ein oder aus; `•••` und die Gruppen-Werkzeuge stoppen dieses Ereignis und bleiben unabhängig bedienbar. Der Einklappstatus wird lokal gespeichert und gilt für Lied-, Playlist- und Taggruppen. Playlist- und Taggruppen werden direkt in ihren Bereichen der linken Seitenleiste dargestellt und können dort genauso ein- und ausgeklappt werden wie Liedgruppen in der Hauptliste.\n'''
arch_path.write_text(arch)

concept_path = Path('concept.md')
concept = concept_path.read_text()
concept += '''\n\n## Gruppen einklappen und wiederherstellen\n\nDie fast weiße Kopfzeile einer Gruppe kann direkt angetippt werden. Dadurch werden alle Objekte der Gruppe eingeklappt, sodass nur Name, Anzahl, Dauer und `•••` sichtbar bleiben. Ein weiterer Klick fährt die Gruppe wieder aus. Die Bedienelemente innerhalb der Kopfzeile lösen das Einklappen nicht versehentlich aus. Dieses Verhalten gilt für Lieder sowie für Playlist- und Taggruppen direkt in der linken Spalte.\n\n**Gruppe auflösen** ist Teil des normalen Undo/Redo-Verlaufs. Direkt nach dem Auflösen stellt Undo dieselbe Gruppe mit ihren bisherigen Inhalten und Einstellungen wieder her; Redo löst sie erneut auf.\n'''
concept_path.write_text(concept)
