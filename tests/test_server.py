import json
import sys
import threading
import unittest
from unittest.mock import patch
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import urlopen
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from server import make_server, main

class LocalServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=make_server(0)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()
        cls.url=f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.thread.join()

    def test_loopback_only(self):
        self.assertEqual(self.server.server_address[0],'127.0.0.1')

    def test_local_identity(self):
        with urlopen(self.url+'/health') as r:
            self.assertEqual(json.load(r),{'app':'DayUp','local':True})

    def test_all_assets_available_without_internet(self):
        for path in ['/','/app.js','/core.js','/storage.js','/styles.css']:
            with self.subTest(path=path),urlopen(self.url+path) as r:
                self.assertEqual(r.status,200);self.assertGreater(len(r.read()),0)

    def test_workspace_files_not_exposed(self):
        for path in ['/PRD.md','/../PRD.md','/tests/']:
            with self.subTest(path=path),self.assertRaises(HTTPError) as error:
                urlopen(self.url+path)
            self.assertEqual(error.exception.code,404)

    def test_second_launch_reuses_existing_local_server(self):
        with patch.object(sys,'argv',['server.py','--port',str(self.server.server_port),'--open']),patch('server.webbrowser.open') as open_browser:
            errors=[]
            def launch():
                try: main()
                except BaseException as error: errors.append(error)
            worker=threading.Thread(target=launch,daemon=True)
            worker.start();worker.join(timeout=4)
            self.assertFalse(worker.is_alive(),'Second launch must exit instead of serving another copy')
            self.assertEqual(errors,[])
            open_browser.assert_called_once_with(f'http://localhost:{self.server.server_port}/')

if __name__=='__main__':
    unittest.main(verbosity=2)
