from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)

app_path = Path('src/App.tsx')
app = app_path.read_text()

app = replace_once(
    app,
    "type LoopEditorSnapshot = { start: number; end: number; cursor: number; focus: number; markers: number[]; zoom: number }\n",
    "type LoopEditorSnapshot = { start: number; end: number; cursor: number; focus: number; markers: number[]; zoom: number }\n"
    "type LoopConfirmation = 'save' | 'delete' | 'deleteMarkers' | null\n",
    'loop confirmation type',
)

app = replace_once(
    app,
    "function extensionForType(type: string) {\n  if (type.includes('mp4') || type.includes('m4a')) return 'm4a'\n  if (type.includes('aac')) return 'aac'\n  if (type.includes('wav')) return 'wav'\n  if (type.includes('ogg')) return 'ogg'\n  if (type.includes('flac')) return 'flac'\n  return 'mp3'\n}\n\n",
    "function extensionForType(type: string) {\n  if (type.includes('mp4') || type.includes('m4a')) return 'm4a'\n  if (type.includes('aac')) return 'aac'\n  if (type.includes('wav')) return 'wav'\n  if (type.includes('ogg')) return 'ogg'\n  if (type.includes('flac')) return 'flac'\n  return 'mp3'\n}\n\n"
    "const LOOP_ZOOM_LEVELS = Array.from({ length: 15 }, (_, index) => index + 1)\n"
    "const LOOP_PLAYBACK_RATES = [0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 5, 10, 50] as const\n"
    "const LOOP_STEP_OPTIONS = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10] as const\n"
    "const LOOP_PREVIEW_OPTIONS = [0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5, 10] as const\n\n",
    'loop editor option constants',
)

app = replace_once(
    app,
    "  const [loopRedoStack, setLoopRedoStack] = useState<LoopEditorSnapshot[]>([])\n",
    "  const [loopRedoStack, setLoopRedoStack] = useState<LoopEditorSnapshot[]>([])\n"
    "  const [loopConfirmation, setLoopConfirmation] = useState<LoopConfirmation>(null)\n",
    'loop confirmation state',
)

app = replace_once(
    app,
    "  const parsedLoopPlaybackRate = Math.max(.1, Math.min(2, Number.parseFloat(loopPlaybackRate.replace(',', '.')) || 1))\n",
    "  const parsedLoopPlaybackRate = Math.max(.05, Math.min(50, Number.parseFloat(loopPlaybackRate.replace(',', '.')) || 1))\n",
    'playback rate range',
)

app = replace_once(
    app,
    "    setLoopRedoStack([])\n    setActiveLoopEdge('start')\n",
    "    setLoopRedoStack([])\n    setLoopConfirmation(null)\n    setActiveLoopEdge('start')\n",
    'reset confirmation',
)

app = replace_once(
    app,
    "  const deleteAllMarkers = () => {\n    if (!loopMarkers.length) return\n    recordLoopEditorHistory()\n    setLoopMarkers([]); setActiveMarkerIndex(null); setLoopEditorMenuOpen(false)\n  }\n",
    "  const deleteAllMarkers = () => {\n    if (!loopMarkers.length) return\n    recordLoopEditorHistory()\n    setLoopMarkers([]); setActiveMarkerIndex(null); setLoopEditorMenuOpen(false); setLoopConfirmation(null)\n  }\n",
    'marker delete confirmation close',
)

app = replace_once(
    app,
    "    setMessage(`Loop für „${editorSong.name}“ gespeichert.`)\n  }\n",
    "    setLoopConfirmation(null)\n    setMessage(`Loop für „${editorSong.name}“ gespeichert.`)\n  }\n",
    'save confirmation close',
)

