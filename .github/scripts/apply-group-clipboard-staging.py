from pathlib import Path
import re

app_path = Path('src/App.tsx')
app = app_path.read_text()

def replace_once(old: str, new: str, label: str):
    global app
    if old not in app:
        raise SystemExit(f'Missing App replacement: {label}')
    app = app.replace(old, new, 1)

replace_once(
    "type GroupMembershipTarget = { groupId: string; mode: 'add' | 'remove' } | null\ntype ClipboardItem =",
    "type GroupMembershipTarget = { groupId: string; mode: 'add' | 'remove' } | null\ntype GroupClipboard = { kind: GroupKind; itemIds: string[] } | null\ntype ClipboardItem =",
    'group clipboard type',
)

replace_once(
    "  const [groupMembershipTarget, setGroupMembershipTarget] = useState<GroupMembershipTarget>(null)\n  const [groupReorderId, setGroupReorderId] = useState<string | null>(null)",
    "  const [groupMembershipTarget, setGroupMembershipTarget] = useState<GroupMembershipTarget>(null)\n  const [groupMembershipDraftIds, setGroupMembershipDraftIds] = useState<Set<string>>(new Set())\n  const [groupClipboard, setGroupClipboard] = useState<GroupClipboard>(null)\n  const [groupReorderId, setGroupReorderId] = useState<string | null>(null)",
    'group clipboard state',
)

old_create = """    setObjectGroups((current) => {
      const next = current.map((group) => group.kind === kind ? { ...group, itemIds: group.itemIds.filter((id) => !valid.includes(id)) } : group).filter((group) => group.kind !== kind || group.itemIds.length >= 2)
      const minOrder = Math.min(0, ...next.filter((group) => group.kind === kind).map((group) => group.sortOrder))
      return [{ id: crypto.randomUUID(), kind, name: 'Unbenannt', itemIds: valid, createdAt: Date.now(), sortOrder: minOrder - 1, sortMode: 'general', sortDirection: 'down' }, ...next]
    })"""
new_create = """    setObjectGroups((current) => {
      const minOrder = Math.min(0, ...current.filter((group) => group.kind === kind).map((group) => group.sortOrder))
      return [{ id: crypto.randomUUID(), kind, name: 'Unbenannt', itemIds: valid, createdAt: Date.now(), sortOrder: minOrder - 1, sortMode: 'general', sortDirection: 'down' }, ...current]
    })"""
replace_once(old_create, new_create, 'allow same-type multi-group membership')

old_add = """  const addItemToGroup = (groupId: string, itemId: string) => {
    const target = objectGroups.find((group) => group.id === groupId); if (!target || !objectFor(target.kind, itemId)) return
    setObjectGroups((current) => current.map((group) => {
      if (group.kind !== target.kind) return group
      if (group.id === groupId) return group.itemIds.includes(itemId) ? group : { ...group, itemIds: [...group.itemIds, itemId] }
      return { ...group, itemIds: group.itemIds.filter((id) => id !== itemId) }
    }).filter((group) => group.kind !== target.kind || group.id === groupId || group.itemIds.length >= 2))
  }
  const removeItemFromGroup"""
new_add = """  const addItemToGroup = (groupId: string, itemId: string) => {
    const target = objectGroups.find((group) => group.id === groupId); if (!target || !objectFor(target.kind, itemId)) return
    updateObjectGroup(groupId, (group) => group.itemIds.includes(itemId) ? group : { ...group, itemIds: [...group.itemIds, itemId] })
  }
  const openGroupMembership = (groupId: string, mode: 'add' | 'remove') => { setGroupMembershipDraftIds(new Set()); setGroupMembershipTarget({ groupId, mode }); setOverflowMenu(null) }
  const toggleGroupMembershipDraft = (itemId: string) => setGroupMembershipDraftIds((current) => { const next = new Set(current); next.has(itemId) ? next.delete(itemId) : next.add(itemId); return next })
  const applyGroupMembershipDraft = () => {
    if (!groupMembershipTarget || groupMembershipTarget.mode !== 'add') return
    const group = objectGroups.find((item) => item.id === groupMembershipTarget.groupId); if (!group) return
    const valid = [...groupMembershipDraftIds].filter((id) => Boolean(objectFor(group.kind, id)) && !group.itemIds.includes(id))
    if (valid.length) updateObjectGroup(group.id, (item) => ({ ...item, itemIds: [...item.itemIds, ...valid] }))
    setGroupMembershipDraftIds(new Set()); setGroupMembershipTarget(null)
  }
  const copyGroupContents = (group: ObjectGroup) => { setGroupClipboard({ kind: group.kind, itemIds: [...group.itemIds] }); setOverflowMenu(null); setMessage(`Inhalt von „${group.name}“ wurde kopiert.`) }
  const pasteGroupContents = (group: ObjectGroup) => {
    if (!groupClipboard || groupClipboard.kind !== group.kind) return
    const valid = groupClipboard.itemIds.filter((id) => Boolean(objectFor(group.kind, id)) && !group.itemIds.includes(id))
    if (!valid.length) { setOverflowMenu(null); setMessage('In dieser Gruppe sind bereits alle kopierten Objekte enthalten.'); return }
    updateObjectGroup(group.id, (item) => ({ ...item, itemIds: [...item.itemIds, ...valid] }))
    setOverflowMenu(null); setMessage(`${valid.length} ${valid.length === 1 ? 'Objekt wurde' : 'Objekte wurden'} eingefügt.`)
  }
  const removeItemFromGroup"""
