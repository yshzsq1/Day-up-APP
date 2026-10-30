import hashlib
import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('prepare_public', ROOT/'tools/prepare_public.py')
public = importlib.util.module_from_spec(spec)
spec.loader.exec_module(public)

class PublicReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()/'source'
        self.root.mkdir()
        self.files = public.public_files(ROOT)
        for name, data in self.files.items():
            p = self.root/name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(data)

    def tearDown(self):
        self.temp.cleanup()

    def test_bundle_excludes_private_data_history_caches_and_unknown_files(self):
        excluded = ['.git/config', '.env', 'private.key', 'personal.txt', 'AGENTS.md', 'backups/private.json', 'test-results/screen.png', 'tests/__pycache__/cache.pyc', 'tests/fixtures/personal.json', 'dist/backups/private.js']
        for name in excluded:
            p = self.root/name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text('PRIVATE TEST DATA', encoding='utf-8')
        out = Path(self.temp.name)/'public.zip'
        self.assertEqual(public.build_public(self.root, out), len(self.files))
        with zipfile.ZipFile(out) as archive:
            snapshot = json.loads(archive.read('DayUp/tests/visual-protected.json'))
            for name, digest in snapshot.items():
                self.assertEqual(hashlib.sha256(archive.read('DayUp/'+name)).hexdigest(), digest)
            self.assertEqual(set(archive.namelist()), {'DayUp/'+n for n in self.files} | {'DayUp/PUBLIC-MANIFEST.json'})
            manifest = json.loads(archive.read('DayUp/PUBLIC-MANIFEST.json'))
            for name, data in self.files.items():
                self.assertEqual(archive.read('DayUp/'+name), data)
                self.assertEqual(manifest[name], hashlib.sha256(data).hexdigest())
        for name in excluded:
            self.assertEqual((self.root/name).read_text(encoding='utf-8'), 'PRIVATE TEST DATA')

    def test_secrets_paths_and_contact_details_block_export_without_printing_values(self):
        cases = ['gh'+'p_'+'A'*32, 'person'+'@'+'example.test', chr(67)+':'+chr(92)+'Users'+chr(92)+'private', 'password'+' = '+chr(34)+'test-sensitive-value'+chr(34)]
        for value in cases:
            with self.subTest(kind=cases.index(value)):
                (self.root/'README.md').write_text(value, encoding='utf-8')
                out = Path(self.temp.name)/'blocked.zip'
                with self.assertRaises(ValueError) as error:
                    public.build_public(self.root, out)
                self.assertNotIn(value, str(error.exception))
                self.assertFalse(out.exists())

    def test_personal_license_attribution_is_rejected(self):
        text = (self.root/'LICENSE').read_text(encoding='utf-8').replace('DayUp contributors', 'Private Author')
        (self.root/'LICENSE').write_text(text, encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'attribution'):
            public.public_files(self.root)

    def test_missing_required_source_blocks_incomplete_release(self):
        (self.root/'server.py').unlink()
        with self.assertRaisesRegex(ValueError, 'Required public file missing'):
            public.public_files(self.root)