app = replace_once(
    app,
    "  const removeCurrentLoop = async () => { if (!currentSong) return; await updateSong({ ...currentSong, loopStart: undefined, loopEnd: undefined, loopConfidence: undefined, loopEnabled: false }, true) }\n",
    "  const removeCurrentLoop = async () => { if (!currentSong) return; await updateSong({ ...currentSong, loopStart: undefined, loopEnd: undefined, loopConfidence: undefined, loopEnabled: false }, true); setLoopConfirmation(null) }\n",
    'loop delete confirmation close',
)

app = replace_once(
    app,
    "<button className=\"danger-button\" type=\"button\" onClick={() => void removeCurrentLoop()}>Loop entfernen</button>",
    "<button className=\"danger-button\" type=\"button\" onClick={() => setLoopConfirmation('delete')}>Loop entfernen</button>",
    'loop delete request',
)

app = replace_once(
    app,
    "          <label className=\"neutral-command\"><span>Zoom</span><input type=\"number\" min=\"1\" max=\"16\" step=\"0.25\" value={loopZoom} onChange={(event) => setLoopZoom(Math.max(1, Math.min(16, Number(event.target.value) || 1)))} /><b>×</b></label>\n"
    "          <label className=\"cursor-command\"><span>Cursor Geschwindigkeit</span><input inputMode=\"decimal\" value={loopPlaybackRate} onChange={(event) => setLoopPlaybackRate(event.target.value)} onBlur={() => setLoopPlaybackRate(String(parsedLoopPlaybackRate))} /><b>×</b></label>",
    "          <label className=\"neutral-command\"><span>Zoom</span><select value={loopZoom} onChange={(event) => setLoopZoom(Number(event.target.value))}>{LOOP_ZOOM_LEVELS.map((level) => <option key={level} value={level}>{level}×</option>)}</select></label>\n"
    "          <label className=\"cursor-command\"><span>Cursor Geschwindigkeit</span><select value={loopPlaybackRate} onChange={(event) => setLoopPlaybackRate(event.target.value)}>{LOOP_PLAYBACK_RATES.map((rate) => <option key={rate} value={String(rate)}>{Math.round(rate * 100)}%</option>)}</select></label>",
    'zoom and speed selects',
)

app = replace_once(
    app,
    "          <label className=\"marker-command\"><span>Markierungen</span><button className={`switch-control${markersEnabled ? ' is-on' : ' is-off'}`} type=\"button\" onClick={() => setMarkersEnabled((value) => !value)} aria-label=\"Markierungen umschalten\"><i /></button></label>\n"
    "          <button className=\"marker-clear-all\" type=\"button\" onClick={deleteAllMarkers} disabled={!loopMarkers.length}>Alle Markierungen löschen</button>",
    "          <label className=\"marker-command\"><span>Markierungen</span><button className={`switch-control${markersEnabled ? ' is-on' : ' is-off'}`} type=\"button\" onClick={() => setMarkersEnabled((value) => !value)} aria-label=\"Markierungen umschalten\"><i /></button></label>\n"
    "          <div className=\"marker-command-actions\"><button className=\"marker-set-top\" type=\"button\" onClick={setMarker} disabled={!markersEnabled}>Markierung setzen</button><button className=\"marker-clear-all\" type=\"button\" onClick={() => setLoopConfirmation('deleteMarkers')} disabled={!loopMarkers.length}>Alle Markierungen löschen</button></div>",
    'marker top actions',
)

app = app.replace("<em>{formatTime(marker)}</em>", "<em>{formatPrecise(marker)}</em>")
app = app.replace("{formatTime(loopDraftStart)}</span><button className={`loop-handle start", "{formatPrecise(loopDraftStart)}</span><button className={`loop-handle start")
app = app.replace("<span className=\"loop-time-bubble loop-end-time\">{formatTime(loopDraftEnd)}</span>", "<span className=\"loop-time-bubble loop-end-time\">{formatPrecise(loopDraftEnd)}</span>")
app = app.replace("<em>{formatTime(loopCursor)}</em>", "<em>{formatPrecise(loopCursor)}</em>")
app = app.replace("<em>{formatTime(loopFocus)}</em>", "<em>{formatPrecise(loopFocus)}</em>")

