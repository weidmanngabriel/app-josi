from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text()
old = """  const handleRepeatClick = () => {
    if (repeatHoldTriggeredRef.current) {
      repeatHoldTriggeredRef.current = false
      return
    }
    clearRepeatHold()
    setRepeatSelectionIds(new Set())
    setRepeatQueue((value) => !value)
  }"""
new = """  const handleRepeatClick = () => {
    if (repeatHoldTriggeredRef.current) {
      repeatHoldTriggeredRef.current = false
      return
    }
    clearRepeatHold()
    if (repeatSelectionIds.size) {
      setRepeatSelectionIds(new Set())
      setRepeatQueue(false)
      return
    }
    setRepeatQueue((value) => !value)
  }"""
if text.count(old) != 1:
    raise SystemExit(f'expected one repeat click handler, found {text.count(old)}')
path.write_text(text.replace(old, new, 1))

for doc in ['architecture.md', 'concept.md']:
    p = Path(doc)
    s = p.read_text()
    s = s.replace('Ein normaler kurzer Druck beendet den Sondermodus und schaltet wieder die Listenwiederholung.', 'Ein normaler kurzer Druck beendet den Sondermodus zunächst vollständig; ein weiterer kurzer Druck kann danach wieder die normale Listenwiederholung einschalten.')
    p.write_text(s)
