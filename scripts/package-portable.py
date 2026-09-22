"""Package the verified standalone Worker and browser assets for Sites."""
from pathlib import Path
import json
import tarfile

root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
assert (dist / 'server/index.js').is_file()
assert (dist / 'client/index.html').is_file()
assert (dist / 'client/assets/app.js').is_file()
assert (dist / 'client/assets/app.css').is_file()
assert json.loads((dist / '.openai/hosting.json').read_text(encoding='utf-8-sig'))['project_id'] == json.loads((root / '.openai/hosting.json').read_text(encoding='utf-8-sig'))['project_id']
archive = root / 'work/branchroom-deploy.tar.gz'
archive.parent.mkdir(exist_ok=True)
with tarfile.open(archive, 'w:gz') as out:
    out.add(dist, arcname='dist')
with tarfile.open(archive) as check:
    names = check.getnames()
    assert 'dist/server/index.js' in names
    assert 'dist/.openai/hosting.json' in names
    assert 'dist/.openai/drizzle/0000_learning_workspaces.sql' in names
    assert not any('/node_modules/' in name or name.endswith('.env') for name in names)
print(f'Validated archive: {len(names)} entries, {archive.stat().st_size} bytes')
