"""Serve DayUp on this computer only; no network, database or dependencies needed."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urlsplit, unquote
from datetime import datetime, timezone, timedelta
import argparse
import json
import os
import re
import socket
import subprocess
import webbrowser

ROOT = Path(__file__).resolve().parent / 'dist'
BACKUPS = ROOT.parent / 'backups'
BACKUP_NAME = re.compile(r'dayup-backup-\d{4}-\d{2}-\d{2}(?:_\d{6}_\d{6})?\.json\Z')
MAX_BACKUP_BYTES = 100 * 1024 * 1024

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        if not self.valid_host():
            return self.send_error(403)
        route = unquote(urlsplit(self.path).path)
        if route.startswith('/api/'):
            try:
                folder = self.backup_folder()
                if route == '/api/backups':
                    files = [{'name':p.name, 'size':p.stat().st_size, 'modified':p.stat().st_mtime}
                             for p in folder.iterdir() if BACKUP_NAME.fullmatch(p.name) and p.is_file() and not p.is_symlink()]
                    return self.send_json(200, {'folder':str(folder), 'files':sorted(files,key=lambda p:p['name'],reverse=True)})
                if route.startswith('/api/backups/'):
                    file = self.backup_path(route[len('/api/backups/'):])
                    if not file.is_file():
                        return self.send_error(404)
                    return self.send_json(200, json.loads(file.read_text(encoding='utf-8')))
                return self.send_error(404)
            except (ValueError, OSError) as error:
                return self.send_json(400, {'error':str(error)})
        if self.path == '/health':
            body = json.dumps({'app':'DayUp','local':True}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def valid_host(self):
        return self.headers.get('Host') in {f'localhost:{self.server.server_port}',f'127.0.0.1:{self.server.server_port}'}

    def backup_folder(self):
        folder = self.server.backup_dir
        if folder.is_symlink():
            raise ValueError('备份文件夹不能是符号链接')
        folder.mkdir(parents=True, exist_ok=True)
        return folder.resolve()

    def backup_path(self, name):
        if not isinstance(name,str) or not BACKUP_NAME.fullmatch(name):
            raise ValueError('无效的备份文件名')
        folder = self.backup_folder()
        file = folder / name
        if file.is_symlink() or file.resolve().parent != folder:
            raise ValueError('备份文件必须位于备份文件夹内')
        return file

    def send_json(self, status, value):
        body = json.dumps(value, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        # Only this local page can mutate files; foreign sites cannot bypass this via a form or DNS rebinding.
        if not self.valid_host() or self.headers.get('Origin') != f'http://{self.headers.get("Host")}' or self.headers.get('X-DayUp-Request') != '1':
            return self.send_json(403, {'error':'只允许 DayUp 本地页面操作备份'})
        if self.headers.get('Content-Type','').split(';')[0] != 'application/json':
            return self.send_json(415, {'error':'需要 JSON 数据'})
        try:
            size = int(self.headers.get('Content-Length','0'))
            if not 0 < size <= MAX_BACKUP_BYTES:
                return self.send_json(413, {'error':'备份数据过大或为空（上限 100MB）'})
            body = json.loads(self.rfile.read(size))
            if not isinstance(body,dict):
                raise ValueError('请求格式无效')
            route = urlsplit(self.path).path
            if route == '/api/backups':
                data = body.get('data')
                required = ['plans','memos','projects','devLogs','clients','consultLogs','fitnessPlans','workouts','meals','games','gameSessions']
                if not isinstance(data,dict) or any(not isinstance(data.get(key),list) for key in required):
                    raise ValueError('备份缺少完整数据列表')
                name = 'dayup-backup-' + datetime.now(timezone(timedelta(hours=8))).strftime('%Y-%m-%d_%H%M%S_%f') + '.json'
                file = self.backup_path(name)
                # Exclusive create never overwrites a historical backup, even on repeated clicks.
                payload = json.dumps(data,ensure_ascii=False,indent=2)
                created = False
                try:
                    with file.open('x',encoding='utf-8') as output:
                        created = True
                        output.write(payload)
                        output.flush()
                        os.fsync(output.fileno())
                except OSError:
                    if created:
                        file.unlink(missing_ok=True)
                    raise
                return self.send_json(201, {'name':name,'folder':str(file.parent)})
            if route == '/api/backups/delete':
                names = body.get('names')
                if not isinstance(names,list) or not names or len(names)>1000:
                    raise ValueError('请选择要删除的备份')
                files = [self.backup_path(name) for name in set(names)]
                if any(not file.is_file() for file in files):
                    return self.send_json(404, {'error':'部分备份已不存在，请刷新列表'})
                for file in files:
                    file.unlink()
                return self.send_json(200, {'deleted':len(files)})
            if route == '/api/backups/open':
                folder = self.backup_folder()
                if not hasattr(os,'startfile'):
                    return self.send_json(503, {'error':'当前系统不支持打开文件夹，请按显示的路径手动打开'})
                try:
                    os.startfile(str(folder))
                except OSError:
                    # Some Windows installations block the default folder association.
                    windows_dir = os.environ.get('WINDIR') or os.environ.get('SystemRoot')
                    explorer = Path(windows_dir) / 'explorer.exe' if windows_dir else Path('explorer.exe')
                    try:
                        startup = None
                        if hasattr(subprocess,'STARTUPINFO'):
                            startup = subprocess.STARTUPINFO()
                            startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                            startup.wShowWindow = 1  # The service is hidden; the requested Explorer window must be visible.
                        process = subprocess.Popen([str(explorer),str(folder)],startupinfo=startup)
                        try:
                            code = process.wait(timeout=1)
                            if code not in (0,None):
                                raise OSError('资源管理器拒绝打开请求')
                        except subprocess.TimeoutExpired:
                            pass  # Explorer may remain alive as the visible window process.
                    except OSError as error:
                        raise OSError(f'Windows 无法打开备份文件夹，请手动打开：{folder}') from error
                return self.send_json(200, {'folder':str(folder)})
            return self.send_error(404)
        except (ValueError, OSError, TypeError) as error:
            return self.send_json(400, {'error':str(error)})

    def list_directory(self, _path):
        self.send_error(404)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Cross-Origin-Resource-Policy','same-origin')
        super().end_headers()

class LocalHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket,'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET,socket.SO_EXCLUSIVEADDRUSE,1)
        super().server_bind()

def make_server(port=4173, backup_dir=None):
    server = LocalHTTPServer(('127.0.0.1', port), partial(Handler, directory=str(ROOT)))
    server.backup_dir = Path(backup_dir) if backup_dir is not None else BACKUPS
    return server

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4173)
    parser.add_argument('--open', action='store_true', dest='open_browser')
    args = parser.parse_args()
    url = f'http://localhost:{args.port}/'
    try:
        server = make_server(args.port)
    except OSError:
        try:
            with urlopen(url+'health', timeout=2) as response:
                if json.load(response).get('app') != 'DayUp':
                    raise RuntimeError('端口被其他程序占用')
            if args.open_browser:
                webbrowser.open(url)
            return
        except Exception as error:
            raise SystemExit('DayUp 无法启动：4173 端口被其他程序占用。') from error
    if args.open_browser:
        webbrowser.open(url)
    print(f'DayUp: {url}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
