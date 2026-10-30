"""Exercise the offline reference page through the real local HTTP server."""
import re
import tempfile
import threading
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import urlopen
from server import make_server


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.elements = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, dict(attrs)))


class VisualReferenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.folder = Path(cls.temp.name) / 'backups'
        cls.server = make_server(0, backup_dir=cls.folder)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.server.server_port}/'
        with urlopen(cls.base + 'styleguide.html') as response:
            cls.html = response.read().decode('utf-8')
        cls.page = Page(cls.html)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.temp.cleanup()

    def test_reference_can_load_entirely_offline_with_resolved_tokens(self):
        resources = [a['href'] for tag, a in self.page.elements if tag == 'link']
        self.assertEqual(len(resources), 5)
        css = ''
        for resource in resources:
            self.assertTrue(resource.startswith('./'))
            with urlopen(self.base + resource[2:]) as response:
                self.assertEqual(response.status, 200)
                css += response.read().decode('utf-8')
        self.assertNotRegex(css, r'@import|https?://|url\(')
        # Documentation comments contain illustrative names, not CSS declarations.
        css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
        definitions = set(re.findall(r'(--[\w-]+)\s*:', css))
        references = set(re.findall(r'var\((--[\w-]+)', css))
        self.assertEqual(references - definitions, set())

    def test_reference_is_isolated_from_business_data_and_actions(self):
        self.assertFalse(any(tag in {'script', 'form', 'iframe'} for tag, _ in self.page.elements))
        for tag, attrs in self.page.elements:
            self.assertFalse(any(k.startswith('on') or k in {'data-action', 'data-form'} for k in attrs))
            if tag == 'button':
                self.assertEqual(attrs.get('type'), 'button')
        self.assertFalse(self.folder.exists(), 'Reading the guide must not create a backup folder')

    def test_three_skins_share_same_components_and_accessible_input_labels(self):
        blocks = re.findall(r'<article class="guide-skin"[^>]*data-theme="(\w+)"[^>]*>(.*?)</article>', self.html, re.S)
        self.assertEqual([skin for skin, _ in blocks], ['soda', 'prism', 'brut'])
        structures = []
        for skin, html in blocks:
            elements = Page(html).elements
            structures.append([(t, a.get('class'), a.get('type')) for t, a in elements])
            ids = [a['id'] for _, a in elements if 'id' in a]
            labels = [a['for'] for t, a in elements if t == 'label']
            self.assertEqual(set(ids), set(labels))
            self.assertEqual(len(ids), len(set(ids)))
            self.assertTrue(any(t == 'button' and 'disabled' in a for t, a in elements))
            self.assertTrue(any(a.get('aria-busy') == 'true' for _, a in elements))
            self.assertIn('calendar-day selected', html)
            self.assertIn('task-row done', html)
            self.assertIn('sample-focus', html)
        self.assertEqual(structures[0], structures[1])
        self.assertEqual(structures[1], structures[2])
