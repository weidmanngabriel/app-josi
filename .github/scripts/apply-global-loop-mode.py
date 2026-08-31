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
    "type RepeatSetting = { kind: 'infinite' } | { kind: 'count'; count: number } | null\n",
    "type RepeatSetting = { kind: 'infinite' } | { kind: 'count'; count: number } | null\ntype LoopActivationMode = 'enabled' | 'disabled' | 'manual'\ntype LoopManualRequest = { ids: string[]; enabled: boolean } | null\n",
    'loop mode types',
)

replace_once(
    "  const [settingsOpen, setSettingsOpen] = useState(false)\n  const [seekSeconds, setSeekSeconds] = useState(() => Number(localStorage.getItem('josi-seek-seconds')) || 10)\n",
    "  const [settingsOpen, setSettingsOpen] = useState(false)\n  const [seekSeconds, setSeekSeconds] = useState(() => Number(localStorage.getItem('josi-seek-seconds')) || 10)\n  const [loopActivationMode, setLoopActivationMode] = useState<LoopActivationMode>(() => { const value = localStorage.getItem('josi-loop-activation-mode'); return value === 'enabled' || value === 'manual' ? value : 'disabled' })\n  const [loopManualRequest, setLoopManualRequest] = useState<LoopManualRequest>(null)\n",
    'loop mode state',
)

# Persist setting near seek persistence.
needle = "useEffect(() => { localStorage.setItem('josi-seek-seconds', String(seekSeconds)) }, [seekSeconds])"
if needle not in app:
    raise SystemExit('Missing App replacement: seek persistence')
app = app.replace(needle, needle + "\n  useEffect(() => { localStorage.setItem('josi-loop-activation-mode', loopActivationMode) }, [loopActivationMode])", 1)

# Add effective loop helper near current song derivations; use a function so playback and UI agree.
anchor = "  const currentSong = songs.find((song) => song.id === currentSongId) ?? null\n"
if anchor not in app:
    raise SystemExit('Missing App replacement: currentSong anchor')
app = app.replace(anchor, anchor + "  const hasLoop = (song: Song | null | undefined) => Boolean(song && song.loopStart !== undefined && song.loopEnd !== undefined)\n  const isLoopActive = (song: Song | null | undefined) => hasLoop(song) && (loopActivationMode === 'enabled' || (loopActivationMode === 'manual' && Boolean(song?.loopEnabled)))\n", 1)

# Playback loop checks.
app = app.replace("!loopEditorSongId && song.loopEnabled && song.loopStart !== undefined && song.loopEnd !== undefined", "!loopEditorSongId && isLoopActive(song) && song.loopStart !== undefined && song.loopEnd !== undefined", 1)
app = app.replace("[isPlaying, currentSong?.id, currentSong?.loopEnabled, currentSong?.loopStart, currentSong?.loopEnd, loopEditorSongId, cursorLoopEnabled, loopDraftStart, loopDraftEnd, repeatSetting, repeatRemaining]", "[isPlaying, currentSong?.id, currentSong?.loopEnabled, currentSong?.loopStart, currentSong?.loopEnd, loopActivationMode, loopEditorSongId, cursorLoopEnabled, loopDraftStart, loopDraftEnd, repeatSetting, repeatRemaining]", 1)

old_ended = """    if (currentSong?.loopEnabled && currentSong.loopStart !== undefined && currentSong.loopEnd !== undefined && finiteAvailable) {
      const automatic = loopOverlapBlockedRef.current ? automaticLoopSeamsRef.current.get(currentSong.id) : undefined
      audio.currentTime = automatic?.start ?? currentSong.loopStart
      setCurrentTime(audio.currentTime)
      if (repeatSetting?.kind === 'count') consumeRepeat()
      void audio.play().catch(() => undefined)
      return
    }
    if (currentSong && !currentSong.loopEnabled && repeatSetting?.kind === 'infinite') { restartFinishedAudio(audio); return }
    if (currentSong && !currentSong.loopEnabled && repeatSetting?.kind === 'count' && remaining > 0) { consumeRepeat(); restartFinishedAudio(audio); return }"""
new_ended = """    const loopActive = isLoopActive(currentSong)
    if (loopActive && currentSong?.loopStart !== undefined && currentSong.loopEnd !== undefined && finiteAvailable) {
      const automatic = loopOverlapBlockedRef.current ? automaticLoopSeamsRef.current.get(currentSong.id) : undefined
      audio.currentTime = automatic?.start ?? currentSong.loopStart
      setCurrentTime(audio.currentTime)
      if (repeatSetting?.kind === 'count') consumeRepeat()
      void audio.play().catch(() => undefined)
      return
    }
    if (currentSong && !loopActive && repeatSetting?.kind === 'infinite') { restartFinishedAudio(audio); return }
    if (currentSong && !loopActive && repeatSetting?.kind === 'count' && remaining > 0) { consumeRepeat(); restartFinishedAudio(audio); return }"""
replace_once(old_ended, new_ended, 'ended effective loop')

