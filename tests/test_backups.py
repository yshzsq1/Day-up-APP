import json
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from server import make_server

class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.folder = Path(self.temp.name)/'backups'
        self.server = make_server(0,backup_dir=self.folder)
        self.worker = threading.Thread(target=self.server.serve_forever,daemon=True)
        self.worker.start()
        self.url = f'http://127.0.0.1:{self.server.server_port}'
        self.data = json.loads((Path(__file__).parent/'fixtures/empty-backup.json').read_text(encoding='utf-8-sig'))

    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.worker.join();self.temp.cleanup()

    def call(self,path,body=None,headers=None):
        request = Request(self.url+path,data=json.dumps(body).encode() if body is not None else None,
                          headers=headers if headers is not None else {'Origin':self.url,'Content-Type':'application/json','X-DayUp-Request':'1'})
        with urlopen(request) as response:
            return json.load(response)

    def create(self):
        return self.call('/api/backups',{'data':self.data})['name']

    def test_roundtrip_unique_files_and_listing(self):
        first,second = self.create(),self.create()
        self.assertNotEqual(first,second)
        self.assertRegex(first,r'^dayup-backup-\d{4}-\d{2}-\d{2}_\d{6}_\d{6}\.json$')
        self.assertEqual(json.loads((self.folder/first).read_text(encoding='utf-8')),self.data)
        self.assertEqual(self.call('/api/backups/'+first),self.data)
        listing=self.call('/api/backups')
        self.assertEqual(listing['folder'],str(self.folder.resolve()))
        self.assertEqual({row['name'] for row in listing['files']},{first,second})

    def test_learning_subjects_and_sessions_survive_file_backup_roundtrip(self):
        self.data['learning'] = {'subjects':[{'id':'python','name':'Python','status':'进行中','units':[{'id':'unit','title':'列表','done':True}]}], 'sessions':[{'id':'study','subjectId':'python','date':'2026-10-29','duration':45,'content':'完成练习'}], 'notes':[]}
        name = self.create()
        self.assertEqual(self.call('/api/backups/'+name)['learning'], self.data['learning'])
        self.assertEqual(json.loads((self.folder/name).read_text(encoding='utf-8'))['learning'], self.data['learning'])

    def test_image_notes_and_code_survive_large_file_backup_above_20mb(self):
        image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII='
        self.data['learning'] = {'subjects':[{'id':'python','name':'Python','status':'进行中','units':[]}], 'sessions':[], 'notes':[{'id':'note','subjectId':'python','title':'截图与代码','tags':[], 'blocks':[{'id':'image','type':'image','src':image,'caption':'报错截图','name':'error.png'},{'id':'code','type':'code','language':'python','content':'if True:\n    print(1)\n'}]}]}
        # Model a notebook with many inline screenshots. Verify actual HTTP and disk roundtrip.
        self.data['backup_test_padding'] = 'a' * (21 * 1024 * 1024)
        name = self.create()
        self.assertGreater((self.folder/name).stat().st_size, 20 * 1024 * 1024)
        restored = self.call('/api/backups/'+name)
        self.assertEqual(restored, self.data)

    def test_backup_above_100mb_is_rejected_before_reading_or_writing(self):
        request = Request(self.url+'/api/backups', data=b'{}', headers={'Origin':self.url,'Content-Type':'application/json','X-DayUp-Request':'1','Content-Length':str(100*1024*1024+1)})
        with self.assertRaises(HTTPError) as error:
            urlopen(request)
        self.assertEqual(error.exception.code,413)
        self.assertIn('100MB',json.load(error.exception)['error'])
        self.assertFalse(self.folder.exists())

    def test_delete_only_selected_files_keeps_other_data(self):
        first,second=self.create(),self.create()
        unrelated=self.folder/'personal.txt';unrelated.write_text('keep')
        self.assertEqual(self.call('/api/backups/delete',{'names':[first]})['deleted'],1)
        self.assertFalse((self.folder/first).exists());self.assertTrue((self.folder/second).exists())
        self.assertEqual(unrelated.read_text(),'keep')

    def test_invalid_paths_and_missing_files_do_not_delete_other_files(self):
        name=self.create()
        for bad in ['../PRD.md','personal.txt','../'+name,str(Path(self.temp.name).resolve()/'private.json')]:
            with self.subTest(bad=bad),self.assertRaises(HTTPError) as error:
                self.call('/api/backups/delete',{'names':[name,bad]})
            self.assertEqual(error.exception.code,400);self.assertTrue((self.folder/name).exists())
        missing='dayup-backup-2000-01-01_000000_000000.json'
        with self.assertRaises(HTTPError) as error:
            self.call('/api/backups/delete',{'names':[name,missing]})
        self.assertEqual(error.exception.code,404);self.assertTrue((self.folder/name).exists())

    def test_foreign_origin_missing_header_and_wrong_host_are_rejected(self):
        for headers in [{'Origin':'https://evil.example','Content-Type':'application/json','X-DayUp-Request':'1'},
                        {'Origin':self.url,'Content-Type':'application/json'},
                        {'Origin':'http://evil.example','Host':'evil.example','Content-Type':'application/json','X-DayUp-Request':'1'}]:
            with self.subTest(headers=headers),self.assertRaises(HTTPError) as error:
                self.call('/api/backups',{'data':self.data},headers)
            self.assertEqual(error.exception.code,403)
        self.assertFalse(self.folder.exists())

    def test_open_folder_uses_only_fixed_backup_folder(self):
        with patch('server.os.startfile',create=True) as open_folder:
            result=self.call('/api/backups/open',{'path':str(Path(self.temp.name).resolve()/'unrelated')})
            open_folder.assert_called_once_with(str(self.folder.resolve()))
            self.assertEqual(result['folder'],str(self.folder.resolve()))

    def test_open_folder_falls_back_to_windows_explorer_if_association_is_denied(self):
        with patch('server.os.startfile',create=True,side_effect=PermissionError('denied')),patch('server.subprocess.Popen') as explorer:
            explorer.return_value.wait.return_value=0
            self.call('/api/backups/open',{})
            self.assertTrue(explorer.call_args.args[0][0].endswith('explorer.exe'))
            self.assertEqual(explorer.call_args.args[0][1],str(self.folder.resolve()))

    def test_failed_explorer_process_is_not_reported_as_opened(self):
        with patch('server.os.startfile',create=True,side_effect=PermissionError('denied')),patch('server.subprocess.Popen') as explorer:
            explorer.return_value.wait.return_value=1
            with self.assertRaises(HTTPError) as error:self.call('/api/backups/open',{})
            self.assertIn('无法打开备份文件夹',json.load(error.exception)['error'])

    def test_explorer_fallback_without_windows_directory_uses_path_lookup(self):
        with patch.dict('server.os.environ', {}, clear=True),patch('server.os.startfile',create=True,side_effect=PermissionError('denied')),patch('server.subprocess.Popen') as explorer:
            explorer.return_value.wait.return_value=0
            self.call('/api/backups/open',{})
            self.assertEqual(explorer.call_args.args[0][0], 'explorer.exe')
            self.assertEqual(explorer.call_args.args[0][1], str(self.folder.resolve()))

    def test_open_folder_reports_failure_when_both_methods_are_denied(self):
        with patch('server.os.startfile',create=True,side_effect=PermissionError('denied')),patch('server.subprocess.Popen',side_effect=PermissionError('denied')):
            with self.assertRaises(HTTPError) as error:self.call('/api/backups/open',{})
            message=json.load(error.exception)['error']
            self.assertIn('无法打开备份文件夹',message);self.assertIn(str(self.folder.resolve()),message)

    def test_malformed_backup_rejected_without_writing(self):
        with self.assertRaises(HTTPError) as error:self.call('/api/backups',{'data':{'plans':[]}})
        self.assertEqual(error.exception.code,400)
        self.assertFalse(self.folder.exists())

    def test_failed_disk_commit_does_not_leave_broken_backup(self):
        with patch('server.os.fsync',side_effect=OSError('disk full')):
            with self.assertRaises(HTTPError) as error:self.create()
        self.assertEqual(error.exception.code,400)
        self.assertEqual(list(self.folder.iterdir()),[])

    def test_legacy_date_named_backup_is_visible_and_can_be_imported(self):
        self.folder.mkdir()
        name='dayup-backup-2026-10-28.json'
        (self.folder/name).write_text(json.dumps(self.data),encoding='utf-8')
        self.assertEqual(self.call('/api/backups')['files'][0]['name'],name)
        self.assertEqual(self.call('/api/backups/'+name),self.data)
