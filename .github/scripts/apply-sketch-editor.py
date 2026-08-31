from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one regex match, found {count}")
    return updated

app_path = Path('src/App.tsx')
app = app_path.read_text()

app = replace_once(
    app,
    "type LoopDrag = { kind: 'move' | 'start' | 'end' | 'cursor' | 'focus'; offset: number } | null\n",
    "type LoopDrag = { kind: 'move' | 'start' | 'end' | 'cursor' | 'focus'; offset: number } | null\n"
    "type FocusFollowMode = 'center' | 'page' | 'off'\n"
    "type LoopEditorSnapshot = { start: number; end: number; cursor: number; focus: number; markers: number[]; zoom: number }\n",
    'loop editor types',
)

app = replace_once(
    app,
    "const LOOP_PLAYBACK_RATES = [0.1, 0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.5, 2] as const\n\n",
    "",
    'remove playback presets constant',
)

app = replace_once(
    app,
    "  const [focusFollowsCursor, setFocusFollowsCursor] = useState(true)\n"
    "  const [loopMarkers, setLoopMarkers] = useState<number[]>([])\n"
    "  const [activeLoopEdge, setActiveLoopEdge] = useState<'start' | 'end'>('start')\n"
    "  const [previewLead, setPreviewLead] = useState('1')\n"
    "  const [edgeStep, setEdgeStep] = useState('0,01')\n"
    "  const [waveform, setWaveform] = useState<number[]>([])\n"
    "  const [waveformStatus, setWaveformStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle')\n"
    "  const [loopPlaybackRate, setLoopPlaybackRate] = useState(1)\n",
    "  const [focusFollowMode, setFocusFollowMode] = useState<FocusFollowMode>('center')\n"
    "  const [loopMarkers, setLoopMarkers] = useState<number[]>([])\n"
    "  const [activeMarkerIndex, setActiveMarkerIndex] = useState<number | null>(null)\n"
    "  const [activeLoopEdge, setActiveLoopEdge] = useState<'start' | 'end'>('start')\n"
    "  const [previewLeadStart, setPreviewLeadStart] = useState('1')\n"
    "  const [previewLeadEnd, setPreviewLeadEnd] = useState('1')\n"
    "  const [edgeStep, setEdgeStep] = useState('0,01')\n"
    "  const [focusStep, setFocusStep] = useState('1')\n"
    "  const [cursorStep, setCursorStep] = useState('5')\n"
    "  const [markerStep, setMarkerStep] = useState('1')\n"
    "  const [waveform, setWaveform] = useState<number[]>([])\n"
    "  const [waveformStatus, setWaveformStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle')\n"
    "  const [loopPlaybackRate, setLoopPlaybackRate] = useState('1')\n"
    "  const [loopEditorMenuOpen, setLoopEditorMenuOpen] = useState(false)\n"
    "  const [loopUndoStack, setLoopUndoStack] = useState<LoopEditorSnapshot[]>([])\n"
    "  const [loopRedoStack, setLoopRedoStack] = useState<LoopEditorSnapshot[]>([])\n",
    'editor state block',
)

app = replace_once(
    app,
    "  const editorDuration = loopEditorSongId && loopEditorSongId === currentSongId ? (duration || editorSong?.duration || 0) : (editorSong?.duration || 0)\n",
    "  const editorDuration = loopEditorSongId && loopEditorSongId === currentSongId ? (duration || editorSong?.duration || 0) : (editorSong?.duration || 0)\n"
    "  const parsedLoopPlaybackRate = Math.max(.1, Math.min(2, Number.parseFloat(loopPlaybackRate.replace(',', '.')) || 1))\n",
    'parsed editor playback rate',
)

app = replace_once(
    app,
    "    audio.playbackRate = loopEditorSongId ? loopPlaybackRate : 1\n"
    "  }, [loopEditorSongId, loopPlaybackRate, currentUrl])",
    "    audio.playbackRate = loopEditorSongId ? parsedLoopPlaybackRate : 1\n"
    "  }, [loopEditorSongId, parsedLoopPlaybackRate, currentUrl])",
    'playback rate effect',
)

app = replace_once(
    app,
    "    setLoopMarkers((editorSong.loopMarkers ?? []).filter((value) => value >= 0 && value <= editorDuration))\n"
    "    setLoopZoom(1)\n"
    "    setLoopSelectionLocked(false)\n"
    "    setMarkersEnabled(true)\n"
    "    setCursorLoopEnabled(true)\n"
    "    setFocusFollowsCursor(true)\n"
    "    setLoopPlaybackRate(1)\n"
    "    setActiveLoopEdge('start')\n",
    "    const initialMarkers = (editorSong.loopMarkers ?? []).filter((value) => value >= 0 && value <= editorDuration)\n"
    "    setLoopMarkers(initialMarkers)\n"
    "    setActiveMarkerIndex(initialMarkers.length ? 0 : null)\n"
    "    setLoopZoom(1)\n"
    "    setLoopSelectionLocked(false)\n"
    "    setMarkersEnabled(true)\n"
    "    setCursorLoopEnabled(true)\n"
    "    setFocusFollowMode('center')\n"
    "    setLoopPlaybackRate('1')\n"
    "    setPreviewLeadStart('1')\n"
    "    setPreviewLeadEnd('1')\n"
    "    setLoopEditorMenuOpen(false)\n"
    "    setLoopUndoStack([])\n"
    "    setLoopRedoStack([])\n"
    "    setActiveLoopEdge('start')\n",
    'editor reset state',
)