old_toggle = """  const toggleSongLoop = async (id: string) => { const song = songs.find((item) => item.id === id); if (!song || song.loopStart === undefined || song.loopEnd === undefined) return; if (song.loopEnabled && id === currentSongId) cancelLoopTransition(); await updateSong({ ...song, loopEnabled: !song.loopEnabled }, true); setOverflowMenu(null) }
  const toggleCurrentLoop = async () => { if (!currentSong || currentSong.loopStart === undefined || currentSong.loopEnd === undefined) return; if (currentSong.loopEnabled) cancelLoopTransition(); await updateSong({ ...currentSong, loopEnabled: !currentSong.loopEnabled }, true) }
"""
new_toggle = """  const applyManualLoopChange = async (ids: string[], enabled: boolean) => {
    const targets = songs.filter((song) => ids.includes(song.id) && hasLoop(song))
    if (!targets.length) return
    if (!enabled && targets.some((song) => song.id === currentSongId)) cancelLoopTransition()
    recordHistory()
    const replacements = new Map(targets.map((song) => [song.id, { ...song, loopEnabled: enabled }]))
    const nextSongs = songs.map((song) => replacements.get(song.id) ?? song)
    await Promise.all(targets.map((song) => saveSong({ ...song, loopEnabled: enabled })))
    setSongs(nextSongs)
    setOverflowMenu(null); setSelectionMenuOpen(false)
  }
  const requestManualLoopChange = async (ids: string[], enabled: boolean) => {
    const validIds = ids.filter((id) => hasLoop(songs.find((song) => song.id === id)))
    if (!validIds.length) return
    if (loopActivationMode !== 'manual') { setLoopManualRequest({ ids: validIds, enabled }); setOverflowMenu(null); setSelectionMenuOpen(false); return }
    await applyManualLoopChange(validIds, enabled)
  }
  const toggleSongLoop = async (id: string) => { const song = songs.find((item) => item.id === id); if (!hasLoop(song)) return; await requestManualLoopChange([id], !isLoopActive(song)) }
  const toggleCurrentLoop = async () => { if (!hasLoop(currentSong)) return; await requestManualLoopChange([currentSong!.id], !isLoopActive(currentSong)) }
"""
replace_once(old_toggle, new_toggle, 'manual loop change handlers')

# Selected-loop derivation after select all helper.
anchor2 = "  const selectAllVisible = () => setSelectedSongIds(new Set(visibleSongs.map((song) => song.id)))\n"
if anchor2 not in app:
    raise SystemExit('Missing App replacement: selectAllVisible')
app = app.replace(anchor2, anchor2 + "  const selectedLoopSongs = songs.filter((song) => selectedSongIds.has(song.id) && hasLoop(song))\n  const selectionContainsOnlyLoops = selectedSongIds.size > 0 && selectedLoopSongs.length === selectedSongIds.size\n", 1)

# Selection menu buttons directly above delete.
old_sel = """<button type=\"button\" onClick={() => openTagChooser('song', [...selectedSongIds])} disabled={!selectedSongIds.size}>Tags</button><button className=\"danger-menu-action\" type=\"button\" onClick={() => { setSelectionMenuOpen(false); setSelectionConfirmation('deleteSelected') }} disabled={!selectedSongIds.size}>Alle löschen</button>"""
new_sel = """<button type=\"button\" onClick={() => openTagChooser('song', [...selectedSongIds])} disabled={!selectedSongIds.size}>Tags</button>{selectionContainsOnlyLoops && <><button type=\"button\" onClick={() => void requestManualLoopChange([...selectedSongIds], true)}>Alle Loops aktivieren</button><button type=\"button\" onClick={() => void requestManualLoopChange([...selectedSongIds], false)}>Alle Loops deaktivieren</button></>}<button className=\"danger-menu-action\" type=\"button\" onClick={() => { setSelectionMenuOpen(false); setSelectionConfirmation('deleteSelected') }} disabled={!selectedSongIds.size}>Alle löschen</button>"""
replace_once(old_sel, new_sel, 'selection loop buttons')

# Menu labels use effective state.
app = app.replace("{song.loopEnabled ? 'Loop deaktivieren' : 'Loop aktivieren'}", "{isLoopActive(song) ? 'Loop deaktivieren' : 'Loop aktivieren'}")

# Detail loop button uses effective state.
old_detail = """<button className={currentSong.loopEnabled ? 'loop-active' : ''} type=\"button\" onClick={() => void toggleCurrentLoop()}>{currentSong.loopEnabled ? 'Loop aktiv' : 'Loop aktivieren'}</button>"""
new_detail = """<button className={isLoopActive(currentSong) ? 'loop-active' : ''} type=\"button\" onClick={() => void toggleCurrentLoop()}>{isLoopActive(currentSong) ? 'Loop aktiv' : 'Loop aktivieren'}</button>"""
replace_once(old_detail, new_detail, 'detail loop effective state')

