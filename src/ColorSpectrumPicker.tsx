import { useState } from 'react'

type Props = {
  initialColor: string
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

export function ColorSpectrumPicker({ initialColor, onDone, onCancel }: Props) {
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
      <h2>Tag-Farbe wählen</h2>
      <button className="color-spectrum-field" type="button" onPointerDown={choose} aria-label="Farbe im Farbfeld auswählen">
        {point && <span className="color-spectrum-point" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} />}
      </button>
      <div className="color-spectrum-preview"><i style={{ background: draftColor }} /><span>Ausgewählte Farbe</span></div>
      <div className="dialog-actions"><button type="button" onClick={onCancel}>Abbrechen</button><button type="button" onClick={() => onDone(draftColor)}>Fertig</button></div>
    </section>
  </div>
}