replace_once(old_add, new_add, 'group add clipboard helpers')

old_menu = """<button type=\"button\" onClick={() => { setGroupReorderId(group.id); setGroupMoveId(null); setOverflowMenu(null) }}>Reihenfolge ändern</button><button type=\"button\" onClick={() => { setGroupMoveId(group.id); setGroupReorderId(null); setOverflowMenu(null) }}>Gruppe bewegen</button><button type=\"button\" onClick={() => { setGroupMembershipTarget({ groupId: group.id, mode: 'add' }); setOverflowMenu(null) }}>Objekte hinzufügen</button><button type=\"button\" onClick={() => { setGroupMembershipTarget({ groupId: group.id, mode: 'remove' }); setOverflowMenu(null) }}>Objekte entfernen</button>"""
new_menu = """<button type=\"button\" onClick={() => { setGroupReorderId(group.id); setGroupMoveId(null); setOverflowMenu(null) }}>Reihenfolge ändern</button><button type=\"button\" onClick={() => copyGroupContents(group)}>Kopieren</button><button type=\"button\" disabled={!groupClipboard || groupClipboard.kind !== group.kind} onClick={() => pasteGroupContents(group)}>Einfügen</button><button type=\"button\" onClick={() => { setGroupMoveId(group.id); setGroupReorderId(null); setOverflowMenu(null) }}>Gruppe bewegen</button><button type=\"button\" onClick={() => openGroupMembership(group.id, 'add')}>Objekte hinzufügen</button><button type=\"button\" onClick={() => openGroupMembership(group.id, 'remove')}>Objekte entfernen</button>"""
replace_once(old_menu, new_menu, 'group menu clipboard order')

pattern = re.compile(r"\n    \{groupMembershipTarget && \(\(\) => \{.*?\n    \{colorPickerTarget &&", re.S)
replacement = r'''
    {groupMembershipTarget && (() => { const group = objectGroups.find((item) => item.id === groupMembershipTarget.groupId); if (!group) return null; const allItems: Array<Song | Playlist | Tag> = group.kind === 'song' ? songs : group.kind === 'playlist' ? playlists : tags; const candidates = groupMembershipTarget.mode === 'add' ? allItems.filter((item) => !group.itemIds.includes(item.id)) : orderedGroupItems(group, allItems); return <div className="playlist-chooser-backdrop group-membership-backdrop" onMouseDown={() => { setGroupMembershipDraftIds(new Set()); setGroupMembershipTarget(null) }}><section className="playlist-chooser group-membership-dialog" onMouseDown={(event) => event.stopPropagation()}><div className="playlist-chooser-heading"><div><p className="eyebrow">GRUPPE</p><h2>{groupMembershipTarget.mode === 'add' ? 'Objekte hinzufügen' : 'Objekte entfernen'}</h2></div><button type="button" onClick={() => { setGroupMembershipDraftIds(new Set()); setGroupMembershipTarget(null) }}>×</button></div><div className="group-membership-list">{candidates.map((item) => { const staged = groupMembershipDraftIds.has(item.id); return <button type="button" key={item.id} onClick={() => groupMembershipTarget.mode === 'add' ? toggleGroupMembershipDraft(item.id) : removeItemFromGroup(group.id, item.id)}><span>{item.name}</span><strong>{groupMembershipTarget.mode === 'add' ? staged ? '−' : '+' : '−'}</strong></button> })}{!candidates.length && <p>Keine passenden Objekte.</p>}</div>{groupMembershipTarget.mode === 'add' && <div className="dialog-actions"><button type="button" onClick={() => { setGroupMembershipDraftIds(new Set()); setGroupMembershipTarget(null) }}>Abbrechen</button><button type="button" onClick={applyGroupMembershipDraft} disabled={!groupMembershipDraftIds.size}>Fertig</button></div>}</section></div> })()}
    {colorPickerTarget &&'''
app, count = pattern.subn(replacement, app, count=1)
if count != 1:
    raise SystemExit('Missing App replacement: group membership dialog')

app_path.write_text(app)

