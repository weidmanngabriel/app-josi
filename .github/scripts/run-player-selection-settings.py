from pathlib import Path

path = Path('.github/scripts/apply-player-selection-settings.py')
source = path.read_text()
source = source.replace("\noverflow loop tail')", "\n'overflow loop tail')")
exec(compile(source, str(path), 'exec'))