old_grid = '''      <div className="loop-control-grid">
        <section className="editor-control-card focus-card"><header><span>Fokus-Standort</span><strong>{formatTime(loopFocus)}</strong></header><div className="control-step-row"><button type="button" onClick={() => nudgeFocus(-focusStepSeconds)}>◀</button><label><input inputMode="decimal" value={focusStep} onChange={(event) => setFocusStep(event.target.value)} /><b>s</b></label><button type="button" onClick={() => nudgeFocus(focusStepSeconds)}>▶</button></div></section>
        <section className="editor-control-card cursor-card"><header><span>Cursor-Standort</span><strong>{formatTime(loopCursor)}</strong></header><div className="control-step-row cursor-step-row"><button type="button" onClick={() => nudgeCursor(-cursorStepSeconds)}>◀</button><button className="mini-play" type="button" onClick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button><button type="button" onClick={() => nudgeCursor(cursorStepSeconds)}>▶</button><label><input inputMode="decimal" value={cursorStep} onChange={(event) => setCursorStep(event.target.value)} /><b>s</b></label></div></section>
        <section className="editor-control-card loop-card"><header><span>Loop Start / Loop Ende-Standort</span><strong>{formatTime(loopDraftStart)} – {formatTime(loopDraftEnd)}</strong></header><div className="loop-edge-row"><div><button type="button" onClick={() => nudgeLoopEdge('start', -edgeStepSeconds)}>◀</button><span>Start</span><button type="button" onClick={() => nudgeLoopEdge('start', edgeStepSeconds)}>▶</button></div><label><input inputMode="decimal" value={edgeStep} onChange={(event) => setEdgeStep(event.target.value)} /><b>s</b></label><div><button type="button" onClick={() => nudgeLoopEdge('end', -edgeStepSeconds)}>◀</button><span>Ende</span><button type="button" onClick={() => nudgeLoopEdge('end', edgeStepSeconds)}>▶</button></div></div><div className="boundary-preview-row"><label><button type="button" onClick={() => previewBoundary('start')}>▶ Vor Start</button><input inputMode="decimal" value={previewLeadStart} onChange={(event) => setPreviewLeadStart(event.target.value)} /><b>s</b></label><label><button type="button" onClick={() => previewBoundary('end')}>▶ Vor Ende</button><input inputMode="decimal" value={previewLeadEnd} onChange={(event) => setPreviewLeadEnd(event.target.value)} /><b>s</b></label></div></section>
        <section className="editor-control-card marker-card"><header><span>Markierungen</span><strong>{activeMarker === null ? '--:--' : formatTime(activeMarker)}</strong></header><div className="marker-tabs">{loopMarkers.map((marker, index) => <button key={`${marker}-tab-${index}`} className={activeMarkerIndex === index ? 'selected' : ''} type="button" onClick={() => { setActiveMarkerIndex(index); moveCursorTo(marker, false, true) }}>{markerLabel(index)}</button>)}<button className="add-marker" type="button" onClick={setMarker} disabled={!markersEnabled}>＋</button></div><div className="marker-location-row"><button type="button" onClick={() => nudgeActiveMarker(-markerStepSeconds)} disabled={activeMarker === null}>◀</button><label><input inputMode="decimal" value={markerStep} onChange={(event) => setMarkerStep(event.target.value)} /><b>s</b></label><button type="button" onClick={() => nudgeActiveMarker(markerStepSeconds)} disabled={activeMarker === null}>▶</button><div className="marker-more-wrap"><button className="marker-more" type="button" onClick={() => setLoopEditorMenuOpen((value) => !value)}>•••</button>{loopEditorMenuOpen && <div className="marker-more-menu"><button type="button" onClick={() => moveMarkerTarget('focus')} disabled={activeMarker === null}>Zoom hinbewegen</button><button type="button" onClick={() => moveMarkerTarget('start')} disabled={activeMarker === null}>Loop-Anfang hinbewegen</button><button type="button" onClick={() => moveMarkerTarget('end')} disabled={activeMarker === null}>Loop-Ende hinbewegen</button><button type="button" onClick={deleteActiveMarker} disabled={activeMarker === null}>Markierung löschen</button><button type="button" onClick={deleteAllMarkers} disabled={!loopMarkers.length}>Alle Markierungen löschen</button></div>}</div></div></section>
      </div>
'''
new_grid = '''      <div className="loop-control-grid">
        <section className="editor-control-card focus-card"><header><span>Fokus-Standort <strong>{formatPrecise(loopFocus)}</strong></span></header><div className="control-step-row"><button type="button" onClick={() => nudgeFocus(-focusStepSeconds)}>◀</button><label className="step-select"><select value={focusStep} onChange={(event) => setFocusStep(event.target.value)}>{LOOP_STEP_OPTIONS.map((step) => <option key={step} value={String(step)}>{String(step).replace('.', ',')} s</option>)}</select></label><button type="button" onClick={() => nudgeFocus(focusStepSeconds)}>▶</button></div></section>
        <section className="editor-control-card cursor-card"><header><span>Cursor-Standort <strong>{formatPrecise(loopCursor)}</strong></span></header><div className="control-step-row cursor-step-row"><button type="button" onClick={() => nudgeCursor(-cursorStepSeconds)}>◀</button><button className="mini-play" type="button" onClick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button><button type="button" onClick={() => nudgeCursor(cursorStepSeconds)}>▶</button><label className="step-select"><select value={cursorStep} onChange={(event) => setCursorStep(event.target.value)}>{LOOP_STEP_OPTIONS.map((step) => <option key={step} value={String(step)}>{String(step).replace('.', ',')} s</option>)}</select></label></div></section>
        <section className="editor-control-card loop-card"><header><span>Loop-Standort <strong>Start {formatPrecise(loopDraftStart)} · Ende {formatPrecise(loopDraftEnd)}</strong></span></header><div className="loop-edge-row"><div><button type="button" onClick={() => nudgeLoopEdge('start', -edgeStepSeconds)}>◀</button><span>Start</span><button type="button" onClick={() => nudgeLoopEdge('start', edgeStepSeconds)}>▶</button></div><label className="step-select"><select value={edgeStep} onChange={(event) => setEdgeStep(event.target.value)}>{LOOP_STEP_OPTIONS.map((step) => <option key={step} value={String(step)}>{String(step).replace('.', ',')} s</option>)}</select></label><div><button type="button" onClick={() => nudgeLoopEdge('end', -edgeStepSeconds)}>◀</button><span>Ende</span><button type="button" onClick={() => nudgeLoopEdge('end', edgeStepSeconds)}>▶</button></div></div><div className="boundary-preview-row"><label><button type="button" onClick={() => previewBoundary('start')}>▶ Vor Start</button><select value={previewLeadStart} onChange={(event) => setPreviewLeadStart(event.target.value)}>{LOOP_PREVIEW_OPTIONS.map((lead) => <option key={lead} value={String(lead)}>{String(lead).replace('.', ',')} s</option>)}</select></label><label><button type="button" onClick={() => previewBoundary('end')}>▶ Vor Ende</button><select value={previewLeadEnd} onChange={(event) => setPreviewLeadEnd(event.target.value)}>{LOOP_PREVIEW_OPTIONS.map((lead) => <option key={lead} value={String(lead)}>{String(lead).replace('.', ',')} s</option>)}</select></label></div></section>
        <section className="editor-control-card marker-card"><header><span>Markierung-Standort <strong>{activeMarker === null ? '--:--.---' : formatPrecise(activeMarker)}</strong></span></header><div className="marker-tabs">{loopMarkers.map((marker, index) => <button key={`${marker}-tab-${index}`} className={activeMarkerIndex === index ? 'selected' : ''} type="button" onClick={() => { setActiveMarkerIndex(index); moveCursorTo(marker, false, true) }}>{markerLabel(index)}</button>)}<button className="add-marker" type="button" onClick={setMarker} disabled={!markersEnabled}>＋</button></div><div className="marker-location-row"><button type="button" onClick={() => nudgeActiveMarker(-markerStepSeconds)} disabled={activeMarker === null}>◀</button><label className="step-select"><select value={markerStep} onChange={(event) => setMarkerStep(event.target.value)}>{LOOP_STEP_OPTIONS.map((step) => <option key={step} value={String(step)}>{String(step).replace('.', ',')} s</option>)}</select></label><button type="button" onClick={() => nudgeActiveMarker(markerStepSeconds)} disabled={activeMarker === null}>▶</button><div className="marker-more-wrap"><button className="marker-more" type="button" onClick={() => setLoopEditorMenuOpen((value) => !value)}>•••</button>{loopEditorMenuOpen && <div className="marker-more-menu"><button type="button" onClick={() => moveMarkerTarget('focus')} disabled={activeMarker === null}>Zoom hinbewegen</button><button type="button" onClick={() => moveMarkerTarget('start')} disabled={activeMarker === null}>Loop-Anfang hinbewegen</button><button type="button" onClick={() => moveMarkerTarget('end')} disabled={activeMarker === null}>Loop-Ende hinbewegen</button><button type="button" onClick={deleteActiveMarker} disabled={activeMarker === null}>Markierung löschen</button><button type="button" onClick={() => { setLoopEditorMenuOpen(false); setLoopConfirmation('deleteMarkers') }} disabled={!loopMarkers.length}>Alle Markierungen löschen</button></div>}</div></div></section>
      </div>
'''
app = replace_once(app, old_grid, new_grid, 'compact control grid')