old_focus_effect = '''  useEffect(() => {
    if (!loopEditorSongId || !editorDuration || !focusFollowsCursor) return
    setLoopFocus(loopCursor)
    const frame = requestAnimationFrame(() => {
      const scroller = loopTimelineScrollRef.current
      const timeline = loopTimelineRef.current
      if (!scroller || !timeline) return
      const target = (loopCursor / editorDuration) * timeline.offsetWidth - scroller.clientWidth / 2
      scroller.scrollLeft = Math.max(0, Math.min(target, scroller.scrollWidth - scroller.clientWidth))
    })
    return () => cancelAnimationFrame(frame)
  }, [loopCursor, focusFollowsCursor, loopEditorSongId, editorDuration])
'''
new_focus_effect = '''  useEffect(() => {
    if (!loopEditorSongId || !editorDuration || focusFollowMode === 'off') return
    setLoopFocus(loopCursor)
    const frame = requestAnimationFrame(() => {
      const scroller = loopTimelineScrollRef.current
      const timeline = loopTimelineRef.current
      if (!scroller || !timeline) return
      const cursorX = (loopCursor / editorDuration) * timeline.offsetWidth
      if (focusFollowMode === 'center') {
        const target = cursorX - scroller.clientWidth / 2
        scroller.scrollLeft = Math.max(0, Math.min(target, scroller.scrollWidth - scroller.clientWidth))
        return
      }
      const left = scroller.scrollLeft + 24
      const right = scroller.scrollLeft + scroller.clientWidth - 24
      if (cursorX < left || cursorX > right) {
        const pageStart = Math.floor(cursorX / Math.max(scroller.clientWidth, 1)) * scroller.clientWidth
        scroller.scrollLeft = Math.max(0, Math.min(pageStart, scroller.scrollWidth - scroller.clientWidth))
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [loopCursor, focusFollowMode, loopEditorSongId, editorDuration])
'''
app = replace_once(app, old_focus_effect, new_focus_effect, 'focus follow effect')

app = replace_once(
    app,
    "    if (kind === 'focus' && focusFollowsCursor) return\n"
    "    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId)\n",
    "    if (kind === 'focus' && focusFollowMode !== 'off') return\n"
    "    recordLoopEditorHistory()\n"
    "    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId)\n",
    'drag focus gate and history',
)

old_helpers = '''  const endLoopDrag = () => { loopDragRef.current = null }
  const moveCursorTo = (value: number, play = false) => {
    const next = Math.max(0, Math.min(editorDuration || 0, value))
    setLoopCursor(next); seek(next)
    if (play) void audioRef.current?.play().catch(() => setMessage('Die Vorschau konnte nicht gestartet werden.'))
  }
  const parsedEdgeStep = () => Math.max(.001, Math.min(60, Number.parseFloat(edgeStep.replace(',', '.')) || .01))
  const nudgeActiveEdge = (delta: number) => {
    if (loopSelectionLocked || !editorDuration) return
    const minLength = .001
    if (activeLoopEdge === 'start') setLoopDraftStart((value) => Math.max(0, Math.min(value + delta, loopDraftEnd - minLength)))
    else setLoopDraftEnd((value) => Math.min(editorDuration, Math.max(value + delta, loopDraftStart + minLength)))
  }
  const setMarker = () => {
    if (!markersEnabled || !editorDuration) return
    setLoopMarkers((items) => [...items, loopCursor].sort((a, b) => a - b))
  }
  const previewBoundary = (boundary: 'start' | 'end') => {
    const lead = Math.max(0, Number.parseFloat(previewLead.replace(',', '.')) || 0)
    moveCursorTo(Math.max(0, (boundary === 'start' ? loopDraftStart : loopDraftEnd) - lead), true)
  }
'''
new_helpers = '''  const endLoopDrag = () => { loopDragRef.current = null }
  const loopEditorSnapshot = (): LoopEditorSnapshot => ({ start: loopDraftStart, end: loopDraftEnd, cursor: loopCursor, focus: loopFocus, markers: [...loopMarkers], zoom: loopZoom })
  const applyLoopEditorSnapshot = (target: LoopEditorSnapshot) => {
    setLoopDraftStart(target.start); setLoopDraftEnd(target.end); setLoopCursor(target.cursor); setLoopFocus(target.focus); setLoopMarkers([...target.markers]); setLoopZoom(target.zoom)
    setActiveMarkerIndex((index) => target.markers.length ? Math.min(index ?? 0, target.markers.length - 1) : null)
    seek(target.cursor)
  }
  const recordLoopEditorHistory = () => {
    if (!loopEditorSongId) return
    setLoopUndoStack((items) => [...items, loopEditorSnapshot()].slice(-60))
    setLoopRedoStack([])
  }
  const undoLoopEditor = () => {
    const target = loopUndoStack.at(-1)
    if (!target) return
    setLoopUndoStack((items) => items.slice(0, -1))
    setLoopRedoStack((items) => [...items, loopEditorSnapshot()].slice(-60))
    applyLoopEditorSnapshot(target)
  }
  const redoLoopEditor = () => {
    const target = loopRedoStack.at(-1)
    if (!target) return
    setLoopRedoStack((items) => items.slice(0, -1))
    setLoopUndoStack((items) => [...items, loopEditorSnapshot()].slice(-60))
    applyLoopEditorSnapshot(target)
  }
  const moveCursorTo = (value: number, play = false, remember = false) => {
    if (remember) recordLoopEditorHistory()
    const next = Math.max(0, Math.min(editorDuration || 0, value))
    setLoopCursor(next); seek(next)
    if (play) void audioRef.current?.play().catch(() => setMessage('Die Vorschau konnte nicht gestartet werden.'))
  }
  const parseEditorSeconds = (value: string, fallback: number, max = 60) => Math.max(.001, Math.min(max, Number.parseFloat(value.replace(',', '.')) || fallback))
  const parsedEdgeStep = () => parseEditorSeconds(edgeStep, .01)
  const nudgeLoopEdge = (edge: 'start' | 'end', delta: number) => {
    if (loopSelectionLocked || !editorDuration) return
    recordLoopEditorHistory()
    const minLength = .001
    setActiveLoopEdge(edge)
    if (edge === 'start') setLoopDraftStart((value) => Math.max(0, Math.min(value + delta, loopDraftEnd - minLength)))
    else setLoopDraftEnd((value) => Math.min(editorDuration, Math.max(value + delta, loopDraftStart + minLength)))
  }
  const nudgeFocus = (delta: number) => {
    if (!editorDuration) return
    recordLoopEditorHistory()
    setFocusFollowMode('off')
    setLoopFocus((value) => Math.max(0, Math.min(editorDuration, value + delta)))
  }
  const nudgeCursor = (delta: number) => moveCursorTo(loopCursor + delta, false, true)
  const setMarker = () => {
    if (!markersEnabled || !editorDuration) return
    recordLoopEditorHistory()
    const next = [...loopMarkers, loopCursor].sort((a, b) => a - b)
    setLoopMarkers(next)
    let nearest = 0
    let distance = Number.POSITIVE_INFINITY
    next.forEach((value, index) => { const currentDistance = Math.abs(value - loopCursor); if (currentDistance < distance) { distance = currentDistance; nearest = index } })
    setActiveMarkerIndex(nearest)
  }
  const nudgeActiveMarker = (delta: number) => {
    if (!markersEnabled || activeMarkerIndex === null || !editorDuration || !loopMarkers[activeMarkerIndex] && loopMarkers[activeMarkerIndex] !== 0) return
    recordLoopEditorHistory()
    const next = [...loopMarkers]
    next[activeMarkerIndex] = Math.max(0, Math.min(editorDuration, next[activeMarkerIndex] + delta))
    const selectedValue = next[activeMarkerIndex]
    next.sort((a, b) => a - b)
    setLoopMarkers(next)
    setActiveMarkerIndex(next.indexOf(selectedValue))
  }
  const deleteActiveMarker = () => {
    if (activeMarkerIndex === null || !loopMarkers.length) return
    recordLoopEditorHistory()
    const next = loopMarkers.filter((_, index) => index !== activeMarkerIndex)
    setLoopMarkers(next)
    setActiveMarkerIndex(next.length ? Math.min(activeMarkerIndex, next.length - 1) : null)
    setLoopEditorMenuOpen(false)
  }
  const deleteAllMarkers = () => {
    if (!loopMarkers.length) return
    recordLoopEditorHistory()
    setLoopMarkers([]); setActiveMarkerIndex(null); setLoopEditorMenuOpen(false)
  }
  const scrollTimelineTo = (time: number) => {
    const scroller = loopTimelineScrollRef.current
    const timeline = loopTimelineRef.current
    if (!scroller || !timeline || !editorDuration) return
    const target = (time / editorDuration) * timeline.offsetWidth - scroller.clientWidth / 2
    scroller.scrollTo({ left: Math.max(0, Math.min(target, scroller.scrollWidth - scroller.clientWidth)), behavior: 'smooth' })
  }
  const moveMarkerTarget = (target: 'focus' | 'start' | 'end') => {
    if (activeMarkerIndex === null || loopMarkers[activeMarkerIndex] === undefined || !editorDuration) return
    const marker = loopMarkers[activeMarkerIndex]
    recordLoopEditorHistory()
    if (target === 'focus') { setFocusFollowMode('off'); setLoopFocus(marker); scrollTimelineTo(marker) }
    if (target === 'start') { setActiveLoopEdge('start'); setLoopDraftStart(Math.max(0, Math.min(marker, loopDraftEnd - .001))) }
    if (target === 'end') { setActiveLoopEdge('end'); setLoopDraftEnd(Math.min(editorDuration, Math.max(marker, loopDraftStart + .001))) }
    setLoopEditorMenuOpen(false)
  }
  const previewBoundary = (boundary: 'start' | 'end') => {
    const source = boundary === 'start' ? previewLeadStart : previewLeadEnd
    const lead = Math.max(0, Number.parseFloat(source.replace(',', '.')) || 0)
    moveCursorTo(Math.max(0, (boundary === 'start' ? loopDraftStart : loopDraftEnd) - lead), true, true)
  }
  const markerLabel = (index: number) => index < 26 ? String.fromCharCode(65 + index) : `${String.fromCharCode(65 + (index % 26))}${Math.floor(index / 26) + 1}`
'''
app = replace_once(app, old_helpers, new_helpers, 'editor helper functions')

