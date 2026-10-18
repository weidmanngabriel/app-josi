import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { ColorSpectrumPicker } from './ColorSpectrumPicker'

export type CoverEditorValue = {
  file: Blob
  scale: number
  x: number
  y: number
  background: string
}

type Props = {
  title: string
  file: Blob
  initialScale?: number
  initialX?: number
  initialY?: number
  initialBackground?: string
  onCancel: () => void
  onDone: (value: CoverEditorValue) => void
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function CoverEditor({ title, file, initialScale = 1, initialX = 0, initialY = 0, initialBackground = '#111827', onCancel, onDone }: Props) {
  const [scale, setScale] = useState(clamp(initialScale, .5, 3))
  const [x, setX] = useState(clamp(initialX, -50, 50))
  const [y, setY] = useState(clamp(initialY, -50, 50))
  const [background, setBackground] = useState(initialBackground)
  const [backgroundPickerOpen, setBackgroundPickerOpen] = useState(false)
  const [url, setUrl] = useState('')
  const dragRef = useRef<{ pointerId: number; clientX: number; clientY: number; x: number; y: number } | null>(null)

  useEffect(() => {
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])

  const beginDrag = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x, y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const rect = event.currentTarget.getBoundingClientRect()
    setX(clamp(drag.x + ((event.clientX - drag.clientX) / Math.max(1, rect.width)) * 100, -50, 50))
    setY(clamp(drag.y + ((event.clientY - drag.clientY) / Math.max(1, rect.height)) * 100, -50, 50))
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  return <div className="modal-backdrop cover-editor-backdrop">
    <section className="confirm-dialog cover-editor-dialog" onClick={(event) => event.stopPropagation()}>
      <div className="dialog-actions dialog-actions-top">
        <button type="button" onClick={onCancel}>Abbrechen</button>
        <button type="button" onClick={() => onDone({ file, scale, x, y, background })}>Fertig</button>
      </div>
      <div className="cover-editor-heading"><p className="eyebrow">BILD</p><h2>{title}</h2><p>Ziehe das Bild im Rahmen. Mit den Reglern kannst du es verschieben und vergrößern oder verkleinern.</p></div>
      <div className="cover-editor-frame" style={{ background }} onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        {url && <img src={url} alt="" draggable={false} style={{ left: `calc(50% + ${x}%)`, top: `calc(50% + ${y}%)`, transform: `translate(-50%, -50%) scale(${scale})` }} />}
      </div>
      <div className="cover-editor-controls">
        <label><span>Größe</span><input type="range" min=".5" max="3" step=".05" value={scale} onChange={(event) => setScale(Number(event.target.value))} /></label>
        <label><span>Links / Rechts</span><input type="range" min="-50" max="50" step="1" value={x} onChange={(event) => setX(Number(event.target.value))} /></label>
        <label><span>Oben / Unten</span><input type="range" min="-50" max="50" step="1" value={y} onChange={(event) => setY(Number(event.target.value))} /></label>
        <button className="cover-background-button" type="button" onClick={() => setBackgroundPickerOpen(true)}><i style={{ background }} />Hintergrundfarbe</button>
      </div>
    </section>
    {backgroundPickerOpen && <ColorSpectrumPicker title="Hintergrundfarbe" initialColor={background} onCancel={() => setBackgroundPickerOpen(false)} onDone={(color) => { setBackground(color); setBackgroundPickerOpen(false) }} />}
  </div>
}
