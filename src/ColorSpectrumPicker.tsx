import { useState } from 'react'

type Props = {
  initialColor: string
  title?: string
  onDone: (color: string) => void
  onCancel: () => void
}

function channelToHex(value: number) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
}

function hueRgb(hue: number) {
  const h = ((hue % 360) + 360) % 360
  const x = 1 - Math.abs(((h / 60) % 2) - 1)
  let rgb: [number, number, number]
  if (h < 60) rgb = [1, x, 0]
  else if (h < 120) rgb = [x, 1, 0]
  else if (h < 180) rgb = [0, 1, x]
  else if (h < 240) rgb = [0, x, 1]
  else if (h < 300) rgb = [x, 0, 1]
  else rgb = [1, 0, x]
  return rgb.map((value) => value * 255) as [number, number, number]
}

function spectrumColor(x: number, y: number) {
  const base = hueRgb(x * 360)
  let rgb: [number, number, number]
  if (y <= .5) {
    const amount = y / .5
    rgb = base.map((value) => 255 * (1 - amount) + value * amount) as [number, number, number]
  } else {
    const amount = (y - .5) / .5
    rgb = base.map((value) => value * (1 - amount)) as [number, number, number]
  }
  return `#${channelToHex(rgb[0])}${channelToHex(rgb[1])}${channelToHex(rgb[2])}`
}

const QUICK_PALETTE = [
  { label: 'Hell', colors: ['#fecaca','#fed7aa','#fef3c7','#ecfccb','#d1fae5','#cffafe','#dbeafe','#e0e7ff','#ede9fe','#fae8ff','#fce7f3','#ffe4e6'] },
  { label: 'Knallig', colors: ['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#14b8a6','#06b6d4','#3b82f6','#6366f1','#a855f7','#ec4899'] },
  { label: 'Dunkel', colors: ['#7f1d1d','#7c2d12','#78350f','#713f12','#365314','#14532d','#134e4a','#164e63','#1e3a8a','#312e81','#581c87','#831843'] },
  { label: 'Neutral', colors: ['#ffffff','#9ca3af','#000000'] },
]

export function ColorSpectrumPicker({ initialColor, title = 'Tag-Farbe wählen', onDone, onCancel }: Props) {
  const [draftColor, setDraftColor] = useState(initialColor)
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)

  const choose = (event: React.PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)))
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)))
    setPoint({ x, y })
    setDraftColor(spectrumColor(x, y))
  }

  return <div className="modal-backdrop color-spectrum-backdrop" onMouseDown={onCancel}>
    <section className="confirm-dialog color-spectrum-dialog" onMouseDown={(event) => event.stopPropagation()}>
      <h2>{title}</h2>
      <button className="color-spectrum-field" type="button" onPointerDown={choose} aria-label="Farbe im Farbfeld auswählen">
        {point && <span className="color-spectrum-point" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} />}
      </button>
      <div className="color-spectrum-presets">{QUICK_PALETTE.map((section) => <div className="color-preset-section" key={section.label}><span>{section.label}</span><div>{section.colors.map((color) => <button key={color} type="button" className={draftColor.toLowerCase() === color ? 'selected' : ''} style={{ background: color }} onClick={() => { setPoint(null); setDraftColor(color) }} aria-label={`${section.label} ${color}`} />)}</div></div>)}</div>
      <div className="color-spectrum-preview"><i style={{ background: draftColor }} /><span>Ausgewählte Farbe</span></div>
      <div className="dialog-actions"><button type="button" onClick={onCancel}>Abbrechen</button><button type="button" onClick={() => onDone(draftColor)}>Fertig</button></div>
    </section>
  </div>
}