app = replace_once(
    app,
    "  const edgeStepSeconds = parsedEdgeStep()\n",
    "  const edgeStepSeconds = parsedEdgeStep()\n"
    "  const focusStepSeconds = parseEditorSeconds(focusStep, 1)\n"
    "  const cursorStepSeconds = parseEditorSeconds(cursorStep, 5)\n"
    "  const markerStepSeconds = parseEditorSeconds(markerStep, 1)\n"
    "  const activeMarker = activeMarkerIndex === null ? null : loopMarkers[activeMarkerIndex] ?? null\n",
    'derived editor controls',
)

new_editor_jsx = r'''    {loopEditorSongId && editorSong && <section className="loop-editor" aria-label="Loop bearbeiten"><div className="loop-editor-scroll"><div className="loop-editor-inner">
      <div className="loop-editor-commandbar">
        <div className="loop-command-history" aria-label="Editor Navigation"><button type="button" onClick={() => setLoopEditorSongId(null)} aria-label="Zurück">‹</button><button type="button" onClick={navigateForward} disabled={navigationIndex >= navigation.length - 1} aria-label="Vor">›</button><button type="button" onClick={undoLoopEditor} disabled={!loopUndoStack.length} aria-label="Rückgängig">↶</button><button type="button" onClick={redoLoopEditor} disabled={!loopRedoStack.length} aria-label="Wiederholen">↷</button></div>
        <div className="loop-command-fields">
          <label className="neutral-command"><span>Zoom</span><input type="number" min="1" max="16" step="0.25" value={loopZoom} onChange={(event) => setLoopZoom(Math.max(1, Math.min(16, Number(event.target.value) || 1)))} /><b>×</b></label>
          <label className="cursor-command"><span>Cursor Geschwindigkeit</span><input inputMode="decimal" value={loopPlaybackRate} onChange={(event) => setLoopPlaybackRate(event.target.value)} onBlur={() => setLoopPlaybackRate(String(parsedLoopPlaybackRate))} /><b>×</b></label>
          <div className="focus-command"><span>Fokus folgt Cursor</span><div className="tri-toggle" role="group" aria-label="Fokus folgt Cursor"><button className={focusFollowMode === 'center' ? 'selected' : ''} type="button" onClick={() => { setFocusFollowMode('center'); setLoopFocus(loopCursor) }} aria-label="Zentrieren">◎</button><button className={focusFollowMode === 'page' ? 'selected' : ''} type="button" onClick={() => { setFocusFollowMode('page'); setLoopFocus(loopCursor) }} aria-label="Umblättern">▣</button><button className={focusFollowMode === 'off' ? 'selected' : ''} type="button" onClick={() => setFocusFollowMode('off')} aria-label="Aus">○</button></div></div>
        </div>
        <div className="loop-command-toggles">
          <label className="loop-command"><span>Loop-Kasten</span><button className={`switch-control${loopSelectionLocked ? ' is-off' : ' is-on'}`} type="button" onClick={() => setLoopSelectionLocked((value) => !value)} aria-label={loopSelectionLocked ? 'Loop-Kasten beweglich machen' : 'Loop-Kasten feststellen'}><i /></button></label>
          <label className="cursor-command"><span>Cursor-Loop</span><button className={`switch-control${cursorLoopEnabled ? ' is-on' : ' is-off'}`} type="button" onClick={() => setCursorLoopEnabled((value) => !value)} aria-label="Cursor-Loop umschalten"><i /></button></label>
          <label className="marker-command"><span>Markierungen</span><button className={`switch-control${markersEnabled ? ' is-on' : ' is-off'}`} type="button" onClick={() => setMarkersEnabled((value) => !value)} aria-label="Markierungen umschalten"><i /></button></label>
          <button className="marker-clear-all" type="button" onClick={deleteAllMarkers} disabled={!loopMarkers.length}>Alle Markierungen löschen</button>
        </div>
      </div>

      <div className="loop-editor-title"><div><p>LOOP EDITOR</p><h1>{editorSong.name}</h1></div><div className="waveform-status">{waveformStatus === 'loading' ? 'Wellenform wird berechnet…' : waveformStatus === 'unavailable' ? 'Wellenform nicht verfügbar' : 'Amplitude'}</div></div>

      <div className="loop-timeline-wrap">
        <div ref={loopTimelineScrollRef} className="loop-timeline-scroll"><div ref={loopTimelineRef} className="loop-timeline precision" style={{ width: `${loopZoom * 100}%` }} onPointerMove={moveLoopDrag} onPointerUp={endLoopDrag} onPointerCancel={endLoopDrag}>
          {waveform.length > 0 && <div className="loop-waveform" aria-hidden="true">{waveform.map((height, index) => <i key={index} style={{ height: `${Math.max(4, height * 92)}%` }} />)}</div>}
          <div className="timeline-guide guide-one" /><div className="timeline-guide guide-two" />
          {markersEnabled && loopMarkers.map((marker, index) => <button key={`${marker}-${index}`} className={`loop-marker${activeMarkerIndex === index ? ' active-marker' : ''}`} type="button" style={{ left: `${editorDuration ? marker / editorDuration * 100 : 0}%` }} onPointerDown={(event) => event.stopPropagation()} onClick={() => { setActiveMarkerIndex(index); moveCursorTo(marker, false, true) }} aria-label={`Markierung ${markerLabel(index)}`}><em>{formatTime(marker)}</em><span>{markerLabel(index)}</span></button>)}
          <div className={`loop-selection${loopSelectionLocked ? ' locked' : ''}`} style={{ left: `${loopLeft}%`, width: `${loopWidth}%` }} onPointerDown={(event) => beginLoopDrag(event, 'move')}><span className="loop-time-bubble loop-start-time">{formatTime(loopDraftStart)}</span><button className={`loop-handle start${activeLoopEdge === 'start' ? ' active-edge' : ''}`} type="button" aria-label="Loop-Start verschieben" onPointerDown={(event) => beginLoopDrag(event, 'start')} /><span className="loop-window-label">LOOP</span><button className={`loop-handle end${activeLoopEdge === 'end' ? ' active-edge' : ''}`} type="button" aria-label="Loop-Ende verschieben" onPointerDown={(event) => beginLoopDrag(event, 'end')} /><span className="loop-time-bubble loop-end-time">{formatTime(loopDraftEnd)}</span></div>
          <button className="loop-cursor" type="button" style={{ left: `${cursorLeft}%` }} aria-label="Abspielposition verschieben"><em>{formatTime(loopCursor)}</em><span onPointerDown={(event) => beginLoopDrag(event, 'cursor')} /></button>
        </div>
        <div ref={loopFocusRef} className={`loop-focus-track${focusFollowMode !== 'off' ? ' follows-cursor' : ''}`} style={{ width: `${loopZoom * 100}%` }} onPointerDown={(event) => beginLoopDrag(event, 'focus')} onPointerMove={moveLoopDrag} onPointerUp={endLoopDrag} onPointerCancel={endLoopDrag}><button type="button" className="loop-focus-cursor" style={{ left: `${focusLeft}%` }} aria-label="Zoom-Fokus verschieben" onPointerDown={(event) => beginLoopDrag(event, 'focus')}><em>{formatTime(loopFocus)}</em><span /></button></div>
        </div>
        <div className="loop-time-labels"><span>0:00</span><span>{formatTime(editorDuration)}</span></div>
      </div>

      <div className="loop-control-grid">
        <section className="editor-control-card focus-card"><header><span>Fokus-Standort</span><strong>{formatTime(loopFocus)}</strong></header><div className="control-step-row"><button type="button" onClick={() => nudgeFocus(-focusStepSeconds)}>◀</button><label><input inputMode="decimal" value={focusStep} onChange={(event) => setFocusStep(event.target.value)} /><b>s</b></label><button type="button" onClick={() => nudgeFocus(focusStepSeconds)}>▶</button></div></section>
        <section className="editor-control-card cursor-card"><header><span>Cursor-Standort</span><strong>{formatTime(loopCursor)}</strong></header><div className="control-step-row cursor-step-row"><button type="button" onClick={() => nudgeCursor(-cursorStepSeconds)}>◀</button><button className="mini-play" type="button" onClick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button><button type="button" onClick={() => nudgeCursor(cursorStepSeconds)}>▶</button><label><input inputMode="decimal" value={cursorStep} onChange={(event) => setCursorStep(event.target.value)} /><b>s</b></label></div></section>
        <section className="editor-control-card loop-card"><header><span>Loop Start / Loop Ende-Standort</span><strong>{formatTime(loopDraftStart)} – {formatTime(loopDraftEnd)}</strong></header><div className="loop-edge-row"><div><button type="button" onClick={() => nudgeLoopEdge('start', -edgeStepSeconds)}>◀</button><span>Start</span><button type="button" onClick={() => nudgeLoopEdge('start', edgeStepSeconds)}>▶</button></div><label><input inputMode="decimal" value={edgeStep} onChange={(event) => setEdgeStep(event.target.value)} /><b>s</b></label><div><button type="button" onClick={() => nudgeLoopEdge('end', -edgeStepSeconds)}>◀</button><span>Ende</span><button type="button" onClick={() => nudgeLoopEdge('end', edgeStepSeconds)}>▶</button></div></div><div className="boundary-preview-row"><label><button type="button" onClick={() => previewBoundary('start')}>▶ Vor Start</button><input inputMode="decimal" value={previewLeadStart} onChange={(event) => setPreviewLeadStart(event.target.value)} /><b>s</b></label><label><button type="button" onClick={() => previewBoundary('end')}>▶ Vor Ende</button><input inputMode="decimal" value={previewLeadEnd} onChange={(event) => setPreviewLeadEnd(event.target.value)} /><b>s</b></label></div></section>
        <section className="editor-control-card marker-card"><header><span>Markierungen</span><strong>{activeMarker === null ? '--:--' : formatTime(activeMarker)}</strong></header><div className="marker-tabs">{loopMarkers.map((marker, index) => <button key={`${marker}-tab-${index}`} className={activeMarkerIndex === index ? 'selected' : ''} type="button" onClick={() => { setActiveMarkerIndex(index); moveCursorTo(marker, false, true) }}>{markerLabel(index)}</button>)}<button className="add-marker" type="button" onClick={setMarker} disabled={!markersEnabled}>＋</button></div><div className="marker-location-row"><button type="button" onClick={() => nudgeActiveMarker(-markerStepSeconds)} disabled={activeMarker === null}>◀</button><label><input inputMode="decimal" value={markerStep} onChange={(event) => setMarkerStep(event.target.value)} /><b>s</b></label><button type="button" onClick={() => nudgeActiveMarker(markerStepSeconds)} disabled={activeMarker === null}>▶</button><div className="marker-more-wrap"><button className="marker-more" type="button" onClick={() => setLoopEditorMenuOpen((value) => !value)}>•••</button>{loopEditorMenuOpen && <div className="marker-more-menu"><button type="button" onClick={() => moveMarkerTarget('focus')} disabled={activeMarker === null}>Zoom hinbewegen</button><button type="button" onClick={() => moveMarkerTarget('start')} disabled={activeMarker === null}>Loop-Anfang hinbewegen</button><button type="button" onClick={() => moveMarkerTarget('end')} disabled={activeMarker === null}>Loop-Ende hinbewegen</button><button type="button" onClick={deleteActiveMarker} disabled={activeMarker === null}>Markierung löschen</button><button type="button" onClick={deleteAllMarkers} disabled={!loopMarkers.length}>Alle Markierungen löschen</button></div>}</div></div></section>
      </div>

      <div className="loop-editor-actions"><button className="save-loop" type="button" onClick={() => void saveLoopDraft()} disabled={!editorDuration || loopDraftEnd <= loopDraftStart}>Loop speichern</button><button type="button" onClick={() => setLoopEditorSongId(null)}>Abbrechen</button></div>
    </div></div></section>}

'''
app = regex_once(
    app,
    r"    \{loopEditorSongId && editorSong && <section className=\"loop-editor\".*?</section>\}\n\n(?=    \{playlistChooserMode)",
    new_editor_jsx,
    'replace loop editor JSX',
)

