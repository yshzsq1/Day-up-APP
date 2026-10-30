"""Build a source-only ZIP without reading Git history or user data directories."""
import argparse
import hashlib
import json
import re
import tempfile
import zipfile
from pathlib import Path

ROOT_FILES = (
    '.gitignore', '.gitattributes', 'LICENSE', 'README.md', 'package.json', 'server.py',
    'start-dayup.bat', 'PRD.md', 'DEVELOPMENT.md', 'LEARNING.md',
    'VISUAL-DESIGN.md', 'PICKER-ACCEPTANCE.md', 'tests/visual-protected.json',
)
FIXTURES = ('empty-backup.json', 'invalid-backup.json', 'sample-backup.json')
BLOCKED_PARTS = {'.git', 'backups', 'test-results', '__pycache__', 'node_modules', 'release'}
CHECKS = {
    'private key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'),
    'token': re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{15,})\b'),
    'credential value': re.compile(r'''(?i)\b(?:password|passwd|api_key|access_token|auth_token|secret)\s*[:=]\s*(['"])[^'"\r\n]{8,}\1'''),
    'email': re.compile(r'\b[A-Za-z0-9_.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b'),
    'absolute path': re.compile(r'(?<![A-Za-z0-9])(?:[A-Za-z]:[\\/]|/(?:Users|home)/)'),
    'URL credentials': re.compile(r'https?://[^\s/:@]+:[^\s/@]+@'),
}

def public_files(root):
    root = Path(root).resolve()
    names = list(ROOT_FILES)
    for folder, extensions in [('dist', {'.js', '.css', '.html'}), ('tools', {'.py', '.mjs'}), ('tests', {'.cjs', '.mjs', '.py'})]:
        for p in (root / folder).rglob('*'):
            rel = p.relative_to(root)
            if p.is_file() and p.suffix in extensions and not set(rel.parts) & BLOCKED_PARTS:
                names.append(rel.as_posix())
    names += ['tests/fixtures/' + name for name in FIXTURES]
    files = {}
    for name in sorted(set(names)):
        p = root / name
        if p.is_symlink() or not p.resolve().is_relative_to(root):
            raise ValueError(f'Linked file is not allowed: {name}')
        if not p.is_file():
            raise ValueError(f'Required public file missing: {name}')
        data = p.read_bytes()
        text = data.decode('utf-8-sig')
        for label, pattern in CHECKS.items():
            match = pattern.search(text)
            if match:
                line = text.count('\n', 0, match.start()) + 1
                raise ValueError(f'Public scan blocked: {name}:{line} ({label}); value omitted')
        if name == 'LICENSE' and not re.search(r'^Copyright \(c\) \d{4} DayUp contributors$', text, re.M):
            raise ValueError('Public LICENSE must use the project contributor attribution')
        files[name] = data
    return files

def build_public(root, output):
    files = public_files(root)
    manifest = {name: hashlib.sha256(data).hexdigest() for name, data in files.items()}
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=output.parent, suffix='.tmp', delete=False) as f:
        temp = Path(f.name)
    try:
        with zipfile.ZipFile(temp, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
            for name, data in files.items():
                archive.writestr('DayUp/' + name, data)
            archive.writestr('DayUp/PUBLIC-MANIFEST.json', json.dumps(manifest, indent=2) + '\n')
        temp.replace(output)
    finally:
        temp.unlink(missing_ok=True)
    return len(files)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    count = build_public(root, root / 'release' / 'DayUp-public.zip')
    print(f'Public scan passed: {count} source files; output: release/DayUp-public.zip')