app = replace_once(
    app,
    "<div className=\"loop-editor-actions\"><button className=\"save-loop\" type=\"button\" onClick={() => void saveLoopDraft()} disabled={!editorDuration || loopDraftEnd <= loopDraftStart}>Loop speichern</button>",
    "<div className=\"loop-editor-actions\"><button className=\"save-loop\" type=\"button\" onClick={() => setLoopConfirmation('save')} disabled={!editorDuration || loopDraftEnd <= loopDraftStart}>Loop speichern</button>",
    'save confirmation request',
)

confirmation_markup = '''
    {loopConfirmation === 'save' && editorSong && <div className="modal-backdrop" onMouseDown={() => setLoopConfirmation(null)}><div className="confirm-dialog" onMouseDown={(event) => event.stopPropagation()}><h2>Loop speichern?</h2><p>Der Bereich {formatPrecise(loopDraftStart)} bis {formatPrecise(loopDraftEnd)} und die aktuellen Markierungen werden gespeichert.</p><div className="dialog-actions"><button type="button" onClick={() => setLoopConfirmation(null)}>Abbrechen</button><button className="save-loop-confirm" type="button" onClick={() => void saveLoopDraft()}>Loop speichern</button></div></div></div>}
    {loopConfirmation === 'delete' && currentSong && <div className="modal-backdrop" onMouseDown={() => setLoopConfirmation(null)}><div className="confirm-dialog" onMouseDown={(event) => event.stopPropagation()}><h2>Loop löschen?</h2><p>Der gespeicherte Loop von „{currentSong.name}“ wird entfernt. Die Audiodatei bleibt unverändert.</p><div className="dialog-actions"><button type="button" onClick={() => setLoopConfirmation(null)}>Abbrechen</button><button className="danger-button" type="button" onClick={() => void removeCurrentLoop()}>Loop löschen</button></div></div></div>}
    {loopConfirmation === 'deleteMarkers' && <div className="modal-backdrop" onMouseDown={() => setLoopConfirmation(null)}><div className="confirm-dialog" onMouseDown={(event) => event.stopPropagation()}><h2>Alle Markierungen löschen?</h2><p>Alle orangefarbenen Markierungen dieses Loop-Entwurfs werden entfernt.</p><div className="dialog-actions"><button type="button" onClick={() => setLoopConfirmation(null)}>Abbrechen</button><button className="danger-button" type="button" onClick={deleteAllMarkers}>Alle löschen</button></div></div></div>}
'''
app = replace_once(app, "\n    {renameTarget && <div className=\"modal-backdrop\"", confirmation_markup + "\n    {renameTarget && <div className=\"modal-backdrop\"", 'confirmation modals')