app_path.write_text(app)

main_path = Path('src/main.tsx')
main = main_path.read_text()
main = replace_once(main, "import PullToRefresh from './PullToRefresh'\n", "", 'remove pull-to-refresh import')
main = replace_once(
    main,
    "  <StrictMode>\n    <PullToRefresh>\n      <App />\n    </PullToRefresh>\n  </StrictMode>,\n",
    "  <StrictMode>\n    <App />\n  </StrictMode>,\n",
    'remove pull-to-refresh wrapper',
)
main_path.write_text(main)

enhancements_path = Path('src/enhancements.css')
enhancements = enhancements_path.read_text()
if '/* editor overscroll protection */' not in enhancements:
    enhancements += "\n\n/* editor overscroll protection */\nhtml, body, #root { overscroll-behavior-y: none; }\n.loop-editor { overscroll-behavior: none; }\n"
enhancements_path.write_text(enhancements)

loop_css = r'''.loop-editor {
  position: fixed;
  inset: 0;
  z-index: 125;
  overflow: hidden;
  background: #090b10;
  color: #f8fafc;
  overscroll-behavior: none;
}
.loop-editor-scroll {
  height: 100dvh;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: env(safe-area-inset-top, 0) clamp(14px, 3vw, 34px) calc(34px + env(safe-area-inset-bottom, 0));
}
.loop-editor-inner { width: min(1240px, 100%); margin: 0 auto; }
.loop-editor button, .loop-editor input { font: inherit; }
.loop-editor button { color: inherit; }
.loop-editor-commandbar { position: sticky; top: 0; z-index: 30; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 14px; align-items: start; margin: 0 -8px; padding: 14px 8px 12px; background: linear-gradient(180deg, rgba(9,11,16,.98) 78%, rgba(9,11,16,.88)); backdrop-filter: blur(18px); border-bottom: 1px solid #202733; }
.loop-command-history { display: flex; gap: 6px; }
.loop-command-history button { width: 42px; height: 42px; padding: 0; border: 1px solid #303846; border-radius: 10px; background: #121720; font-size: 22px; cursor: pointer; }
.loop-command-history button:disabled { opacity: .3; }
.loop-command-fields { display: flex; flex-wrap: wrap; gap: 8px; min-width: 0; }
.loop-command-fields > label, .focus-command, .loop-command-toggles > label { display: flex; align-items: center; gap: 8px; min-height: 42px; padding: 6px 10px; border: 1px solid #303846; border-radius: 11px; background: #121720; }
.loop-command-fields span, .loop-command-toggles span { font-size: 11px; font-weight: 760; white-space: nowrap; }
.loop-command-fields input { width: 64px; height: 30px; padding: 0 7px; border: 1px solid #3c4657; border-radius: 8px; background: #090d14; color: #fff; text-align: right; }
.loop-command-fields b { color: #8d98aa; font-size: 12px; }
.cursor-command { border-color: rgba(59,130,246,.42) !important; background: rgba(30,64,175,.13) !important; }
.focus-command { border-color: rgba(34,197,94,.38) !important; background: rgba(20,83,45,.16) !important; }
.loop-command { border-color: rgba(239,68,68,.38) !important; background: rgba(127,29,29,.15) !important; }
.marker-command { border-color: rgba(245,158,11,.4) !important; background: rgba(120,53,15,.16) !important; }
.tri-toggle { display: flex; gap: 3px; padding: 2px; border-radius: 8px; background: rgba(0,0,0,.22); }
.tri-toggle button { width: 30px; height: 28px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: #6f7a89; cursor: pointer; }
.tri-toggle button.selected { background: #174f2b; color: #bbf7d0; }
.loop-command-toggles { display: grid; gap: 6px; }
.loop-command-toggles > label { justify-content: space-between; min-width: 178px; }
.switch-control { position: relative; width: 42px; height: 24px; padding: 0; border: 1px solid #4b5563; border-radius: 999px; background: #242b36; cursor: pointer; }
.switch-control i { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #9ca3af; transition: transform .14s ease, background .14s ease; }
.switch-control.is-on i { transform: translateX(18px); background: #f8fafc; }
.loop-command .switch-control.is-on { background: #7f1d1d; border-color: #ef4444; }
.cursor-command .switch-control.is-on { background: #1d4ed8; border-color: #60a5fa; }
.marker-command .switch-control.is-on { background: #92400e; border-color: #f59e0b; }
.marker-clear-all { min-height: 38px; padding: 0 10px; border: 1px solid rgba(245,158,11,.4); border-radius: 10px; background: rgba(120,53,15,.13); color: #fed7aa !important; cursor: pointer; }
.marker-clear-all:disabled { opacity: .35; }
.loop-editor-title { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin: 28px 4px 14px; }
.loop-editor-title p { margin: 0 0 4px; color: #7e8999; font-size: 10px; font-weight: 850; letter-spacing: .14em; }
.loop-editor-title h1 { margin: 0; font-size: clamp(24px, 4vw, 42px); overflow-wrap: anywhere; }
.waveform-status { color: #7f8999; font-size: 11px; }
.loop-timeline-wrap { padding: 14px; border: 1px solid #313947; border-radius: 18px; background: #0e1219; box-shadow: 0 18px 46px rgba(0,0,0,.24); }
.loop-timeline-scroll { overflow-x: auto; overflow-y: visible; padding: 28px 0 8px; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; }
.loop-timeline { position: relative; min-width: 100%; height: 224px; border: 1px solid #333c49; border-radius: 12px; background: linear-gradient(180deg, #141923, #0f141c); overflow: visible; touch-action: none; user-select: none; -webkit-user-select: none; }
.loop-timeline.precision { transition: width .14s ease; }
.timeline-guide { position: absolute; z-index: 1; left: 0; right: 0; height: 1px; background: #35404f; pointer-events: none; }
.guide-one { top: 33.333%; }
.guide-two { top: 66.666%; }
.loop-waveform { position: absolute; z-index: 1; inset: 24px 0; display: flex; align-items: center; gap: 1px; padding: 0 2px; pointer-events: none; opacity: .66; overflow: hidden; }
.loop-waveform i { flex: 1 1 0; min-width: 1px; border-radius: 2px; background: #707a89; transform-origin: center; }
.loop-selection { position: absolute; top: 8px; bottom: 8px; z-index: 3; border: 2px solid #ef4444; border-radius: 7px; background: rgba(239,68,68,.14); box-shadow: inset 0 0 26px rgba(239,68,68,.06); cursor: grab; }
.loop-selection:active { cursor: grabbing; }
.loop-selection.locked { opacity: .42; pointer-events: none; background: rgba(239,68,68,.07); }
.loop-handle { position: absolute; top: -8px; bottom: -8px; width: 42px; padding: 0; border: 0; background: transparent; cursor: ew-resize; touch-action: none; }
.loop-handle::after { content: ''; position: absolute; top: 8px; bottom: 8px; width: 6px; border-radius: 6px; background: #ef4444; }
.loop-handle.start { left: -21px; }
.loop-handle.start::after { right: 17px; }
.loop-handle.end { right: -21px; }
.loop-handle.end::after { left: 17px; }
.loop-handle.active-edge::after { box-shadow: 0 0 0 3px rgba(254,202,202,.28), 0 0 15px rgba(239,68,68,.75); }
.loop-window-label { position: absolute; inset: 0 30px; display: grid; place-items: center; color: rgba(254,202,202,.72); font-size: 11px; font-weight: 900; letter-spacing: .16em; pointer-events: none; }
.loop-time-bubble, .loop-cursor em, .loop-marker em, .loop-focus-cursor em { position: absolute; z-index: 12; top: -27px; padding: 3px 6px; border-radius: 7px; background: #080b10; font-style: normal; font-size: 10px; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; pointer-events: none; }
.loop-start-time { left: 0; transform: translateX(-2px); color: #fca5a5; }
.loop-end-time { right: 0; transform: translateX(2px); color: #fca5a5; }
.loop-cursor { position: absolute; z-index: 8; top: 0; bottom: 0; width: 2px; margin-left: -1px; padding: 0; border: 0; background: transparent; pointer-events: none; }
.loop-cursor::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: #3b82f6; box-shadow: 0 0 8px rgba(59,130,246,.8); pointer-events: none; }
.loop-cursor > span { position: absolute; top: 8px; left: 50%; width: 30px; height: 30px; transform: translateX(-50%); border-radius: 50%; background: #3b82f6; box-shadow: 0 0 0 4px rgba(59,130,246,.18); pointer-events: auto; cursor: ew-resize; touch-action: none; }
.loop-cursor em { left: 50%; transform: translateX(-50%); color: #93c5fd; }
.loop-marker { position: absolute; z-index: 6; top: 0; bottom: 0; width: 36px; margin-left: -18px; padding: 0; border: 0; background: transparent; cursor: pointer; }
.loop-marker::before { content: ''; position: absolute; left: 17px; top: 10px; bottom: 10px; width: 2px; background: #f59e0b; }
.loop-marker span { position: absolute; top: 44px; left: 8px; display: grid; place-items: center; width: 20px; height: 20px; transform: rotate(45deg); border: 2px solid #f59e0b; background: #2b1b09; color: #fed7aa; font-size: 9px; font-weight: 950; }
.loop-marker em { left: 50%; transform: translateX(-50%); color: #fdba74; }
.loop-marker.active-marker::before { width: 3px; box-shadow: 0 0 12px rgba(245,158,11,.75); }
.loop-focus-track { position: relative; min-width: 100%; height: 54px; margin-top: 10px; border: 1px solid rgba(34,197,94,.38); border-radius: 9px; background: rgba(20,83,45,.13); touch-action: none; user-select: none; -webkit-user-select: none; cursor: crosshair; }
.loop-focus-track::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 2px; transform: translateY(-50%); background: #22c55e; opacity: .78; }
.loop-focus-track.follows-cursor { cursor: default; }
.loop-focus-cursor { position: absolute; z-index: 2; top: 0; bottom: 0; width: 42px; margin-left: -21px; padding: 0; border: 0; background: transparent; cursor: ew-resize; touch-action: none; }
.loop-focus-cursor::before { content: ''; position: absolute; left: 19px; top: 4px; bottom: 4px; width: 3px; border-radius: 3px; background: #22c55e; box-shadow: 0 0 9px rgba(34,197,94,.65); }
.loop-focus-cursor span { position: absolute; left: 10px; top: 17px; width: 22px; height: 22px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 4px rgba(34,197,94,.16); }
.loop-focus-cursor em { left: 50%; transform: translateX(-50%); color: #86efac; }
.loop-focus-track.follows-cursor .loop-focus-cursor { pointer-events: none; }
.loop-time-labels { display: flex; justify-content: space-between; margin-top: 8px; color: #748092; font-size: 10px; }
.loop-control-grid { display: grid; grid-template-columns: minmax(190px,.85fr) minmax(230px,1fr) minmax(380px,1.65fr); gap: 12px; margin-top: 18px; align-items: stretch; }
.editor-control-card { position: relative; min-width: 0; padding: 14px; border: 1px solid #303846; border-radius: 14px; background: #121720; }
.editor-control-card header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.editor-control-card header span { font-size: 12px; font-weight: 850; }
.editor-control-card header strong { font-size: 12px; font-variant-numeric: tabular-nums; }
.focus-card { border-color: rgba(34,197,94,.4); background: rgba(20,83,45,.15); }
.focus-card header strong { color: #86efac; }
.cursor-card { border-color: rgba(59,130,246,.42); background: rgba(30,64,175,.14); }
.cursor-card header strong { color: #93c5fd; }
.loop-card { border-color: rgba(239,68,68,.4); background: rgba(127,29,29,.14); }
.loop-card header strong { color: #fca5a5; }
.marker-card { grid-column: 1 / -1; border-color: rgba(245,158,11,.42); background: rgba(120,53,15,.14); }
.marker-card header strong { color: #fdba74; }
.control-step-row, .loop-edge-row, .marker-location-row { display: flex; align-items: center; gap: 8px; }
.control-step-row > button, .loop-edge-row button, .marker-location-row > button, .boundary-preview-row button, .marker-tabs button, .marker-more { min-width: 42px; min-height: 42px; padding: 0 10px; border: 1px solid #3d4757; border-radius: 10px; background: rgba(7,10,15,.54); cursor: pointer; }
.control-step-row label, .loop-edge-row > label, .marker-location-row > label, .boundary-preview-row label { display: flex; align-items: center; gap: 5px; min-width: 0; }
.control-step-row input, .loop-edge-row input, .marker-location-row input, .boundary-preview-row input { width: 72px; height: 42px; padding: 0 8px; border: 1px solid #3e4858; border-radius: 9px; background: #090d14; color: #fff; text-align: right; }
.control-step-row b, .loop-edge-row b, .marker-location-row b, .boundary-preview-row b { color: #8d98a9; font-size: 11px; }
.cursor-step-row { flex-wrap: wrap; }
.cursor-step-row label { margin-left: auto; }
.mini-play { min-width: 50px !important; background: rgba(37,99,235,.28) !important; }
.loop-edge-row { justify-content: space-between; }
.loop-edge-row > div { display: flex; align-items: center; gap: 6px; }
.loop-edge-row > div span { min-width: 38px; text-align: center; font-size: 11px; font-weight: 800; }
.boundary-preview-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.boundary-preview-row label { display: grid; grid-template-columns: minmax(112px, 1fr) 68px 12px; }
.boundary-preview-row button { color: #fecaca; }
.marker-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.marker-tabs button { min-width: 38px; min-height: 36px; color: #fdba74; }
.marker-tabs button.selected { border-color: #f59e0b; background: rgba(245,158,11,.24); color: #fff7ed; }
.marker-tabs .add-marker { font-size: 19px; }
.marker-location-row { flex-wrap: wrap; }
.marker-more-wrap { position: relative; margin-left: auto; }
.marker-more { min-width: 46px !important; color: #fed7aa; font-weight: 900; letter-spacing: 1px; }
.marker-more-menu { position: absolute; right: 0; bottom: 50px; z-index: 40; display: grid; width: min(270px, calc(100vw - 48px)); padding: 6px; border: 1px solid #69502e; border-radius: 12px; background: #19140e; box-shadow: 0 18px 48px rgba(0,0,0,.5); }
.marker-more-menu button { min-height: 42px; padding: 0 10px; border: 0; border-radius: 8px; background: transparent; color: #fed7aa; text-align: left; cursor: pointer; }
.marker-more-menu button:hover { background: rgba(245,158,11,.12); }
.marker-more-menu button:disabled { opacity: .35; }
.loop-editor-actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 18px; padding-bottom: 6px; }
.loop-editor-actions button { min-height: 46px; padding: 0 16px; border: 1px solid #394353; border-radius: 11px; background: #151a23; cursor: pointer; }
.loop-editor-actions .save-loop { border-color: #b91c1c; background: #4b171b; color: #fecaca; font-weight: 850; }
.loop-editor-actions button:disabled { opacity: .35; }
@media (max-width: 1040px) { .loop-editor-commandbar { grid-template-columns: 1fr; } .loop-command-toggles { grid-template-columns: repeat(4, minmax(0,1fr)); } .loop-command-toggles > label { min-width: 0; } .marker-clear-all { min-height: 42px; } .loop-control-grid { grid-template-columns: 1fr 1fr; } .loop-card { grid-column: 1 / -1; } }
@media (max-width: 720px) { .loop-editor-scroll { padding-left: 10px; padding-right: 10px; } .loop-command-fields > label, .focus-command { width: 100%; justify-content: space-between; } .loop-command-toggles { grid-template-columns: 1fr 1fr; } .loop-editor-title { align-items: flex-start; flex-direction: column; } .loop-timeline { height: 196px; } .loop-control-grid { grid-template-columns: 1fr; } .loop-card, .marker-card { grid-column: auto; } .boundary-preview-row { grid-template-columns: 1fr; } .loop-edge-row { align-items: stretch; flex-direction: column; } .loop-edge-row > div { justify-content: space-between; } .loop-edge-row > label { align-self: center; } }
'''
Path('src/loopEditor.css').write_text(loop_css)