architecture = Path('architecture.md')
text = architecture.read_text()
old = "Ein Objekt kann innerhalb seines Typs höchstens einer Gruppe angehören; beim Hinzufügen zu einer anderen Gruppe wird es aus der vorherigen entfernt. Gruppen stehen in der jeweiligen Liste immer vor ungruppierten Objekten und werden untereinander nach der Sortierung der Gesamtliste angeordnet. Innerhalb der Gruppe kann `Allgemeine Sortierung` verwendet werden oder eine eigene Sortierung inklusive manueller Reihenfolge."
new = "Ein Objekt darf in mehreren Gruppen desselben Typs referenziert werden; Lieder, Playlists und Tags werden dabei niemals typübergreifend gemischt. Gruppen stehen in der jeweiligen Liste immer vor ungruppierten Objekten und werden untereinander nach der Sortierung der Gesamtliste angeordnet. Innerhalb der Gruppe kann `Allgemeine Sortierung` verwendet werden oder eine eigene Sortierung inklusive manueller Reihenfolge. Das Gruppenmenü besitzt zusätzlich Kopieren und Einfügen direkt vor `Gruppe bewegen`: Kopieren merkt sich ausschließlich die Objekt-IDs der Gruppe, Einfügen ergänzt sie nur in einer Gruppe desselben Typs und dupliziert keine Audiodateien oder Playlist-/Tag-Daten."
if old not in text:
    raise SystemExit('Missing docs replacement in architecture.md')
text = text.replace(old, new, 1)
text += "\n\nBeim Dialog `Objekte hinzufügen` wird eine Auswahl zunächst nur vorgemerkt: `+` wechselt zu `−`, ohne die Gruppe sofort zu verändern. `−` nimmt die vorgemerkte Auswahl wieder zurück. Erst `Fertig` übernimmt alle vorgemerkten Objekte gemeinsam; `Abbrechen` verwirft sie.\n"
architecture.write_text(text)

concept = Path('concept.md')
text = concept.read_text()
old = "Mehrere ausgewählte Lieder, Playlists oder Tags können über `••• → Gruppieren` zu einer eigenen Gruppe zusammengefasst werden. Die drei Typen werden nie vermischt, und ein Objekt liegt immer nur in einer Gruppe seines Typs. Neue Gruppen heißen zunächst **Unbenannt**. Gruppen stehen vor allen ungruppierten Objekten; untereinander folgen sie der Sortierung der Gesamtliste."
new = "Mehrere ausgewählte Lieder, Playlists oder Tags können über `••• → Gruppieren` zu einer eigenen Gruppe zusammengefasst werden. Die drei Typen werden nie vermischt. Ein Objekt darf in mehreren Gruppen desselben Typs vorkommen; Gruppen speichern dabei nur Verweise und duplizieren keine Audiodateien. Neue Gruppen heißen zunächst **Unbenannt**. Gruppen stehen vor allen ungruppierten Objekten; untereinander folgen sie der Sortierung der Gesamtliste."
if old not in text:
    raise SystemExit('Missing docs replacement in concept.md')
text = text.replace(old, new, 1)
old = "Das `•••` der Gruppe bietet bei Liedern **Gruppe abspielen** sowie für alle Typen **Gruppe umbenennen**, **Sortieren**, **Reihenfolge ändern**, **Gruppe bewegen**, **Objekte hinzufügen**, **Objekte entfernen** und **Gruppe auflösen**. Die interne Sortierung besitzt zusätzlich **Allgemeine Sortierung**, wodurch die Gruppe automatisch die Sortierung der gesamten Liste übernimmt."
new = "Das `•••` der Gruppe bietet bei Liedern **Gruppe abspielen** sowie für alle Typen **Gruppe umbenennen**, **Sortieren**, **Reihenfolge ändern**, **Kopieren**, **Einfügen**, **Gruppe bewegen**, **Objekte hinzufügen**, **Objekte entfernen** und **Gruppe auflösen**. Kopieren/Einfügen überträgt ausschließlich Gruppeninhalte zwischen Gruppen desselben Typs; Lied-, Playlist- und Taggruppen können nicht ineinander eingefügt werden. Die interne Sortierung besitzt zusätzlich **Allgemeine Sortierung**, wodurch die Gruppe automatisch die Sortierung der gesamten Liste übernimmt."
if old not in text:
    raise SystemExit('Missing group menu docs replacement in concept.md')
text = text.replace(old, new, 1)
text += "\n\nBei **Objekte hinzufügen** ist die Auswahl vorläufig: Ein `+` wird nach dem Antippen zu `−`, sodass die Wahl vor dem Speichern zurückgenommen werden kann. Erst **Fertig** fügt die vorgemerkten Objekte hinzu; **Abbrechen** lässt die Gruppe unverändert.\n"
concept.write_text(text)
