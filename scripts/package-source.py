"""Package the corresponding source distributed by dist/sources.html."""
from pathlib import Path
import tarfile

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'dist/downloads/grandmaster-source.tar.gz'
EXCLUDED = {'.git', 'node_modules', '__pycache__', '.venv'}
with tarfile.open(ARCHIVE, 'w:gz') as archive:
    for path in sorted(ROOT.rglob('*')):
        if path.is_file() and path != ARCHIVE and not EXCLUDED.intersection(path.relative_to(ROOT).parts):
            archive.add(path, arcname=str(Path('grandmaster-battle') / path.relative_to(ROOT)), recursive=False)
print('Source archive updated.')