app_path.write_text(app)

css_path = Path('src/loopEditor.css')
css = css_path.read_text()
css += r'''

/* Compact refinement after iPad layout testing */
.loop-command-fields select {
  min-width: 72px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid #3c4657;
  border-radius: 8px;
  background: #090d14;
  color: #fff;
}
.marker-command-actions { display: grid; gap: 5px; }
.marker-set-top, .marker-clear-all { min-height: 34px; padding: 0 9px; border-radius: 9px; font-size: 11px; }
.marker-set-top { border: 1px solid rgba(245,158,11,.48); background: rgba(146,64,14,.22); color: #fed7aa !important; cursor: pointer; }
.marker-set-top:disabled { opacity: .35; }
.loop-control-grid {
  grid-template-columns: minmax(150px,.8fr) minmax(190px,1fr) minmax(340px,1.55fr);
  gap: 8px;
  margin-top: 12px;
}
.editor-control-card { padding: 9px 10px; border-radius: 11px; }
.editor-control-card header { margin-bottom: 7px; }
.editor-control-card header span { display: flex; flex-wrap: wrap; align-items: baseline; gap: 5px; font-size: 11px; }
.editor-control-card header span strong { font-size: 11px; font-variant-numeric: tabular-nums; }
.focus-card header span strong { color: #86efac; }
.cursor-card header span strong { color: #93c5fd; }
.loop-card header span strong { color: #fca5a5; }
.marker-card header span strong { color: #fdba74; }
.control-step-row, .loop-edge-row, .marker-location-row { gap: 5px; }
.control-step-row > button, .loop-edge-row button, .marker-location-row > button, .boundary-preview-row button, .marker-tabs button, .marker-more {
  min-width: 34px;
  min-height: 34px;
  padding: 0 7px;
  border-radius: 8px;
}
.step-select select, .boundary-preview-row select {
  height: 34px;
  min-width: 72px;
  padding: 0 7px;
  border: 1px solid #3e4858;
  border-radius: 8px;
  background: #090d14;
  color: #fff;
}
.cursor-step-row { flex-wrap: nowrap; }
.cursor-step-row .step-select { margin-left: auto; }
.mini-play { min-width: 40px !important; }
.loop-edge-row > div { gap: 4px; }
.loop-edge-row > div span { min-width: 34px; font-size: 10px; }
.boundary-preview-row { gap: 6px; margin-top: 7px; }
.boundary-preview-row label { gap: 4px; }
.boundary-preview-row button { min-width: 88px; font-size: 10px; }
.marker-tabs { gap: 5px; margin-bottom: 7px; }
.marker-location-row { flex-wrap: nowrap; }
.marker-card { grid-column: 1 / -1; }
.loop-time-bubble, .loop-cursor em, .loop-marker em, .loop-focus-cursor em { font-size: 9px; }
.save-loop-confirm { border-color: #b91c1c !important; background: #4b171b !important; color: #fecaca !important; }
@media (min-width: 821px) and (max-width: 1040px) {
  .loop-control-grid { grid-template-columns: minmax(145px,.78fr) minmax(185px,.95fr) minmax(330px,1.5fr); }
  .loop-card { grid-column: auto; }
}
@media (max-width: 820px) {
  .loop-control-grid { grid-template-columns: 1fr 1fr; }
  .loop-card { grid-column: 1 / -1; }
}
@media (max-width: 620px) {
  .loop-control-grid { grid-template-columns: 1fr; }
  .loop-card, .marker-card { grid-column: auto; }
  .cursor-step-row, .marker-location-row { flex-wrap: wrap; }
}
'''
css_path.write_text(css)