architecture_path = Path('architecture.md')
architecture = architecture_path.read_text()
architecture = regex_once(
    architecture,
    r"## Präziser Loop-Editor\n.*?(?=\n## Player-Stabilität bei Song-Metadaten)",
    '''## Präziser Loop-Editor

Die Loop-Ansicht folgt dem vom Nutzer skizzierten Schnittplatz-Layout. Sie ist eine feste Vollbildansicht mit eigener vertikaler Scrollfläche; die normale App-Seite wird dabei nicht verschoben.

Oben liegt eine kompakte, beim Scrollen sichtbare Steuerleiste mit Zurück/Vor sowie **lokalem Editor-Undo/Redo**. Daneben stehen Eingabefelder für Zoom und Cursor-Geschwindigkeit. `Fokus folgt Cursor` ist dreistufig: Zentrieren, seitenweises Umblättern oder aus. Loop-Kasten, Cursor-Loop und Markierungen werden als Schalter dargestellt. Die erläuternden Begriffe aus der Skizze in Klammern erscheinen nicht als sichtbarer UI-Text.

Die Hauptzeitachse zeigt weiterhin die lokal berechnete Amplituden-Wellenform. Alle visuellen Bereiche sind farblich nach Funktion getrennt:

- Loop-Kasten, Loop-Start/Ende und zugehörige Kontrollen: leicht rot.
- Cursor, Cursor-Geschwindigkeit und Cursor-Kontrollen: leicht blau.
- Fokuslinie und Fokus-Kontrollen: leicht grün.
- Markierungen und Markierungs-Kontrollen: leicht orange.

Cursor, Loop-Start, Loop-Ende, Fokus und Markierungen zeigen direkt an ihren Strichen eine nicht interaktive Zeitangabe. Der blaue Cursor bleibt ausschließlich über seinen Punkt greifbar. Der grüne Fokus ist nur bei ausgeschaltetem automatischem Folgen direkt verschiebbar.

Unter der Zeitachse liegen getrennte Präzisionsbereiche für Fokus-Standort, Cursor-Standort, Loop-Start/-Ende und Markierungen. Fokus, Cursor und Markierungen besitzen jeweils eine frei eingebbare Schrittweite in Sekunden. Loop-Start und Loop-Ende teilen sich die frei eingebbare Kanten-Schrittweite. Vor Start und vor Ende kann mit getrennten Vorlaufwerten abgespielt werden.

Markierungen werden als A, B, C usw. angezeigt. Eine ausgewählte Markierung kann über `•••` zum Zoom-Fokus, zum Loop-Anfang oder zum Loop-Ende übertragen, einzeln gelöscht oder zusammen mit allen Markierungen gelöscht werden.

Die Audiodatei bleibt beim gesamten Bearbeiten unverändert. `Loop speichern` persistiert weiterhin ausschließlich Start, Ende, Aktivstatus und Marker als Metadaten.
''',
    'architecture editor section',
)
architecture = replace_once(
    architecture,
    "`vite-plugin-pwa` erzeugt Manifest und Service Worker. Der Vite-Basispfad bleibt relativ (`./`). `.github/workflows/deploy.yml` baut `main` und veröffentlicht `dist` auf GitHub Pages.\n",
    "`vite-plugin-pwa` erzeugt Manifest und Service Worker. Der Vite-Basispfad bleibt relativ (`./`). `.github/workflows/deploy.yml` baut `main` und veröffentlicht `dist` auf GitHub Pages. Der frühere eigene Pull-to-Refresh-Wrapper ist entfernt; `main.tsx` rendert `App` direkt. Dadurch kann vertikales Ziehen/Scrollen nicht mehr absichtlich `window.location.reload()` auslösen. Zusätzlich unterbindet die Oberfläche Scroll-Chaining per `overscroll-behavior`.\n",
    'architecture pull refresh note',
)
architecture_path.write_text(architecture)

