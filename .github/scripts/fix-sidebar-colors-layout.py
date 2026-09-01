from pathlib import Path
p = Path('src/App.tsx')
s = p.read_text()
s = s.replace(").filter((item): item is Playlist => Boolean(item))", ").filter(Boolean) as Playlist[]")
s = s.replace(").filter((item): item is Tag => Boolean(item))", ").filter(Boolean) as Tag[]")
p.write_text(s)