arch_path = Path('architecture.md')
arch = arch_path.read_text()
arch = replace_once(
    arch,
    "Oben liegt eine kompakte, beim Scrollen sichtbare Steuerleiste mit Zurück/Vor sowie **lokalem Editor-Undo/Redo**. Daneben stehen Eingabefelder für Zoom und Cursor-Geschwindigkeit. `Fokus folgt Cursor` ist dreistufig: Zentrieren, seitenweises Umblättern oder aus. Loop-Kasten, Cursor-Loop und Markierungen werden als Schalter dargestellt. Die erläuternden Begriffe aus der Skizze in Klammern erscheinen nicht als sichtbarer UI-Text.",
    "Oben liegt eine kompakte, beim Scrollen sichtbare Steuerleiste mit Zurück/Vor sowie **lokalem Editor-Undo/Redo**. Zoom wird über eine Liste von 1× bis 15× gewählt. Die Cursor-Geschwindigkeit wird über 5%, 10%, 25%, 50%, 75%, 100%, 150%, 200%, 500%, 1000% oder 5000% gewählt. `Fokus folgt Cursor` ist dreistufig: Zentrieren, seitenweises Umblättern oder aus. Loop-Kasten, Cursor-Loop und Markierungen werden als Schalter dargestellt. Die erläuternden Begriffe aus der Skizze in Klammern erscheinen nicht als sichtbarer UI-Text.",
    'architecture top controls',
)
arch = replace_once(
    arch,
    "Unter der Zeitachse liegen getrennte Präzisionsbereiche für Fokus-Standort, Cursor-Standort, Loop-Start/-Ende und Markierungen. Fokus, Cursor und Markierungen besitzen jeweils eine frei eingebbare Schrittweite in Sekunden. Loop-Start und Loop-Ende teilen sich die frei eingebbare Kanten-Schrittweite. Vor Start und vor Ende kann mit getrennten Vorlaufwerten abgespielt werden.",
    "Unter der Zeitachse liegen kompakte Präzisionsbereiche. Fokus und Cursor stehen links, der Loop-Block direkt rechts daneben; Markierungen liegen darunter über die ganze Breite. Direkt hinter jedem Standort steht die Position bis auf Millisekunden. Freie Zahleneingaben wurden durch kompakte Auswahllisten für Schrittweiten ersetzt. Auch Vorlaufwerte sind positive Auswahlen und bedeuten ausschließlich eine Position **vor** Start bzw. Ende.",
    'architecture compact controls',
)
arch = replace_once(
    arch,
    "Markierungen werden als A, B, C usw. angezeigt. Eine ausgewählte Markierung kann über `•••` zum Zoom-Fokus, zum Loop-Anfang oder zum Loop-Ende übertragen, einzeln gelöscht oder zusammen mit allen Markierungen gelöscht werden.\n\nDie Audiodatei bleibt beim gesamten Bearbeiten unverändert. `Loop speichern` persistiert weiterhin ausschließlich Start, Ende, Aktivstatus und Marker als Metadaten.",
    "Markierungen werden als A, B, C usw. angezeigt. Über den globalen Löschknopf steht ein eigener **Markierung setzen**-Knopf. Eine ausgewählte Markierung kann über `•••` zum Zoom-Fokus, zum Loop-Anfang oder zum Loop-Ende übertragen oder einzeln gelöscht werden. Das Löschen aller Markierungen verlangt eine Bestätigung.\n\nDie Audiodatei bleibt beim gesamten Bearbeiten unverändert. `Loop speichern` persistiert weiterhin ausschließlich Start, Ende, Aktivstatus und Marker als Metadaten. Sowohl **Loop speichern** als auch **Loop löschen** verlangen vor der Änderung eine Bestätigung.",
    'architecture confirmations',
)
arch_path.write_text(arch)