concept_path = Path('concept.md')
concept = concept_path.read_text()
concept = regex_once(
    concept,
    r"## Präziser Loop-Editor\n.*?(?=\n## Wiederholen: Liste oder ausgewählte Songs)",
    '''## Präziser Loop-Editor

`•••` → **Loop erstellen** öffnet den Schnittplatz als feste Vollbildansicht. Das Interface orientiert sich direkt an der vom Nutzer gezeichneten Skizze.

Oben stehen Zurück/Vor, Editor-Undo/Redo sowie kompakte Eingabefelder für Zoom und Cursor-Geschwindigkeit. **Fokus folgt Cursor** hat drei Zustände: zentriert folgen, seitenweise weiterblättern oder aus. Loop-Kasten, Cursor-Loop und Markierungen werden mit Schaltern gesteuert. Erläuterungen aus der Skizze, die in Klammern standen, werden nicht als zusätzlicher Text angezeigt.

Die Zeitachse verwendet die bestehende Amplituden-Wellenform und vier klare Farbfamilien: Loop leicht rot, Cursor leicht blau, Fokus leicht grün und Markierungen leicht orange. Direkt an den jeweiligen Strichen werden ihre aktuellen Zeiten angezeigt; diese Zahlen sind reine Anzeigen und nicht bedienbar. Der Cursor wird weiterhin nur am blauen Punkt verschoben.

Unter der Zeitachse gibt es vier Funktionsblöcke:

- **Fokus-Standort:** frei einstellbare Schrittweite und links/rechts bewegen.
- **Cursor-Standort:** frei einstellbare Spulweite, links/rechts sowie Play/Pause.
- **Loop Start / Loop Ende:** getrennte Start-/Endknöpfe mit gemeinsamer frei einstellbarer Kanten-Schrittweite sowie getrennte Vorlaufwerte für „Vor Start“ und „Vor Ende“.
- **Markierungen:** A, B, C usw., frei einstellbare Markierungs-Schrittweite und `•••` mit „Zoom hinbewegen“, „Loop-Anfang hinbewegen“, „Loop-Ende hinbewegen“, „Markierung löschen“ und „Alle Markierungen löschen“.

Loop-Kasten sperren, Cursor-Loop, Marker an/aus, Fokus-Modus, Zoom und Geschwindigkeit verändern nur den Editorzustand. **Loop speichern** schreibt weiterhin nur Metadaten und niemals den Audio-Blob.

Der Editor besitzt eine eigene Scrollfläche und die App verwendet keinen selbst gebauten Pull-to-Refresh mehr. Nach oben oder unten scrollen darf deshalb keinen App-Reload auslösen.
''',
    'concept editor section',
)
concept_path.write_text(concept)