# Settings add tri-state row after seek row.
old_settings = """<div className=\"settings-row\"><div><strong>Spulweite</strong><small>Für ⏪/⏩ und die Detailansicht.</small></div><select value={seekSeconds} onChange={(event) => setSeekSeconds(Number(event.target.value))}>{SEEK_SECOND_OPTIONS.map((value) => <option key={value} value={value}>{value} Sekunden</option>)}</select></div><div className=\"settings-row settings-info-row\">"""
new_settings = """<div className=\"settings-row\"><div><strong>Spulweite</strong><small>Für ⏪/⏩ und die Detailansicht.</small></div><select value={seekSeconds} onChange={(event) => setSeekSeconds(Number(event.target.value))}>{SEEK_SECOND_OPTIONS.map((value) => <option key={value} value={value}>{value} Sekunden</option>)}</select></div><div className=\"settings-row\"><div><strong>Loops</strong><small>Bestimmt global, ob vorhandene Loops automatisch an, aus oder pro Lied manuell gesteuert werden.</small></div><select value={loopActivationMode} onChange={(event) => { const next = event.target.value as LoopActivationMode; if (next === 'disabled') cancelLoopTransition(); setLoopActivationMode(next) }}><option value=\"enabled\">Aktiviert</option><option value=\"disabled\">Deaktiviert</option><option value=\"manual\">Manuell</option></select></div><div className=\"settings-row settings-info-row\">"""
replace_once(old_settings, new_settings, 'settings loop mode row')

# Confirmation modal before rename target block.
modal_anchor = "    {renameTarget && <div className=\"modal-backdrop\""
if modal_anchor not in app:
    raise SystemExit('Missing App replacement: modal anchor')
confirm = """    {loopManualRequest && <div className=\"modal-backdrop\" onMouseDown={() => setLoopManualRequest(null)}><div className=\"confirm-dialog\" onMouseDown={(event) => event.stopPropagation()}><h2>Auf „Manuell“ umschalten?</h2><p>Die globale Loop-Einstellung steht aktuell auf „{loopActivationMode === 'enabled' ? 'Aktiviert' : 'Deaktiviert'}“. Um {loopManualRequest.ids.length === 1 ? 'diesen Loop' : 'diese Loops'} individuell {loopManualRequest.enabled ? 'zu aktivieren' : 'zu deaktivieren'}, muss Josi auf „Manuell“ wechseln.</p><div className=\"dialog-actions\"><button type=\"button\" onClick={() => setLoopManualRequest(null)}>Nein</button><button type=\"button\" onClick={() => { const request = loopManualRequest; setLoopActivationMode('manual'); setLoopManualRequest(null); void applyManualLoopChange(request.ids, request.enabled) }}>Ja, auf Manuell</button></div></div></div>}\n"""
app = app.replace(modal_anchor, confirm + modal_anchor, 1)

app_path.write_text(app)

# Documentation append/update.
arch = Path('architecture.md')
text = arch.read_text()
text += """\n\n## Globale Loop-Aktivierung\n\nIn den Einstellungen gibt es eine gespeicherte globale Loop-Regel mit drei Zuständen: `Aktiviert`, `Deaktiviert` und `Manuell`. Ohne bestehende Einstellung startet Josi mit `Deaktiviert`. Die automatischen Zustände verändern keine Song-Metadaten: `Aktiviert` behandelt jeden Song mit gesetztem Loop bei Wiedergabe und Anzeige als aktiv, `Deaktiviert` behandelt jeden vorhandenen Loop als inaktiv. Nur `Manuell` verwendet `song.loopEnabled`.\n\nWenn eine einzelne Loop-Aktivierung in Song-Menü oder Detailansicht bzw. eine Mehrfachaktion auf ausgewählten Loop-Songs in einem automatischen Modus angefordert wird, fragt Josi vorab nach dem Wechsel zu `Manuell`. Bei Ablehnung wird die Aktion vollständig verworfen. Bei Zustimmung wechselt die globale Regel auf `Manuell` und schreibt erst danach die individuellen `loopEnabled`-Werte als Metadaten. Im Song-Auswahlmenü erscheinen `Alle Loops aktivieren` und `Alle Loops deaktivieren` nur dann, wenn sämtliche ausgewählten Songs einen gespeicherten Loop besitzen.\n"""
arch.write_text(text)

concept = Path('concept.md')
text = concept.read_text()
text += """\n\n## Globale Loop-Regel\n\nIn **Einstellungen → Loops** stehen drei Optionen: **Aktiviert**, **Deaktiviert** und **Manuell**. Standard ist **Deaktiviert**. Aktiviert/Deaktiviert gelten automatisch für alle Lieder mit vorhandenem Loop, ohne deren individuelle Schalter umzuschreiben. **Manuell** verwendet wieder die pro Lied gespeicherte Aktivierung.\n\nVersucht man in einem automatischen Modus einen einzelnen Loop in der näheren Songansicht oder im `•••` umzuschalten, fragt Josi zuerst, ob auf **Manuell** gewechselt werden soll. **Nein** bricht die Änderung ab. Dasselbe gilt bei Mehrfachauswahl. Wenn ausschließlich Songs mit vorhandenen Loops ausgewählt sind, stehen im Auswahl-`•••` direkt über **Alle löschen** die Aktionen **Alle Loops aktivieren** und **Alle Loops deaktivieren**.\n"""
concept.write_text(text)
