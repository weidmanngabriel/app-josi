from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text()
text = text.replace('\n"\n"    {selectionConfirmation', '\n    {selectionConfirmation')
text = text.replace('\n"\n    {renameTarget', '\n    {renameTarget')
if '"\n"    {selectionConfirmation' in text or '\n"\n    {renameTarget' in text:
    raise SystemExit('selection confirmation quote cleanup incomplete')
path.write_text(text)
