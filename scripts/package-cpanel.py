"""Package only the compiled website and PHP runtime files, including dotfiles."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
source = root / 'release-upload'
output = root / 'outputs' / 'searchparty-cpanel.zip'
required = ['index.html', 'index.php', '.htaccess', 'api.php', 'server/.htaccess', 'server/api.php', 'server/database.php', 'server/schema.sql', 'server/validation.php', 'server/privacy.php', 'server/maintenance.php', 'ads.txt', 'privacy.html', 'cookies.html', 'terms.html', 'safety.html']
for name in required:
    if not (source / name).is_file():
        raise SystemExit('Missing build file: ' + name)
output.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(output, 'w', ZIP_DEFLATED, strict_timestamps=False) as archive:
    for path in sorted(source.rglob('*')):
        if path.is_file():
            archive.write(path, path.relative_to(source).as_posix())
with ZipFile(output) as archive:
    if archive.testzip():
        raise SystemExit('Archive verification failed.')
    assert all(name in archive.namelist() for name in required)
    print(f'Packaged and verified {len(archive.namelist())} files: {output}')
