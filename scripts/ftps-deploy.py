"""Explicit FTPS only. Credentials arrive on stdin and are never persisted."""
import ftplib
import getpass
import json
import pathlib
import ssl
import sys
import time
import uuid


def main():
    print('Ready for FTPS configuration on stdin (input is hidden).', flush=True)
    config = json.loads(getpass.getpass('') if sys.stdin.isatty() else sys.stdin.readline())
    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=45)
    ftp.connect(config['host'], 21)
    ftp.auth()
    ftp.login(config['user'], config['password'])
    config.pop('password', None)
    ftp.prot_p()
    target = config.get('target')
    if target:
        ftp.cwd(target)
    if config.get('action', 'inspect') == 'inspect':
        entries = []
        for name, facts in ftp.mlsd():
            if name not in ('.', '..'):
                entries.append({'name': name, 'type': facts.get('type'), 'size': facts.get('size')})
        print(json.dumps({'directory': ftp.pwd(), 'entries': entries[:100], 'encrypted': True}), flush=True)
    elif config['action'] == 'upload':
        source = pathlib.Path(config['source']).resolve(strict=True)
        backup = pathlib.Path(config['backup']).resolve()
        backup.mkdir(parents=True, exist_ok=True)
        files = sorted(p for p in source.rglob('*') if p.is_file())
        # Activate the new entry point last. Preserve every replaced remote file locally.
        files.sort(key=lambda p: (p.name in ('index.html', '.htaccess'), p.name == 'index.html', str(p)))
        dirs = set()
        uploaded = []
        for file in files:
            relative = file.relative_to(source).as_posix()
            if any(part in ('..', '.git', 'node_modules') for part in pathlib.PurePosixPath(relative).parts):
                raise ValueError('Unsafe source path.')
            parent = pathlib.PurePosixPath(relative).parent
            current = ''
            for part in parent.parts:
                if part == '.':
                    continue
                current = f'{current}/{part}'.strip('/')
                if current not in dirs:
                    try:
                        ftp.mkd(current)
                    except ftplib.error_perm as exc:
                        if not str(exc).startswith('550'):
                            raise
                    dirs.add(current)
            local_backup = backup / relative
            try:
                ftp.size(relative)
            except ftplib.error_perm:
                pass
            else:
                local_backup.parent.mkdir(parents=True, exist_ok=True)
                with local_backup.open('wb') as stream:
                    ftp.retrbinary('RETR ' + relative, stream.write)
            temp = (str(parent) + '/' if str(parent) != '.' else '') + '.sp-upload-' + uuid.uuid4().hex
            with file.open('rb') as stream:
                ftp.storbinary('STOR ' + temp, stream)
            if ftp.size(temp) != file.stat().st_size:
                raise RuntimeError('Uploaded size does not match for ' + relative)
            ftp.rename(temp, relative)
            uploaded.append(relative)
        print(json.dumps({'uploaded': len(uploaded), 'directory': ftp.pwd(), 'backup': str(backup), 'files': uploaded, 'encrypted': True}), flush=True)
    else:
        raise ValueError('Unknown FTPS action.')
    ftp.quit()


try:
    main()
except Exception as error:
    # ftplib/SSL errors contain server status, never submitted password text.
    print(json.dumps({'error': str(error), 'type': type(error).__name__}), flush=True)
    sys.exit(1)