concept_path = Path('concept.md')
concept = concept_path.read_text()
concept = replace_once(
    concept,
    "Oben stehen Zurück/Vor, Editor-Undo/Redo sowie kompakte Eingabefelder für Zoom und Cursor-Geschwindigkeit. **Fokus folgt Cursor** hat drei Zustände: zentriert folgen, seitenweise weiterblättern oder aus. Loop-Kasten, Cursor-Loop und Markierungen werden mit Schaltern gesteuert. Erläuterungen aus der Skizze, die in Klammern standen, werden nicht als zusätzlicher Text angezeigt.",
    "Oben stehen Zurück/Vor und Editor-Undo/Redo. Zoom ist eine Auswahlliste von **1× bis 15×**. Die Cursor-Geschwindigkeit bietet **5%, 10%, 25%, 50%, 75%, 100%, 150%, 200%, 500%, 1000% und 5000%**. **Fokus folgt Cursor** hat drei Zustände: zentriert folgen, seitenweise weiterblättern oder aus. Loop-Kasten, Cursor-Loop und Markierungen werden mit Schaltern gesteuert. Erläuterungen aus der Skizze, die in Klammern standen, werden nicht als zusätzlicher Text angezeigt.",
    'concept top controls',
)
concept = replace_once(
    concept,
    "Unter der Zeitachse gibt es vier Funktionsblöcke:\n\n- **Fokus-Standort:** frei einstellbare Schrittweite und links/rechts bewegen.\n- **Cursor-Standort:** frei einstellbare Spulweite, links/rechts sowie Play/Pause.\n- **Loop Start / Loop Ende:** getrennte Start-/Endknöpfe mit gemeinsamer frei einstellbarer Kanten-Schrittweite sowie getrennte Vorlaufwerte für „Vor Start“ und „Vor Ende“.\n- **Markierungen:** A, B, C usw., frei einstellbare Markierungs-Schrittweite und `•••` mit „Zoom hinbewegen“, „Loop-Anfang hinbewegen“, „Loop-Ende hinbewegen“, „Markierung löschen“ und „Alle Markierungen löschen“.",
    "Unter der Zeitachse stehen **Fokus**, **Cursor** und **Loop** in einer kompakten Reihe; der Loop-Block liegt rechts neben Fokus und Cursor. Die Markierungen liegen darunter. Direkt hinter jedem Wort „Standort“ steht die aktuelle Position bis auf Millisekunden. Die bisherigen freien Zahleneingaben sind durch kleine Schritt-Auswahllisten ersetzt. Auch die Vorlaufwerte werden ausgewählt und bedeuten immer nur „x Sekunden vor Start“ bzw. „x Sekunden vor Ende“.\n\nMarkierungen heißen A, B, C usw. Oberhalb von „Alle Markierungen löschen“ steht ein eigener **Markierung setzen**-Knopf. Das `•••` enthält weiterhin „Zoom hinbewegen“, „Loop-Anfang hinbewegen“, „Loop-Ende hinbewegen“ und „Markierung löschen“.",
    'concept compact controls',
)
concept = replace_once(
    concept,
    "Loop-Kasten sperren, Cursor-Loop, Marker an/aus, Fokus-Modus, Zoom und Geschwindigkeit verändern nur den Editorzustand. **Loop speichern** schreibt weiterhin nur Metadaten und niemals den Audio-Blob.",
    "Loop-Kasten sperren, Cursor-Loop, Marker an/aus, Fokus-Modus, Zoom und Geschwindigkeit verändern nur den Editorzustand. **Loop speichern** schreibt weiterhin nur Metadaten und niemals den Audio-Blob. Vor **Loop speichern**, **Loop löschen** und **Alle Markierungen löschen** erscheint jeweils eine Sicherheitsabfrage.",
    'concept confirmations',
)
concept_path.write_text(concept)
