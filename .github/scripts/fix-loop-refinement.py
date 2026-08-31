from pathlib import Path

app_path = Path('src/App.tsx')
app = app_path.read_text()
old = "  const [edgeStep, setEdgeStep] = useState('0,01')\n"
new = "  const [edgeStep, setEdgeStep] = useState('0.01')\n"
if app.count(old) != 1:
    raise SystemExit('edge step default not found exactly once')
app_path.write_text(app.replace(old, new, 1))

css_path = Path('src/loopEditor.css')
css = css_path.read_text()
rule = "\n/* keep confirmations above the fixed loop editor */\n.modal-backdrop { z-index: 190 !important; }\n"
if rule not in css:
    css += rule
css_path.write_text(css)
